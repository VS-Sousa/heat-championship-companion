import { Component, inject } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-prefs-bar',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="flex items-center gap-1.5 sm:gap-2">
      <button
        type="button"
        class="heat-chip"
        (click)="i18n.toggle()"
        [attr.aria-label]="'lang.toggle' | t"
      >
        {{ i18n.lang() === 'pt-BR' ? 'EN' : 'PT' }}
      </button>
      <button
        type="button"
        class="heat-chip inline-flex items-center gap-1.5"
        (click)="theme.toggle()"
        [attr.aria-label]="'theme.toggle' | t"
        [attr.title]="theme.mode() === 'dark' ? ('theme.light' | t) : ('theme.dark' | t)"
      >
        <svg
          class="h-3.5 w-3.5 sm:hidden"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          @if (theme.mode() === 'dark') {
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          } @else {
            <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5Z" />
          }
        </svg>
        <span class="hidden sm:inline">{{
          theme.mode() === 'dark' ? ('theme.light' | t) : ('theme.dark' | t)
        }}</span>
      </button>
    </div>
  `,
})
export class PrefsBarComponent {
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);
}
