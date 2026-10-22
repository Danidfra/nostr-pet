/**
 * The Worlds door for the home's top-left button (`worlds-access.ts`): open
 * or locked, from the guest record and the login, and the one-time word
 * once a save opens it.
 *
 * `useWatchWorldsAccess` notes the door on every change; it is mounted once,
 * beside the router (`WorldsAccessWatch`), so a save that moves the player
 * from one home to the other is still seen whole.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useGuest } from '@/features/guest';
import { useBlockingLayerOpen } from '@/lib/blocking-layer';
import { markWorldsGuideShown, noteWorldsAccess, subscribeWorldsGuide, worldsAccess, worldsGuideDue, type WorldsAccess } from './worlds-access';

/** The door now, and the key it is about. */
function useAccessNow(): { access: WorldsAccess; pubkey: string | undefined; saveOnScreen: boolean } {
  const guest = useGuest();
  const stage = guest.doc?.migration?.stage ?? null;
  const access = worldsAccess(guest.mode, stage);
  // The guest's own key while a guest plays; the signed-in account's otherwise
  const pubkey = guest.mode === 'active' ? guest.doc?.identity.pubkey : guest.loginPubkey;
  // A save on screen (under way, or its celebration until the player leaves it): the word waits for the home
  const saveOnScreen = guest.mode === 'promoting' && stage !== null;
  return { access, pubkey, saveOnScreen };
}

export function useWatchWorldsAccess(): void {
  const { access, pubkey } = useAccessNow();
  useEffect(() => {
    noteWorldsAccess({ access, pubkey });
  }, [access, pubkey]);
}

export interface WorldsDoor {
  access: WorldsAccess;
  locked: boolean;
  /** The one-time word is showing: the button glows and its bubble says the worlds are open. */
  guide: boolean;
  /** Put the word away (the button was tapped, something else was, or it waited long enough). */
  endGuide: () => void;
}

export function useWorldsAccess(): WorldsDoor {
  const { access, pubkey, saveOnScreen } = useAccessNow();
  const due = useSyncExternalStore(subscribeWorldsGuide, worldsGuideDue, worldsGuideDue);
  const blocking = useBlockingLayerOpen();
  // The account the word is showing for: another account, or the door locked again, and it is not this one's
  const [guideFor, setGuideFor] = useState<string | null>(null);
  // The word shows once the home is quiet (no save on screen, no sheet over the world), and is remembered at once
  const ready = access === 'open' && !!pubkey && due === pubkey && !saveOnScreen && !blocking;
  useEffect(() => {
    if (!ready || !pubkey) return;
    markWorldsGuideShown(pubkey);
    setGuideFor(pubkey);
  }, [ready, pubkey]);
  const endGuide = useCallback(() => setGuideFor(null), []);
  return { access, locked: access !== 'open', guide: access === 'open' && !!pubkey && guideFor === pubkey, endGuide };
}
