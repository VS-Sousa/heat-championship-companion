import { Component, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { ThemeService } from '../../core/services/theme.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PrefsBarComponent } from '../../shared/components/prefs-bar/prefs-bar.component';

@Component({
  selector: 'app-connect',
  standalone: true,
  imports: [FormsModule, NgClass, RouterLink, TranslatePipe, PrefsBarComponent],
  templateUrl: './connect.component.html',
  styleUrl: './connect.component.css',
})
export class ConnectComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  constructor() {
    inject(ThemeService);
  }

  url = '';
  publishableKey = '';
  email = '';
  password = '';
  mode: 'guest' | 'host' = 'guest';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);

    try {
      const config = {
        url: this.url.trim().replace(/\/$/, ''),
        publishableKey: this.publishableKey.trim(),
      };

      if (!config.url || !config.publishableKey) {
        throw new Error(this.i18n.t('connect.errorRequired'));
      }

      if (this.mode === 'guest') {
        await this.supabase.connectAsGuest(config);
      } else {
        if (!this.email.trim() || !this.password) {
          throw new Error(this.i18n.t('connect.errorHostAuth'));
        }
        await this.supabase.connectAsHost(
          config,
          this.email.trim(),
          this.password
        );
      }

      await this.router.navigateByUrl('/dashboard');
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : this.i18n.t('connect.errorFailed')
      );
    } finally {
      this.loading.set(false);
    }
  }
}
