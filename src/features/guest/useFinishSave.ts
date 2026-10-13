/**
 * A save the ceremony did not get to finish: the record says `verifying`
 * (published, not yet read back) or `done` (read back, the celebration
 * interrupted by a refresh). The home, when it MOUNTS with the saved account
 * signed in, finishes it: a read for `verifying`, and the record let go once
 * the relays confirm; for `done`, let go at once. Nothing is published here.
 *
 * On mount only: while the ceremony is on screen it owns these stages, and
 * the record stays for the celebration until the player leaves the scene.
 */
import { useEffect, useRef } from 'react';
import { useNostr } from '@nostrify/react';
import { verifyGuestMigration } from './guest-migration';
import { useGuest } from './useGuest';

export function useFinishSave(): void {
  const guest = useGuest();
  const { nostr } = useNostr();
  const atMount = useRef({ mode: guest.mode, doc: guest.doc });
  const clear = guest.clear;
  // Once, at mount: a later change of the record is the ceremony's, never this hook's to answer
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    const { mode, doc } = atMount.current;
    if (mode !== 'promoting' || !doc?.migration) return;
    if (doc.migration.stage === 'done') {
      clear();
      return;
    }
    if (doc.migration.stage !== 'verifying') return;
    let cancelled = false;
    verifyGuestMigration(doc, nostr)
      .then((ok) => {
        if (ok && !cancelled) clear();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [nostr, clear]);
}
