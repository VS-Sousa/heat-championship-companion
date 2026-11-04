import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PrefsBarComponent } from '../../shared/components/prefs-bar/prefs-bar.component';
import { ThemeService } from '../../core/services/theme.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { SessionService } from '../../core/services/session.service';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, TranslatePipe, PrefsBarComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent {
  readonly session = inject(SessionService);
  private readonly supabase = inject(SupabaseService);

  constructor() {
    inject(ThemeService);
    inject(I18nService);
  }

  get isConnected(): boolean {
    return this.session.isConnected() && this.supabase.isReady();
  }
}
