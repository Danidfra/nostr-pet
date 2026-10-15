/**
 * The player's words about a choice not shared yet with their other Blobbi
 * games: plain, kind, no protocol terms (profile, relay, event, kind, d-tag).
 */
import type { SyncStatus } from './companion-sync';

/** What the card says for a choice not shared yet (null: say nothing). */
export function syncNote(status: SyncStatus, name: string): string | null {
  if (status.kind !== 'waiting') return null;
  switch (status.reason) {
    case 'offline':
      return `You're offline. Your other Blobbi games will meet ${name} when you're back.`;
    case 'sign-failed':
      return `Your sign-in app didn't say yes, so your other Blobbi games don't know about ${name} yet.`;
    default:
      return `Your other Blobbi games don't know about ${name} yet.`;
  }
}
