import {
  ApplicationConfig,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';
import { createDataProvider } from './core/data/data-provider.factory';
import { DATA_PROVIDER } from './core/data/data-provider.token';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideRouter(routes, withHashLocation()),
    { provide: DATA_PROVIDER, useFactory: createDataProvider },
  ],
};
