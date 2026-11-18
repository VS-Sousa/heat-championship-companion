import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SupabaseService } from '../services/supabase.service';
import { DataProvider } from './data-provider';
import { LocalApiDataProvider } from './providers/local/local-api-data.provider';
import { PreviewDataProvider } from './providers/preview/preview-data.provider';
import { SupabaseDataProvider } from './providers/supabase/supabase-data.provider';
import { resolveStorageMode } from './resolve-storage-mode';

export function createDataProvider(): DataProvider {
  const mode = resolveStorageMode();
  switch (mode) {
    case 'preview':
      return new PreviewDataProvider();
    case 'local':
      return new LocalApiDataProvider(
        inject(HttpClient),
        environment.apiBaseUrl
      );
    case 'supabase':
    default:
      return new SupabaseDataProvider(inject(SupabaseService));
  }
}
