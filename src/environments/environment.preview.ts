import { AppEnvironment } from './environment.types';

/** Optional build-time preview profile (runtime toggle also supported). */
export const environment: AppEnvironment = {
  production: true,
  storageMode: 'preview',
  apiBaseUrl: '',
};
