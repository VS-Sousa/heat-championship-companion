import { Injectable, computed, signal } from '@angular/core';
import { Lang, TRANSLATIONS } from './translations';

const STORAGE_KEY = 'heat_lang';

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<Lang>(this.readInitial());

  readonly dict = computed(() => TRANSLATIONS[this.lang()]);

  t(key: string, params?: Record<string, string | number>): string {
    let value = this.dict()[key] ?? TRANSLATIONS.en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(`{{${k}}}`, String(v));
      }
    }
    return value;
  }

  setLang(lang: Lang): void {
    this.lang.set(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang === 'pt-BR' ? 'pt-BR' : 'en';
  }

  toggle(): void {
    this.setLang(this.lang() === 'pt-BR' ? 'en' : 'pt-BR');
  }

  private readInitial(): Lang {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'pt-BR' || stored === 'en') {
      return stored;
    }
    const nav = navigator.language?.toLowerCase() ?? 'en';
    return nav.startsWith('pt') ? 'pt-BR' : 'en';
  }
}
