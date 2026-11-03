import { Component, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-connect',
  standalone: true,
  imports: [FormsModule, NgClass],
  templateUrl: './connect.component.html',
  styleUrl: './connect.component.css',
})
export class ConnectComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  url = '';
  anonKey = '';
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
        anonKey: this.anonKey.trim(),
      };

      if (!config.url || !config.anonKey) {
        throw new Error('Supabase URL and anon key are required.');
      }

      if (this.mode === 'guest') {
        await this.supabase.connectAsGuest(config);
      } else {
        if (!this.email.trim() || !this.password) {
          throw new Error('Email and password are required for host access.');
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
        err instanceof Error ? err.message : 'Connection failed. Try again.'
      );
    } finally {
      this.loading.set(false);
    }
  }
}
