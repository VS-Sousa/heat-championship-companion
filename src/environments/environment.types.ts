import { StorageMode } from '../app/core/data/storage-mode';

export interface AppEnvironment {
  production: boolean;
  storageMode: StorageMode;
  /** Base URL for LocalApiDataProvider (ignored in supabase/preview). */
  apiBaseUrl: string;
}
