import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/** Shows API errors in a snack bar and signs the user out when the server rejects the token. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const apiMessage: string | undefined = err.error?.message;
      const message =
        apiMessage ?? (err.status === 0 ? 'Cannot reach the server.' : 'Something went wrong.');
      // The API answers 401 "Auth failed!" for a bad/expired token; other 401s ("Not authorized!")
      // mean the user simply doesn't own the post.
      if (err.status === 401 && apiMessage === 'Auth failed!' && auth.isAuthenticated()) {
        auth.logout();
      }
      snackBar.open(message, 'Dismiss', { duration: 5000 });
      return throwError(() => err);
    }),
  );
};
