import { nip19 } from 'nostr-tools';

/** `npub1abcd…wxyz` for a hex pubkey; the hex itself, shortened, if encoding fails. */
export function shortNpub(pubkey: string): string {
  try {
    const npub = nip19.npubEncode(pubkey);
    return `${npub.slice(0, 9)}…${npub.slice(-4)}`;
  } catch {
    return `${pubkey.slice(0, 8)}…`;
  }
}

/** "3 minutes ago" style relative time for a unix-seconds timestamp. */
export function formatRelativeTime(unixSeconds: number, now: number = Math.floor(Date.now() / 1000)): string {
  const delta = Math.max(0, now - unixSeconds);
  if (delta < 60) return 'just now';
  const minutes = Math.floor(delta / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}
