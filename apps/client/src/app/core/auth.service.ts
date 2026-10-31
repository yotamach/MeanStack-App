import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { AuthCredentials, LoginResponse, SignupResponse } from '@meanstack/shared';
import {
  Observable,
  catchError,
  finalize,
  firstValueFrom,
  of,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { API_URL } from './api';

/**
 * The only thing kept in localStorage: a hint that this browser has a refresh cookie, so anonymous
 * visitors don't trigger a pointless refresh request. It holds no secret. Setting/clearing it also
 * tells other tabs about logins and logouts.
 */
const SIGNED_IN_HINT = 'meanstack.signedIn';
/** Older versions kept the whole token here; it is removed on startup. */
const LEGACY_SESSION_KEY = 'meanstack.session';
/** Refresh after this share of the access token's lifetime. */
const REFRESH_AT = 0.9;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly api = inject(API_URL);

  // The access token only ever lives in memory; the refresh token is an httpOnly cookie JS cannot read.
  private readonly _token = signal<string | null>(null);
  private readonly _userId = signal<string | null>(null);
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private inFlight?: Observable<LoginResponse>;

  readonly token = this._token.asReadonly();
  readonly userId = this._userId.asReadonly();
  readonly isAuthenticated = computed(() => this._token() !== null);

  constructor() {
    this.storage((s) => s.removeItem(LEGACY_SESSION_KEY));
    // Another tab logged out: follow it.
    globalThis.addEventListener?.('storage', (event) => {
      if (event.key === SIGNED_IN_HINT && event.newValue === null && this.isAuthenticated()) {
        this.clearSession();
        void this.router.navigate(['/']);
      }
    });
  }

  signup(credentials: AuthCredentials): Observable<SignupResponse> {
    return this.http.post<SignupResponse>(`${this.api}/user/signup`, credentials);
  }

  login(credentials: AuthCredentials): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.api}/user/login`, credentials)
      .pipe(tap((res) => this.startSession(res)));
  }

  /** Run once at startup: turns the refresh cookie from a previous visit back into a session. */
  async restoreSession(): Promise<void> {
    if (!this.storage((s) => s.getItem(SIGNED_IN_HINT))) {
      return;
    }
    await firstValueFrom(this.refresh().pipe(catchError(() => of(null))));
  }

  /**
   * Exchanges the refresh cookie for a new access token. Concurrent callers share one request, because
   * the server rotates the cookie on every use. Only a definite rejection (401) ends the session; being
   * offline does not.
   */
  refresh(): Observable<LoginResponse> {
    this.inFlight ??= this.http.post<LoginResponse>(`${this.api}/user/refresh`, {}).pipe(
      tap((res) => this.startSession(res)),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) {
          this.clearSession();
        }
        return throwError(() => err);
      }),
      finalize(() => (this.inFlight = undefined)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.inFlight;
  }

  logout(): void {
    // Best effort: the local logout must not depend on the server being reachable.
    this.http.post(`${this.api}/user/logout`, {}).subscribe({ error: () => undefined });
    this.clearSession();
    void this.router.navigate(['/']);
  }

  private startSession(res: LoginResponse): void {
    this._token.set(res.token);
    this._userId.set(res.userId);
    this.storage((s) => s.setItem(SIGNED_IN_HINT, '1'));
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(
      () =>
        this.refresh().subscribe({
          error: (e: HttpErrorResponse) => this.onBackgroundRefreshFailed(e),
        }),
      res.expiresIn * 1000 * REFRESH_AT,
    );
  }

  private onBackgroundRefreshFailed(err: HttpErrorResponse): void {
    if (err.status === 401) {
      void this.router.navigate(['/']);
    }
  }

  private clearSession(): void {
    clearTimeout(this.refreshTimer);
    this._token.set(null);
    this._userId.set(null);
    this.storage((s) => s.removeItem(SIGNED_IN_HINT));
  }

  // localStorage can be unavailable (private mode, blocked site data), so every access is guarded.
  private storage<T>(fn: (s: Storage) => T): T | null {
    try {
      return fn(localStorage);
    } catch {
      return null;
    }
  }
}
