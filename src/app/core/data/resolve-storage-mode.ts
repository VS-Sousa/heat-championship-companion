import { environment } from '../../../environments/environment';
import { STORAGE_MODE_OVERRIDE_KEY, StorageMode } from './storage-mode';

const MODES: StorageMode[] = ['supabase', 'local', 'preview'];

export function resolveStorageMode(): StorageMode {
  try {
    const override = localStorage.getItem(STORAGE_MODE_OVERRIDE_KEY);
    if (override && MODES.includes(override as StorageMode)) {
      return override as StorageMode;
    }
  } catch {
    /* ignore */
  }
  return environment.storageMode;
}

export function setStorageModeOverride(mode: StorageMode | null): void {
  try {
    if (!mode) {
      localStorage.removeItem(STORAGE_MODE_OVERRIDE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_MODE_OVERRIDE_KEY, mode);
  } catch {
    /* ignore */
  }
}
