import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';

/** Background session calls fail quietly: an expired session is handled by signing the user out. */
const isSessionCall = (url: string) =>
  url.endsWith('/user/refresh') || url.endsWith('/user/logout');

/** Shows API errors in a snack bar. Sits outside the auth interceptor, so it only sees final failures. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (!isSessionCall(req.url)) {
        const apiMessage: string | undefined = err.error?.message;
        const message =
          apiMessage ?? (err.status === 0 ? 'Cannot reach the server.' : 'Something went wrong.');
        snackBar.open(message, 'Dismiss', { duration: 5000 });
      }
      return throwError(() => err);
    }),
  );
};
