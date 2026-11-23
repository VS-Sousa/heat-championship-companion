import { Injectable, signal, computed } from '@angular/core';
import {
  LOCAL_SESSION_CONFIG,
  PREVIEW_SESSION_CONFIG,
  SupabaseConfig,
  UserSession,
} from '../models/domain.models';
import {
  resolveStorageMode,
  setStorageModeOverride,
} from '../data/resolve-storage-mode';
import { StorageMode } from '../data/storage-mode';

const STORAGE_KEY = 'heat_championship_session';
const SESSION_MS = 24 * 60 * 60 * 1000;

type LegacyConfig = { url: string; publishableKey?: string; anonKey?: string };

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
  readonly storageMode = computed<StorageMode>(() => {
    return this.sessionSignal()?.storageMode ?? resolveStorageMode();
  });
  readonly isPreview = computed(() => this.storageMode() === 'preview');
  readonly isLocal = computed(() => this.storageMode() === 'local');

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
      const parsed = JSON.parse(raw) as UserSession & {
        config: LegacyConfig;
      };
      if (!parsed?.expiresAt || Date.now() > parsed.expiresAt) {
        this.clear();
        return null;
      }

      const normalized = this.normalizeSession(parsed);
      if (!normalized.config.publishableKey) {
        this.clear();
        return null;
      }
      if (
        normalized.storageMode === 'local' &&
        (!normalized.localAuth?.apiBaseUrl || !normalized.localAuth?.token)
      ) {
        this.clear();
        return null;
      }

      this.persist(normalized);
      return normalized;
    } catch {
      this.clear();
      return null;
    }
  }

  saveGuest(config: SupabaseConfig): UserSession {
    setStorageModeOverride('supabase');
    const session: UserSession = {
      storageMode: 'supabase',
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
    setStorageModeOverride('supabase');
    const session: UserSession = {
      storageMode: 'supabase',
      config,
      user,
      expiresAt: Date.now() + SESSION_MS,
    };
    this.persist(session);
    return session;
  }

  /** Start an offline demo session (host by default for full UI). */
  savePreview(asHost = true): UserSession {
    setStorageModeOverride('preview');
    const session: UserSession = {
      storageMode: 'preview',
      config: PREVIEW_SESSION_CONFIG,
      user: asHost
        ? {
            id: 'preview-host',
            username: 'Demo Host',
            role: 'host',
          }
        : null,
      expiresAt: Date.now() + SESSION_MS,
    };
    this.persist(session);
    return session;
  }

  saveLocal(
    apiBaseUrl: string,
    token: string,
    user: UserSession['user']
  ): UserSession {
    setStorageModeOverride('local');
    const session: UserSession = {
      storageMode: 'local',
      config: LOCAL_SESSION_CONFIG,
      localAuth: {
        apiBaseUrl: apiBaseUrl.replace(/\/$/, ''),
        token,
      },
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

  private normalizeSession(
    session: UserSession & { config: LegacyConfig }
  ): UserSession {
    const key =
      session.config.publishableKey?.trim() ||
      session.config.anonKey?.trim() ||
      '';
    let storageMode: StorageMode =
      session.storageMode ??
      (session.config.url?.startsWith('preview://')
        ? 'preview'
        : session.config.url?.startsWith('local://')
          ? 'local'
          : 'supabase');
    return {
      ...session,
      storageMode,
      config: {
        url: session.config.url,
        publishableKey: key,
      },
    };
  }

  private persist(session: UserSession): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    this.sessionSignal.set(session);
  }
}
