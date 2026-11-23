import { Component, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { LocalApiService } from '../../core/services/local-api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { ThemeService } from '../../core/services/theme.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PrefsBarComponent } from '../../shared/components/prefs-bar/prefs-bar.component';
import {
  resolveStorageMode,
  setStorageModeOverride,
} from '../../core/data/resolve-storage-mode';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-connect',
  standalone: true,
  imports: [FormsModule, NgClass, RouterLink, TranslatePipe, PrefsBarComponent],
  templateUrl: './connect.component.html',
  styleUrl: './connect.component.css',
})
export class ConnectComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly localApi = inject(LocalApiService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  constructor() {
    inject(ThemeService);
    if (resolveStorageMode() === 'local') {
      this.backend = 'local';
    }
  }

  backend: 'supabase' | 'local' = 'supabase';
  url = '';
  publishableKey = '';
  apiBaseUrl = environment.apiBaseUrl;
  email = '';
  username = 'host';
  password = '';
  mode: 'guest' | 'host' = 'guest';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  selectBackend(backend: 'supabase' | 'local'): void {
    this.backend = backend;
    this.error.set(null);
  }

  async submit(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);

    try {
      if (this.backend === 'local') {
        await this.submitLocal();
      } else {
        await this.submitSupabase();
      }

      const base = document.querySelector('base')?.href ?? '/';
      window.location.href = `${base}#/dashboard`;
      window.location.reload();
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : this.i18n.t('connect.errorFailed')
      );
    } finally {
      this.loading.set(false);
    }
  }

  private async submitLocal(): Promise<void> {
    const apiBaseUrl = this.apiBaseUrl.trim().replace(/\/$/, '');
    if (!apiBaseUrl) {
      throw new Error(this.i18n.t('connect.errorLocalUrl'));
    }
    setStorageModeOverride('local');
    if (this.mode === 'guest') {
      await this.localApi.connectAsGuest(apiBaseUrl);
      return;
    }
    if (!this.username.trim() || !this.password) {
      throw new Error(this.i18n.t('connect.errorHostAuth'));
    }
    await this.localApi.connectAsHost(
      this.username.trim(),
      this.password,
      apiBaseUrl
    );
  }

  private async submitSupabase(): Promise<void> {
    const config = {
      url: this.url.trim().replace(/\/$/, ''),
      publishableKey: this.publishableKey.trim(),
    };

    if (!config.url || !config.publishableKey) {
      throw new Error(this.i18n.t('connect.errorRequired'));
    }

    setStorageModeOverride('supabase');

    if (this.mode === 'guest') {
      await this.supabase.connectAsGuest(config);
      return;
    }
    if (!this.email.trim() || !this.password) {
      throw new Error(this.i18n.t('connect.errorHostAuth'));
    }
    await this.supabase.connectAsHost(
      config,
      this.email.trim(),
      this.password
    );
  }
}
