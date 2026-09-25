/**
 * A new Nostr account, made the way the rest of the ecosystem makes one.
 *
 * The key comes from nostr-tools (`generateSecretKey`, the same primitive
 * Ditto's and Island's signup dialogs call); it is encoded with `nip19`.
 * Nothing here invents cryptography, keeps a copy, logs, or sends anything.
 * The nsec string lives in the signup screen's state until the player has
 * confirmed a backup and signs in with it; the login store (nostrify's
 * `NostrLoginProvider`, the same store Ditto and Island use) holds it from
 * then on.
 *
 * What the player must understand, and what the screens say plainly: the
 * secret key IS the account. Whoever has it controls the account; losing it
 * can mean losing the account, because there is no reset.
 */
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

export interface NewAccount {
  /** The secret key, bech32 (`nsec1…`). The only thing to back up. */
  nsec: string;
  /** The public identity (`npub1…`), safe to show anywhere. */
  npub: string;
  pubkey: string;
}

export function createNewAccount(): NewAccount {
  const sk = generateSecretKey();
  const pubkey = getPublicKey(sk);
  const nsec = nip19.nsecEncode(sk);
  sk.fill(0);
  return { nsec, npub: nip19.npubEncode(pubkey), pubkey };
}

/** True for a well-formed nsec (shape and checksum). */
export function isNsec(value: string): value is `nsec1${string}` {
  if (!/^nsec1[a-z0-9]{58}$/.test(value)) return false;
  try {
    return nip19.decode(value).type === 'nsec';
  } catch {
    return false;
  }
}

/** The nsec in a pasted or uploaded text, if there is exactly one. */
export function readNsecFromText(text: string): string | null {
  const found = text.match(/nsec1[a-z0-9]{58}/g) ?? [];
  const unique = [...new Set(found)];
  if (unique.length !== 1) return null;
  return isNsec(unique[0]) ? unique[0] : null;
}

/** The public identity for an nsec. */
export function npubForNsec(nsec: string): string {
  const decoded = nip19.decode(nsec);
  if (decoded.type !== 'nsec') throw new Error('Not an nsec');
  return nip19.npubEncode(getPublicKey(decoded.data));
}

export const NSEC_BACKUP_MIME = 'text/plain; charset=utf-8';

/**
 * `blobbi-nostr-key-backup-<8 npub chars>.txt`: Island's convention, so a
 * backup made here and one made there look the same and are told apart by
 * the public suffix, never by anything secret in the name. The content is
 * the bare nsec and nothing else: what the sign-in screen's file picker
 * expects back.
 */
export function nsecBackupFilename(nsec: string): string {
  const npub = npubForNsec(nsec);
  return `blobbi-nostr-key-backup-${npub.slice(5, 13)}.txt`;
}

/**
 * Hand the backup to the browser as a file download through a short-lived
 * object URL (never a `data:` URL: the key must not appear in any URL). The
 * download is refused, not degraded, where object URLs do not exist.
 */
export function downloadNsecBackup(nsec: string, doc: Document = document): boolean {
  const url = globalThis.URL;
  if (typeof url?.createObjectURL !== 'function') return false;
  const blob = new Blob([nsec], { type: NSEC_BACKUP_MIME });
  const href = url.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = href;
  a.download = nsecBackupFilename(nsec);
  a.rel = 'noopener';
  doc.body.appendChild(a);
  a.click();
  doc.body.removeChild(a);
  setTimeout(() => url.revokeObjectURL(href), 1_000);
  return true;
}
