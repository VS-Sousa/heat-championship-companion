import { Injectable } from '@angular/core';
import {
  createClient,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';
import { SessionService } from './session.service';
import { SupabaseConfig } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private client: SupabaseClient | null = null;

  constructor(private readonly sessionService: SessionService) {
    const session = this.sessionService.restore();
    if (session) {
      this.client = createClient(session.config.url, session.config.anonKey, {
        auth: {
          persistSession: true,
          storageKey: 'heat_supabase_auth',
          autoRefreshToken: true,
        },
      });
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
    const probe = createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await probe.from('cars').select('id').limit(1);
    if (error && this.isHardConnectionError(error.message)) {
      throw new Error(
        'Could not reach Supabase. Check URL, anon key, and that the schema was applied.'
      );
    }

    this.client = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        storageKey: 'heat_supabase_auth',
        autoRefreshToken: true,
      },
    });
    this.sessionService.saveGuest(config);
  }

  async connectAsHost(
    config: SupabaseConfig,
    email: string,
    password: string
  ): Promise<void> {
    const client = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        storageKey: 'heat_supabase_auth',
        autoRefreshToken: true,
      },
    });

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
