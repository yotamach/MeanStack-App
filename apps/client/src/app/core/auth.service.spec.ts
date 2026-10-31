import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

const HINT = 'meanstack.signedIn';
const session = (token = 't0k', expiresIn = 900) => ({ token, expiresIn, userId: 'u1' });

const setup = () => {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  return {
    auth: TestBed.inject(AuthService),
    http: TestBed.inject(HttpTestingController),
    navigate,
  };
};

const unauthorized = { status: 401, statusText: 'Unauthorized' };

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('starts logged out and makes no request for an anonymous visitor', async () => {
    const { auth, http } = setup();
    await auth.restoreSession();
    http.expectNone('/api/user/refresh');
    expect(auth.isAuthenticated()).toBe(false);
  });

  describe('login', () => {
    it('keeps the access token in memory only', () => {
      const { auth, http } = setup();
      auth.login({ email: 'a@x.com', password: 'pw' }).subscribe();
      http.expectOne('/api/user/login').flush(session('SECRET-ACCESS-TOKEN'));

      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.token()).toBe('SECRET-ACCESS-TOKEN');
      expect(auth.userId()).toBe('u1');
      const stored = JSON.stringify({ ...localStorage });
      expect(stored).not.toContain('SECRET-ACCESS-TOKEN');
      expect(localStorage.getItem(HINT)).toBe('1');
    });

    it('stays logged out when login fails', () => {
      const { auth, http } = setup();
      auth.login({ email: 'a@x.com', password: 'bad' }).subscribe({ error: () => undefined });
      http.expectOne('/api/user/login').flush({ message: 'Auth failed!' }, unauthorized);
      expect(auth.isAuthenticated()).toBe(false);
      expect(localStorage.getItem(HINT)).toBeNull();
    });
  });

  describe('restoreSession', () => {
    it('turns the refresh cookie into a session when the hint is set', async () => {
      localStorage.setItem(HINT, '1');
      const { auth, http } = setup();
      const restored = auth.restoreSession();
      http.expectOne('/api/user/refresh').flush(session('restored'));
      await restored;
      expect(auth.token()).toBe('restored');
    });

    it('ends up anonymous and forgets the hint when the cookie is rejected', async () => {
      localStorage.setItem(HINT, '1');
      const { auth, http, navigate } = setup();
      const restored = auth.restoreSession();
      http.expectOne('/api/user/refresh').flush({ message: 'Session expired!' }, unauthorized);
      await restored;
      expect(auth.isAuthenticated()).toBe(false);
      expect(localStorage.getItem(HINT)).toBeNull();
      expect(navigate).not.toHaveBeenCalled(); // must not hijack the page being opened
    });

    it('stays anonymous but keeps the hint when the server is unreachable', async () => {
      localStorage.setItem(HINT, '1');
      const { auth, http } = setup();
      const restored = auth.restoreSession();
      http.expectOne('/api/user/refresh').error(new ProgressEvent('error'));
      await restored;
      expect(auth.isAuthenticated()).toBe(false);
      expect(localStorage.getItem(HINT)).toBe('1');
    });

    it('removes the token older versions kept in localStorage', () => {
      localStorage.setItem('meanstack.session', JSON.stringify({ token: 'old' }));
      setup();
      expect(localStorage.getItem('meanstack.session')).toBeNull();
    });
  });

  describe('refresh', () => {
    it('shares one request between concurrent callers', () => {
      const { auth, http } = setup();
      const results: string[] = [];
      auth.refresh().subscribe((r) => results.push(r.token));
      auth.refresh().subscribe((r) => results.push(r.token));
      http.expectOne('/api/user/refresh').flush(session('shared'));
      expect(results).toEqual(['shared', 'shared']);
      // and a later call makes a new request
      auth.refresh().subscribe();
      http.expectOne('/api/user/refresh').flush(session('again'));
      expect(auth.token()).toBe('again');
    });

    it('refreshes by itself shortly before the access token expires', () => {
      const { auth, http } = setup();
      auth.login({ email: 'a@x.com', password: 'pw' }).subscribe();
      http.expectOne('/api/user/login').flush(session('first', 100));

      vi.advanceTimersByTime(89_000);
      http.expectNone('/api/user/refresh');
      vi.advanceTimersByTime(2_000);
      http.expectOne('/api/user/refresh').flush(session('second', 100));
      expect(auth.token()).toBe('second');

      vi.advanceTimersByTime(91_000); // and keeps going
      http.expectOne('/api/user/refresh').flush(session('third', 100));
      expect(auth.token()).toBe('third');
    });

    it('signs out and goes home when the background refresh is rejected', () => {
      const { auth, http, navigate } = setup();
      auth.login({ email: 'a@x.com', password: 'pw' }).subscribe();
      http.expectOne('/api/user/login').flush(session('first', 100));

      vi.advanceTimersByTime(91_000);
      http.expectOne('/api/user/refresh').flush({ message: 'Session expired!' }, unauthorized);
      expect(auth.isAuthenticated()).toBe(false);
      expect(navigate).toHaveBeenCalledWith(['/']);
    });

    it('stays signed in when the background refresh fails only because the network is down', () => {
      const { auth, http } = setup();
      auth.login({ email: 'a@x.com', password: 'pw' }).subscribe();
      http.expectOne('/api/user/login').flush(session('first', 100));

      vi.advanceTimersByTime(91_000);
      http.expectOne('/api/user/refresh').error(new ProgressEvent('error'));
      expect(auth.isAuthenticated()).toBe(true);
    });
  });

  describe('logout', () => {
    it('clears the session, tells the server and goes home', () => {
      const { auth, http, navigate } = setup();
      auth.login({ email: 'a@x.com', password: 'pw' }).subscribe();
      http.expectOne('/api/user/login').flush(session());

      auth.logout();
      http.expectOne('/api/user/logout').flush({ message: 'Logged out!' });
      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.userId()).toBeNull();
      expect(localStorage.getItem(HINT)).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/']);
    });

    it('still signs out locally when the server cannot be reached', () => {
      const { auth, http } = setup();
      auth.login({ email: 'a@x.com', password: 'pw' }).subscribe();
      http.expectOne('/api/user/login').flush(session());
      auth.logout();
      http.expectOne('/api/user/logout').error(new ProgressEvent('error'));
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('follows a logout that happened in another tab', () => {
      const { auth, http, navigate } = setup();
      auth.login({ email: 'a@x.com', password: 'pw' }).subscribe();
      http.expectOne('/api/user/login').flush(session());

      localStorage.removeItem(HINT);
      globalThis.dispatchEvent(new StorageEvent('storage', { key: HINT, newValue: null }));
      expect(auth.isAuthenticated()).toBe(false);
      expect(navigate).toHaveBeenCalledWith(['/']);
    });
  });
});
