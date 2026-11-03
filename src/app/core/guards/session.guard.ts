import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../services/session.service';
import { SupabaseService } from '../services/supabase.service';

export const sessionGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const restored = session.restore();
  if (!restored || !supabase.isReady()) {
    session.clear();
    return router.createUrlTree(['/connect']);
  }
  return true;
};

export const connectGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const restored = session.restore();
  if (restored && supabase.isReady()) {
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
