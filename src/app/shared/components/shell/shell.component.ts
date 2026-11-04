import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../../../core/services/session.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ThemeService } from '../../../core/services/theme.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { PrefsBarComponent } from '../prefs-bar/prefs-bar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    NgClass,
    TranslatePipe,
    PrefsBarComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  readonly session = inject(SessionService);
  readonly i18n = inject(I18nService);
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  constructor() {
    inject(ThemeService);
  }

  menuOpen = false;

  readonly links = [
    { path: '/dashboard', labelKey: 'nav.dashboard', icon: 'dashboard', hostOnly: false },
    {
      path: '/championships',
      labelKey: 'nav.championships',
      icon: 'championships',
      hostOnly: false,
    },
    { path: '/drivers', labelKey: 'nav.drivers', icon: 'drivers', hostOnly: false },
    { path: '/cars', labelKey: 'nav.cars', icon: 'cars', hostOnly: false },
    { path: '/tracks', labelKey: 'nav.tracks', icon: 'tracks', hostOnly: false },
    { path: '/log-race', labelKey: 'nav.logRace', icon: 'logRace', hostOnly: true },
  ];

  visibleLinks() {
    return this.links.filter((link) => !link.hostOnly || this.session.isHost());
  }

  roleLabel(): string {
    return this.i18n.t(`role.${this.session.role()}`);
  }

  displayName(): string {
    if (!this.session.session()?.user) {
      return this.i18n.t('role.guest');
    }
    return this.session.username();
  }

  async disconnect(): Promise<void> {
    await this.supabase.disconnect();
    await this.router.navigateByUrl('/');
  }
}
