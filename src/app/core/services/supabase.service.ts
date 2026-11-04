import { Injectable, inject } from '@angular/core';
import {
  createClient,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';
import { SessionService } from './session.service';
import { I18nService } from '../i18n/i18n.service';
import { SupabaseConfig } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private client: SupabaseClient | null = null;
  private readonly i18n = inject(I18nService);

  constructor(private readonly sessionService: SessionService) {
    const session = this.sessionService.restore();
    if (session) {
      this.client = this.create(session.config);
    }
  }

  getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase client is not connected. Visit /connect first.');
    }
    return this.client;
  }

  isReady(): boolean {
    return this.client !== null;
  }

  async connectAsGuest(config: SupabaseConfig): Promise<void> {
    const probe = createClient(config.url, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await probe.from('cars').select('id').limit(1);
    if (error && this.isHardConnectionError(error.message)) {
      throw new Error(this.i18n.t('connect.errorReach'));
    }

    this.client = this.create(config);
    this.sessionService.saveGuest(config);
  }

  async connectAsHost(
    config: SupabaseConfig,
    email: string,
    password: string
  ): Promise<void> {
    const client = this.create(config);

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) {
      throw new Error(error?.message ?? 'Authentication failed.');
    }

    const profile = await this.fetchProfile(client, data.user);
    this.client = client;
    this.sessionService.saveAuthenticated(config, {
      id: data.user.id,
      username: profile.username,
      role: profile.role,
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.auth.signOut().catch(() => undefined);
    }
    this.client = null;
    this.sessionService.clear();
    localStorage.removeItem('heat_supabase_auth');
  }

  private create(config: SupabaseConfig): SupabaseClient {
    return createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        storageKey: 'heat_supabase_auth',
        autoRefreshToken: true,
      },
    });
  }

  private async fetchProfile(
    client: SupabaseClient,
    user: User
  ): Promise<{ username: string; role: 'host' | 'admin' }> {
    const { data, error } = await client
      .from('profiles')
      .select('username, role')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not load profile: ${error.message}`);
    }

    if (!data) {
      const username =
        (user.user_metadata?.['username'] as string | undefined) ??
        user.email?.split('@')[0] ??
        'host';
      return { username, role: 'host' };
    }

    const role = data.role === 'admin' ? 'admin' : 'host';
    return { username: data.username, role };
  }

  private isHardConnectionError(message: string): boolean {
    const lower = message.toLowerCase();
    return (
      lower.includes('failed to fetch') ||
      lower.includes('network') ||
      lower.includes('invalid api key') ||
      lower.includes('jwt') ||
      lower.includes('invalid url')
    );
  }
}
