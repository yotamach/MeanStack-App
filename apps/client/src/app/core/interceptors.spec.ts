import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { errorInterceptor } from './error.interceptor';

describe('interceptors', () => {
  const token = signal<string | null>(null);
  const logout = vi.fn();
  const open = vi.fn();
  let http: HttpClient;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    token.set(null);
    logout.mockClear();
    open.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { token, isAuthenticated: () => token() !== null, logout } },
        { provide: MatSnackBar, useValue: { open } },
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

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
    expect(ctrl.expectOne('https://other.example/x').request.headers.has('Authorization')).toBe(false);
  });

  it('shows the API error message', () => {
    http.get('/api/posts').subscribe({ error: () => undefined });
    ctrl.expectOne('/api/posts').flush({ message: 'Invalid id!' }, { status: 400, statusText: 'Bad Request' });
    expect(open).toHaveBeenCalledWith('Invalid id!', 'Dismiss', expect.anything());
    expect(logout).not.toHaveBeenCalled();
  });

  it('shows a friendly message when the server is unreachable', () => {
    http.get('/api/posts').subscribe({ error: () => undefined });
    ctrl.expectOne('/api/posts').error(new ProgressEvent('error'));
    expect(open).toHaveBeenCalledWith('Cannot reach the server.', 'Dismiss', expect.anything());
  });

  it('logs out on a rejected token but not on "Not authorized!"', () => {
    token.set('abc');
    http.get('/api/posts').subscribe({ error: () => undefined });
    ctrl.expectOne('/api/posts').flush({ message: 'Not authorized!' }, { status: 401, statusText: 'Unauthorized' });
    expect(logout).not.toHaveBeenCalled();

    http.get('/api/posts').subscribe({ error: () => undefined });
    ctrl.expectOne('/api/posts').flush({ message: 'Auth failed!' }, { status: 401, statusText: 'Unauthorized' });
    expect(logout).toHaveBeenCalledOnce();
  });
});
