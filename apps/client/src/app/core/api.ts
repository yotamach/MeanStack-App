import { InjectionToken } from '@angular/core';

/** Base URL of the API. Relative so the dev proxy (proxy.conf.json) or a reverse proxy can serve it. */
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
