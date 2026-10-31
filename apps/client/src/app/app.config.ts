import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { AuthService } from './core/auth.service';
import { authInterceptor } from './core/auth.interceptor';
import { errorInterceptor } from './core/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Order matters: a request goes errorInterceptor -> authInterceptor -> server, and the response comes
    // back the other way, so the auth interceptor can refresh and retry before the error handler sees a 401.
    provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
    // Restore the session from the refresh cookie before the first route (and guard) runs.
    provideAppInitializer(() => inject(AuthService).restoreSession()),
  ],
};
