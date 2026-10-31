import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_URL } from './api';
import { AuthService } from './auth.service';

/**
 * Adds the bearer token to API calls (only when there is one), and when the server says the token
 * has expired, refreshes it once and replays the request.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const api = inject(API_URL);
  if (!req.url.startsWith(api)) {
    return next(req);
  }

  const send = (token: string | null) =>
    next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
  const sentWith = auth.token();
  const isAuthEndpoint = req.url.startsWith(`${api}/user/`);

  return send(sentWith).pipe(
    catchError((err: HttpErrorResponse) => {
      // "Auth failed!" is the API's answer to a missing/expired/invalid token; other 401s are ownership errors.
      const tokenRejected = err.status === 401 && err.error?.message === 'Auth failed!';
      if (!sentWith || isAuthEndpoint || !tokenRejected) {
        return throwError(() => err);
      }
      return auth.refresh().pipe(
        catchError(() => {
          auth.logout();
          return throwError(() => err);
        }),
        // Outside the catchError above, so a failure of the replayed request is not mistaken for a failed refresh.
        switchMap((res) => send(res.token)),
      );
    }),
  );
};
