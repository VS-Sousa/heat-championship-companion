import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { I18nService } from './core/i18n/i18n.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  styles: [
    `
      :host {
        display: block;
        min-height: 100%;
      }
    `,
  ],
})
export class AppComponent {
  constructor() {
    const theme = inject(ThemeService);
    const i18n = inject(I18nService);
    document.documentElement.setAttribute('data-theme', theme.mode());
    document.documentElement.lang = i18n.lang() === 'pt-BR' ? 'pt-BR' : 'en';
  }
}
