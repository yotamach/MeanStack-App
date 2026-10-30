import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { AuthCredentials, LoginResponse, SignupResponse } from '@meanstack/shared';
import { Observable, tap } from 'rxjs';
import { API_URL } from './api';

const STORAGE_KEY = 'meanstack.session';

interface StoredSession {
  token: string;
  userId: string;
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly api = inject(API_URL);

  private readonly _token = signal<string | null>(null);
  private readonly _userId = signal<string | null>(null);
  private expiryTimer?: ReturnType<typeof setTimeout>;

  readonly token = this._token.asReadonly();
  readonly userId = this._userId.asReadonly();
  readonly isAuthenticated = computed(() => this._token() !== null);

  constructor() {
    this.restoreSession();
  }

  signup(credentials: AuthCredentials): Observable<SignupResponse> {
    return this.http.post<SignupResponse>(`${this.api}/user/signup`, credentials);
  }

  login(credentials: AuthCredentials): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.api}/user/login`, credentials).pipe(
      tap((res) => {
        const expiresAt = Date.now() + res.expiresIn * 1000;
        this.startSession({ token: res.token, userId: res.userId, expiresAt });
      }),
    );
  }

  logout(): void {
    clearTimeout(this.expiryTimer);
    this._token.set(null);
    this._userId.set(null);
    this.writeStorage(null);
    void this.router.navigate(['/']);
  }

  private startSession(session: StoredSession): void {
    this._token.set(session.token);
    this._userId.set(session.userId);
    this.writeStorage(session);
    clearTimeout(this.expiryTimer);
    this.expiryTimer = setTimeout(() => this.logout(), session.expiresAt - Date.now());
  }

  private restoreSession(): void {
    const stored = this.readStorage();
    if (stored && stored.expiresAt > Date.now()) {
      this.startSession(stored);
    } else if (stored) {
      this.writeStorage(null);
    }
  }

  // localStorage can be unavailable (private mode, blocked site data), so every access is guarded.
  private readStorage(): StoredSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      return null;
    }
  }

  private writeStorage(session: StoredSession | null): void {
    try {
      if (session) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Session simply won't survive a reload.
    }
  }
}
