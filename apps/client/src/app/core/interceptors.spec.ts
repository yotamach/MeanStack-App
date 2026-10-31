import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { errorInterceptor } from './error.interceptor';

const unauthorized = { status: 401, statusText: 'Unauthorized' };
const authFailed = { message: 'Auth failed!' };

describe('interceptors', () => {
  const token = signal<string | null>(null);
  const logout = vi.fn();
  const refresh = vi.fn();
  const open = vi.fn();
  let http: HttpClient;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    token.set(null);
    logout.mockReset();
    refresh.mockReset();
    open.mockClear();
    TestBed.configureTestingModule({
      providers: [
        // Same order as app.config.ts
        provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { token, logout, refresh } },
        { provide: MatSnackBar, useValue: { open } },
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  describe('authInterceptor', () => {
    it('does not send an Authorization header when logged out', () => {
      http.get('/api/posts').subscribe();
      expect(ctrl.expectOne('/api/posts').request.headers.has('Authorization')).toBe(false);
    });

    it('adds the bearer token to API calls', () => {
      token.set('abc');
      http.get('/api/posts').subscribe();
      expect(ctrl.expectOne('/api/posts').request.headers.get('Authorization')).toBe('Bearer abc');
    });

    it('never leaks the token to other origins', () => {
      token.set('abc');
      http.get('https://other.example/x').subscribe();
      expect(ctrl.expectOne('https://other.example/x').request.headers.has('Authorization')).toBe(
        false,
      );
    });

    describe('when the server rejects the token', () => {
      it('refreshes once and replays the request with the new token', () => {
        token.set('expired');
        refresh.mockReturnValue(of({ token: 'fresh', expiresIn: 900, userId: 'u1' }));
        let result: unknown;
        http.get('/api/posts/1').subscribe((r) => (result = r));

        ctrl.expectOne('/api/posts/1').flush(authFailed, unauthorized);
        const replay = ctrl.expectOne('/api/posts/1');
        expect(replay.request.headers.get('Authorization')).toBe('Bearer fresh');
        replay.flush({ ok: true });

        expect(result).toEqual({ ok: true });
        expect(refresh).toHaveBeenCalledOnce();
        expect(logout).not.toHaveBeenCalled();
        expect(open).not.toHaveBeenCalled(); // the user never saw the 401
      });

      it('signs the user out and reports the original error when the refresh fails', () => {
        token.set('expired');
        refresh.mockReturnValue(throwError(() => ({ status: 401 })));
        const errors: unknown[] = [];
        http.get('/api/posts/1').subscribe({ error: (e) => errors.push(e) });

        ctrl.expectOne('/api/posts/1').flush(authFailed, unauthorized);
        expect(logout).toHaveBeenCalledOnce();
        expect(errors).toHaveLength(1);
        expect(open).toHaveBeenCalledWith('Auth failed!', 'Dismiss', expect.anything());
      });

      it('does not treat a failure of the replayed request as a failed refresh', () => {
        token.set('expired');
        refresh.mockReturnValue(of({ token: 'fresh', expiresIn: 900, userId: 'u1' }));
        http.get('/api/posts/1').subscribe({ error: () => undefined });

        ctrl.expectOne('/api/posts/1').flush(authFailed, unauthorized);
        ctrl
          .expectOne('/api/posts/1')
          .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
        expect(logout).not.toHaveBeenCalled();
        expect(refresh).toHaveBeenCalledOnce();
      });

      it('replays at most once', () => {
        token.set('expired');
        refresh.mockReturnValue(of({ token: 'fresh', expiresIn: 900, userId: 'u1' }));
        http.get('/api/posts/1').subscribe({ error: () => undefined });

        ctrl.expectOne('/api/posts/1').flush(authFailed, unauthorized);
        ctrl.expectOne('/api/posts/1').flush(authFailed, unauthorized);
        ctrl.expectNone('/api/posts/1');
        expect(refresh).toHaveBeenCalledOnce();
      });
    });

    it.each([
      ['an ownership error', '/api/posts/1', { message: 'Not authorized!' }, 'abc'],
      ['a failed login', '/api/user/login', authFailed, 'abc'],
      ['an anonymous request', '/api/posts/1', authFailed, null],
    ])('does not refresh for %s', (_name, url, body, tok) => {
      token.set(tok);
      http.get(url).subscribe({ error: () => undefined });
      ctrl.expectOne(url).flush(body, unauthorized);
      expect(refresh).not.toHaveBeenCalled();
      expect(logout).not.toHaveBeenCalled();
    });
  });

  describe('errorInterceptor', () => {
    it('shows the API error message', () => {
      http.get('/api/posts').subscribe({ error: () => undefined });
      ctrl
        .expectOne('/api/posts')
        .flush({ message: 'Invalid id!' }, { status: 400, statusText: 'Bad Request' });
      expect(open).toHaveBeenCalledWith('Invalid id!', 'Dismiss', expect.anything());
    });

    it('shows a friendly message when the server is unreachable', () => {
      http.get('/api/posts').subscribe({ error: () => undefined });
      ctrl.expectOne('/api/posts').error(new ProgressEvent('error'));
      expect(open).toHaveBeenCalledWith('Cannot reach the server.', 'Dismiss', expect.anything());
    });

    it.each(['/api/user/refresh', '/api/user/logout'])('stays quiet when %s fails', (url) => {
      http.post(url, {}).subscribe({ error: () => undefined });
      ctrl.expectOne(url).flush({ message: 'Session expired!' }, unauthorized);
      expect(open).not.toHaveBeenCalled();
    });
  });

  it('replays every rejected request once the refresh completes', () => {
    token.set('expired');
    const refreshed = new Subject<{ token: string; expiresIn: number; userId: string }>();
    refresh.mockReturnValue(refreshed);
    http.get('/api/posts/1').subscribe();
    http.get('/api/posts/2').subscribe();
    ctrl.expectOne('/api/posts/1').flush(authFailed, unauthorized);
    ctrl.expectOne('/api/posts/2').flush(authFailed, unauthorized);

    refreshed.next({ token: 'fresh', expiresIn: 900, userId: 'u1' });
    refreshed.complete();
    ctrl.expectOne('/api/posts/1').flush({});
    ctrl.expectOne('/api/posts/2').flush({});
  });
});
