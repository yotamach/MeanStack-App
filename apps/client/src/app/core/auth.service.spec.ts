import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

const setup = () => {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  return { auth: TestBed.inject(AuthService), http: TestBed.inject(HttpTestingController) };
};

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('starts logged out', () => {
    expect(setup().auth.isAuthenticated()).toBe(false);
  });

  it('stores the session on login and exposes token and user id', () => {
    const { auth, http } = setup();
    auth.login({ email: 'a@x.com', password: 'pw' }).subscribe();
    http.expectOne('/api/user/login').flush({ token: 't0k', expiresIn: 3600, userId: 'u1' });

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.token()).toBe('t0k');
    expect(auth.userId()).toBe('u1');
    expect(localStorage.getItem('meanstack.session')).toContain('t0k');
  });

  it('stays logged out when login fails', () => {
    const { auth, http } = setup();
    auth.login({ email: 'a@x.com', password: 'bad' }).subscribe({ error: () => undefined });
    http
      .expectOne('/api/user/login')
      .flush({ message: 'Auth failed!' }, { status: 401, statusText: 'Unauthorized' });
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('logs out automatically when the token expires', () => {
    const { auth, http } = setup();
    auth.login({ email: 'a@x.com', password: 'pw' }).subscribe();
    http.expectOne('/api/user/login').flush({ token: 't', expiresIn: 60, userId: 'u1' });

    vi.advanceTimersByTime(59_000);
    expect(auth.isAuthenticated()).toBe(true);
    vi.advanceTimersByTime(2_000);
    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('meanstack.session')).toBeNull();
  });

  it('restores an unexpired session and drops an expired one', () => {
    localStorage.setItem(
      'meanstack.session',
      JSON.stringify({ token: 'saved', userId: 'u9', expiresAt: Date.now() + 10_000 }),
    );
    expect(setup().auth.token()).toBe('saved');

    TestBed.resetTestingModule();
    localStorage.setItem(
      'meanstack.session',
      JSON.stringify({ token: 'old', userId: 'u9', expiresAt: Date.now() - 1 }),
    );
    expect(setup().auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('meanstack.session')).toBeNull();
  });

  it('logout clears everything', () => {
    const { auth, http } = setup();
    auth.login({ email: 'a@x.com', password: 'pw' }).subscribe();
    http.expectOne('/api/user/login').flush({ token: 't', expiresIn: 60, userId: 'u1' });
    auth.logout();
    expect(auth.token()).toBeNull();
    expect(auth.userId()).toBeNull();
  });
});
