import { t } from '@/i18n';

/**
 * Why a write failed, in a line a player can read in their own language.
 *
 * When every relay refuses an event, the pool rejects with an AggregateError
 * whose own message is the runtime's "All promises were rejected": English,
 * whatever the language, and meaningless to a player. That case says the
 * relays did not accept it. Every other error the home throws for a write
 * (sign timeout, unconfirmed publish, a relay that cannot be reached) already
 * carries a translated message and is shown as it is. Never empty.
 */
export function describeWriteError(error: unknown): string {
  if (error instanceof AggregateError) return t('home.notice.notAccepted');
  if (error instanceof Error && error.message) return error.message;
  return t('home.notice.notAccepted');
}
