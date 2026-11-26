import { getLocale, t, type MessageKey } from '@/i18n';

/**
 * Words that come from outside the app (an item's name in its Nostr event, a
 * kit mission's title) in the page's language: English shows them exactly as
 * they came; another language shows its translation when it has one for
 * `key`, and the original words otherwise (an item or mission it does not know).
 */
export function translatedOr(key: string, original: string): string {
  if (getLocale() === 'en') return original;
  const message = t(key as MessageKey);
  return message === key ? original : message;
}
