/**
 * Translation at runtime: one language per page load.
 *
 * The language is chosen before the app renders (`loadLocale` in `main.tsx`)
 * and does not change while the page lives; choosing another one in the menu
 * stores it and reloads (`changeLocale`). That keeps `t()` a plain function,
 * usable in components, hooks and plain modules alike, with nothing to
 * subscribe to and no tree to re-render. Tests never load a language and get
 * English.
 */
import { en } from './messages/en';
import { DEFAULT_LOCALE, type Locale, writeStoredLocale } from './locales';
import type { MessageKey, MessageParams, Messages, PluralKey } from './types';

let currentLocale: Locale = DEFAULT_LOCALE;
let currentMessages: Messages = en;

const loaders: Record<Exclude<Locale, 'en'>, () => Promise<Messages>> = {
  'pt-BR': () => import('./messages/pt-BR').then((m) => m.ptBR),
  es: () => import('./messages/es').then((m) => m.es),
};

function applyDocumentLanguage(locale: Locale): void {
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}

/** Use these messages for this page load (tests may call it with a language's messages directly). */
export function setMessages(locale: Locale, messages: Messages): void {
  currentLocale = locale;
  currentMessages = messages;
  applyDocumentLanguage(locale);
}

/** Load a language's messages before the first render. A language that fails to load leaves the page in English. */
export async function loadLocale(locale: Locale): Promise<void> {
  if (locale === 'en') {
    setMessages('en', en);
    return;
  }
  try {
    setMessages(locale, await loaders[locale]());
  } catch {
    setMessages('en', en);
  }
}

export function getLocale(): Locale {
  return currentLocale;
}

/** Store another language and reload into it. `reload` is a test seam. */
export function changeLocale(locale: Locale, reload: () => void = () => window.location.reload()): void {
  writeStoredLocale(locale);
  if (locale !== currentLocale) reload();
}

function lookup(messages: Messages, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(message: string, params?: MessageParams): string {
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/** The message for `key` in this page's language (English where a translation has none), with `{placeholders}` filled. */
export function t(key: MessageKey, params?: MessageParams): string {
  const message = lookup(currentMessages, key) ?? lookup(en, key) ?? key;
  return interpolate(message, params);
}

const pluralRules = new Map<Locale, Intl.PluralRules>();

/** A message with plural forms: `tp('home.streak', 3)` reads `home.streak_other` in English. `{count}` is filled with the number. */
export function tp(key: PluralKey, count: number, params?: MessageParams): string {
  let rules = pluralRules.get(currentLocale);
  if (!rules) {
    rules = new Intl.PluralRules(currentLocale);
    pluralRules.set(currentLocale, rules);
  }
  const form = rules.select(count);
  const all = { count: formatNumber(count), ...params };
  const message = lookup(currentMessages, `${key}_${form}`) ?? lookup(currentMessages, `${key}_other`) ?? lookup(en, `${key}_${form}`) ?? lookup(en, `${key}_other`) ?? key;
  return interpolate(message, all);
}

/** A number written the way this page's language writes it. */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(currentLocale, options).format(value);
}
