import { Injectable, signal, computed } from '@angular/core';
import { SupabaseConfig, UserSession } from '../models/domain.models';

const STORAGE_KEY = 'heat_championship_session';
const SESSION_MS = 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly sessionSignal = signal<UserSession | null>(null);

  readonly session = this.sessionSignal.asReadonly();
  readonly isConnected = computed(() => this.sessionSignal() !== null);
  readonly isHost = computed(() => {
    const role = this.sessionSignal()?.user?.role;
    return role === 'host' || role === 'admin';
  });
  readonly role = computed(() => this.sessionSignal()?.user?.role ?? 'guest');
  readonly username = computed(
    () => this.sessionSignal()?.user?.username ?? 'Guest'
  );

  constructor() {
    this.restore();
  }

  restore(): UserSession | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      this.sessionSignal.set(null);
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as UserSession;
      if (!parsed?.expiresAt || Date.now() > parsed.expiresAt) {
        this.clear();
        return null;
      }
      this.sessionSignal.set(parsed);
      return parsed;
    } catch {
      this.clear();
      return null;
    }
  }

  saveGuest(config: SupabaseConfig): UserSession {
    const session: UserSession = {
      config,
      user: null,
      expiresAt: Date.now() + SESSION_MS,
    };
    this.persist(session);
    return session;
  }

  saveAuthenticated(
    config: SupabaseConfig,
    user: NonNullable<UserSession['user']>
  ): UserSession {
    const session: UserSession = {
      config,
      user,
      expiresAt: Date.now() + SESSION_MS,
    };
    this.persist(session);
    return session;
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.sessionSignal.set(null);
  }

  private persist(session: UserSession): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    this.sessionSignal.set(session);
  }
}
