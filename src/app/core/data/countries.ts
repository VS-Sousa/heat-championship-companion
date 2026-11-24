import { SearchableSelectOption } from '../../shared/components/searchable-select/searchable-select.component';

/** Static ISO 3166-1 alpha-2 country codes (no CRUD). Names come from Intl.DisplayNames. */
export const ISO_COUNTRY_CODES: readonly string[] = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
  'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
  'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
  'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
  'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
  'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
  'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
  'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
  'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
  'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
  'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW',
];

const CODE_SET = new Set(ISO_COUNTRY_CODES);

export function flagEmoji(code: string): string {
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return '';
  return String.fromCodePoint(...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function displayLocale(lang: string): string {
  return lang === 'pt-BR' ? 'pt-BR' : 'en';
}

function displayNames(lang: string): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames([displayLocale(lang)], { type: 'region' });
  } catch {
    return null;
  }
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function isCountryCode(value: string): boolean {
  return CODE_SET.has(value.trim().toUpperCase());
}

export function countryName(code: string, lang: string): string {
  const upper = code.trim().toUpperCase();
  return displayNames(lang)?.of(upper) ?? upper;
}

/** Resolves an ISO code or a legacy free-text country name (en / pt-BR) to an ISO code. */
export function resolveCountryCode(value: string): string {
  const raw = value.trim();
  if (!raw) return '';
  if (isCountryCode(raw)) return raw.toUpperCase();
  const target = normalize(raw);
  for (const lang of ['en', 'pt-BR']) {
    const names = displayNames(lang);
    if (!names) continue;
    const match = ISO_COUNTRY_CODES.find((code) => {
      const name = names.of(code);
      return !!name && normalize(name) === target;
    });
    if (match) return match;
  }
  return '';
}

/** "🇧🇷 Brazil" for known countries; falls back to the stored text for unknown/legacy values. */
export function countryLabel(value: string, lang: string): string {
  const code = resolveCountryCode(value);
  if (!code) return value;
  const flag = flagEmoji(code);
  return `${flag} ${countryName(code, lang)}`.trim();
}

export function countryOptions(lang: string): SearchableSelectOption[] {
  return ISO_COUNTRY_CODES.map((code) => ({
    value: code,
    label: countryName(code, lang),
    prefix: flagEmoji(code),
    keywords: code,
  })).sort((a, b) => a.label.localeCompare(b.label, displayLocale(lang)));
}
