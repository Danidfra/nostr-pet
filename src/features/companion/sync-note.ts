/**
 * The player's words about a choice not shared yet with their other Blobbi
 * games: plain, kind, no protocol terms (profile, relay, event, kind, d-tag).
 */
import type { SyncStatus } from './companion-sync';
import { t } from '@/i18n';

/** What the card says for a choice not shared yet (null: say nothing). */
export function syncNote(status: SyncStatus, name: string): string | null {
  if (status.kind !== 'waiting') return null;
  switch (status.reason) {
    case 'offline':
      return t('home.companion.note.offline', { name });
    case 'sign-failed':
      return t('home.companion.note.signFailed', { name });
    case 'partial':
      // Sent, and an automatic retry already on its way: nothing for the player to do
      if (status.retrying) return t('home.companion.note.retrying', { name });
      return t('home.companion.note.unknown', { name });
    default:
      return t('home.companion.note.unknown', { name });
  }
}
