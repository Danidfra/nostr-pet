/**
 * The languages the game speaks, and which one a visitor gets.
 *
 * English is the source language: every string is written in English first
 * (`messages/en`), and the other languages are typed against it, so a key
 * missing from a translation fails the typecheck. The choice is this
 * device's: a stored choice wins, then the browser's languages in order,
 * then English. Nothing about the language is published.
 */
export const LOCALES = ['en', 'pt-BR', 'es'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Each language named in itself, so a player can find their own in any language. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  'pt-BR': 'Português (Brasil)',
  es: 'Español',
};

export const LOCALE_STORAGE_KEY = 'blobbi:locale:v1';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * The best supported language for a list of BCP 47 tags, in the order the
 * browser prefers them: an exact match, then the same language with another
 * region (`pt-PT` gets Brazilian Portuguese, `es-MX` Spanish), else English.
 */
export function matchLocale(tags: readonly string[]): Locale {
  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag) continue;
    const exact = LOCALES.find((l) => l.toLowerCase() === tag.toLowerCase());
    if (exact) return exact;
    const language = tag.split('-')[0].toLowerCase();
    const sameLanguage = LOCALES.find((l) => l.split('-')[0].toLowerCase() === language);
    if (sameLanguage) return sameLanguage;
  }
  return DEFAULT_LOCALE;
}

export function readStoredLocale(): Locale | null {
  try {
    const stored = typeof window === 'undefined' ? null : window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* the choice still applies until the page is closed */
  }
}

/** The language this visitor gets: their stored choice, else the browser's, else English. */
export function detectLocale(): Locale {
  const stored = readStoredLocale();
  if (stored) return stored;
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language ?? ''];
  return matchLocale(tags);
}
