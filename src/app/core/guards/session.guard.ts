import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { resolveStorageMode } from '../data/resolve-storage-mode';
import { SessionService } from '../services/session.service';
import { SupabaseService } from '../services/supabase.service';

function sessionIsReady(
  session: SessionService,
  supabase: SupabaseService
): boolean {
  const restored = session.restore();
  if (!restored) return false;

  const mode = restored.storageMode ?? resolveStorageMode();
  if (mode === 'preview' || mode === 'local') {
    return true;
  }
  return supabase.isReady();
}

export const sessionGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  if (!sessionIsReady(session, supabase)) {
    session.clear();
    return router.createUrlTree(['/connect']);
  }
  return true;
};

export const connectGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  if (sessionIsReady(session, supabase)) {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};

export const hostGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);

  if (!session.isHost()) {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};
