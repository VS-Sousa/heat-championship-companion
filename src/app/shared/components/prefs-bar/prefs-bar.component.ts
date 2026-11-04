import { Component, inject } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-prefs-bar',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="flex items-center gap-2">
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
        class="heat-chip"
        (click)="theme.toggle()"
        [attr.aria-label]="'theme.toggle' | t"
      >
        {{ theme.mode() === 'dark' ? ('theme.light' | t) : ('theme.dark' | t) }}
      </button>
    </div>
  `,
})
export class PrefsBarComponent {
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);
}
