/**
 * Care in the 3D room: one adapter over the home's own write paths.
 *
 * Nothing here publishes, plans an effect or touches a balance. An item is
 * used through the hooks the 2D home uses, unchanged:
 *
 *   owned    `useUseItem`     kind 1416 spend → 31124 (`blobbi_op`) → 1124,
 *                             ledgered, resumed, never re-signed
 *   starter  `useStarterUse`  31124 → 1124, nothing spent
 *   rest     `useCareActions` 31124 → 1124 (sleep or wake)
 *
 * and their guards stand: one use at a time, a fresh 31124 and a fresh
 * balance read right before any signature, an ambiguous publish never
 * retried by itself. What this adds is the room's bookkeeping of an item
 * on its way to the Blobbi (`RoomOffer`), in four moments the room's
 * interaction director (`useRoomInteractions`) plays out around it:
 *
 *   place     the item is set down in the room (`walking`): nothing is used;
 *             it can still be taken back (`putAway`) or replaced
 *   begin     the Blobbi has reached it: the semantic use starts (`using`)
 *             and `begin` resolves when it has landed (never before), or
 *             failed; a landed use was visible at least `MIN_USE_MS`
 *   eating    food and drink, once landed: bite by bite (`eating`), the
 *             director's choreography, nothing more written
 *   finish    the offer is cleared and the result celebrated: the face, a
 *             hop, the stat chips and the sound come from what the write
 *             actually changed. Nothing is shown eaten or celebrated before
 *             the pipeline says it was.
 *
 * A failed use leaves the item where it was with Retry (an explicit tap; an
 * owned spend resumes its own record rather than signing a new one) and Put
 * away. Selecting, placing, walking and putting away write nothing.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BlobbiCompanion, NostrEvent } from '@blobbi-kit/core';
import type { BlobbiEmotion } from '@blobbi-kit/renderer';

import { useCareActions, type CareResult } from '@/features/care';
import { useHomeInventory, useStarterUse, useUseItem, type HomeInventory, type ItemUseResult, type StarterUseResult } from '@/features/inventory';
import { soundForCare, useSound } from '@/features/sound';
import type { FeedbackResult } from '@/features/home/care-feedback-text';
import { MIN_USE_MS, reactionForCare } from '@/features/home/scene/reactions';
import type { CareChoice } from '@/features/home/care-model';
import type { RoomId } from '@/features/home/rooms/rooms';
import type { RoomNavigation } from './useRoomNavigation';
import type { RoomCareEntry, DropPlan } from '../lib/room-care';

/** An item on its way to the Blobbi, and where its use stands. */
export interface RoomOffer {
  key: number;
  entryKey: string;
  choice: CareChoice;
  name: string;
  /** Where it lies in the room, for the Blobbi to come to. */
  place: { kind: 'floor'; x: number; z: number; roomId: RoomId };
  /** Set down and waited for, being used (the write out), eaten (the write landed: food and drink only), or failed. */
  phase: 'walking' | 'using' | 'eating' | 'failed';
  usingSince?: number;
  /** Eating: when it began, and how many bites it takes. */
  eatingSince?: number;
  bites?: number;
  /** Why the use failed, in words the player can act on. */
  error?: string;
}

export type UseResult = ItemUseResult | StarterUseResult;

/** How a begun use ended: landed (with what it did), or failed (the offer stays, with Retry and Put away). */
export type UseOutcome = { kind: 'landed'; result: UseResult; feedback: FeedbackResult } | { kind: 'failed'; error: string };

export interface RoomCareFeedback {
  result: FeedbackResult;
  /** Changes with each result, so the chips replay. */
  key: number;
}

interface UseRoomCareOptions {
  blobbi: BlobbiCompanion;
  pubkey: string | undefined;
  updateCompanionEvent: (event: NostrEvent) => void;
  refresh: () => void;
  nav: Pick<RoomNavigation, 'approach' | 'canWalk'>;
  /** The room's own reactions: a face on the 2D drawing, a hop either way. */
  react: (emotion: BlobbiEmotion | null) => void;
  hop: () => void;
}

export interface RoomCare {
  inventory: HomeInventory;
  offer: RoomOffer | null;
  /** A write is out or being eaten: no second use, no decorating. */
  busy: boolean;
  /**
   * Set an item down in the room for the Blobbi (`walking`); nothing is used. Null when it cannot be placed (a
   * write is out, the item is not usable, nowhere to put it). An item already waiting is replaced.
   */
  place: (entry: RoomCareEntry, plan: DropPlan, roomId: RoomId) => RoomOffer | null;
  /** Start the semantic use of a placed offer; resolves when it has landed (visible at least `MIN_USE_MS`) or failed. */
  begin: (key: number) => Promise<UseOutcome>;
  /** Food and drink, landed: now being eaten, in so many bites. */
  startEating: (key: number, bites: number) => void;
  /** The offer is over: cleared, and its result celebrated (the chips, the face, the hop, the sound). */
  finish: (key: number, outcome?: { feedback: FeedbackResult; alreadyApplied?: boolean; soundPlayed?: boolean }) => void;
  /** Take a waiting or failed offer back (a cancelled walk, a change of room, Put away); nothing is used. */
  clear: (key?: number) => void;
  /** Try a failed use again (the player's tap; never by itself). Resolves like `begin`. */
  retry: () => Promise<UseOutcome> | null;
  /** Take a failed or waiting item back; nothing is used. */
  putAway: () => void;
  /** Sleep (walking to the bed first, when one is given) or wake. */
  rest: (bed: { x: number; z: number } | null) => void;
  restPending: boolean;
  feedback: RoomCareFeedback | undefined;
  /** A failed rest write, or a short notice (a walk that could not reach the item). */
  error: Error | null;
  notice: string | null;
  /** Say something short (why an item cannot be used now). */
  notify: (text: string) => void;
  /** The celebration alone (the dev previews, which write nothing). */
  celebrate: (result: FeedbackResult, options?: { soundPlayed?: boolean }) => void;
}

/** How long a notice stays. */
const NOTICE_MS = 3_200;

/**
 * Eating, once a use of food or drink has landed: bites of the home's munch (Ditto's chew cycle, 300 ms a
 * bite: the mouth open on it, then closed), four for food and two sips for a drink; one quick bite under reduced
 * motion. Everything else is used without eating.
 */
export const EAT = { biteMs: 300, openMs: 120, food: 4, drink: 2 } as const;

export function bitesFor(action: string, reducedMotion: boolean): number {
  if (action !== 'feed' && action !== 'boost') return 0;
  if (reducedMotion) return 1;
  return action === 'boost' ? EAT.drink : EAT.food;
}

export function useRoomCare({ blobbi, pubkey, updateCompanionEvent, refresh, nav, react, hop }: UseRoomCareOptions): RoomCare {
  const inventory = useHomeInventory({ pubkey, blobbi });
  const useItem = useUseItem({ pubkey, known: inventory.items, updateCompanionEvent, invalidate: refresh });
  const useStarter = useStarterUse({ pubkey, updateCompanionEvent, invalidate: refresh });
  const care = useCareActions({ pubkey, updateCompanionEvent, invalidate: refresh });
  const { play } = useSound();

  const [offer, setOfferState] = useState<RoomOffer | null>(null);
  const offerRef = useRef<RoomOffer | null>(null);
  const setOffer = useCallback((next: RoomOffer | null | ((prev: RoomOffer | null) => RoomOffer | null)) => {
    const value = typeof next === 'function' ? next(offerRef.current) : next;
    offerRef.current = value;
    setOfferState(value);
  }, []);
  const offerKeyRef = useRef(0);
  const liveBlobbi = useRef(blobbi);
  liveBlobbi.current = blobbi;
  const navRef = useRef(nav);
  navRef.current = nav;

  const [feedback, setFeedback] = useState<RoomCareFeedback | undefined>(undefined);
  const feedbackKeyRef = useRef(0);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const celebrate = useCallback(
    (result: FeedbackResult, options: { soundPlayed?: boolean } = {}) => {
      feedbackKeyRef.current += 1;
      setFeedback({ result, key: feedbackKeyRef.current });
      react(reactionForCare(result.action, result.nextState));
      if (result.nextState === 'active') hop();
      // In the room an energy drink is sipped (the home keeps its cheer); food's munch and play's cheer are the director's
      const sound = result.action === 'boost' ? 'drink' : soundForCare(result.action, result.nextState);
      if (sound && !options.soundPlayed) play(sound);
    },
    [react, hop, play],
  );

  // ─── Using an item ───
  const startOwned = useItem.use;
  const startStarter = useStarter.use;
  const resetOwned = useItem.reset;
  const resetStarter = useStarter.reset;

  /** Who waits for the begun use of an offer to land or fail. */
  const outcomes = useRef(new Map<number, (outcome: UseOutcome) => void>());
  const settleOutcome = useCallback((key: number, outcome: UseOutcome) => {
    const waiting = outcomes.current.get(key);
    outcomes.current.delete(key);
    waiting?.(outcome);
  }, []);

  const begin = useCallback(
    (key: number): Promise<UseOutcome> => {
      const current = offerRef.current;
      if (!current || current.key !== key) return Promise.resolve({ kind: 'failed', error: 'That item is no longer here.' });
      return new Promise<UseOutcome>((resolve) => {
        outcomes.current.set(key, resolve);
        setOffer({ ...current, phase: 'using', usingSince: Date.now(), error: undefined });
        const request = { blobbiD: liveBlobbi.current.d };
        const started = current.choice.source === 'owned' ? startOwned({ ...request, entry: current.choice.entry }) : startStarter({ ...request, entry: current.choice.entry });
        if (!started) {
          const error = 'Another use is still finishing. Try again in a moment.';
          setOffer((o) => (o && o.key === key ? { ...o, phase: 'failed', error } : o));
          settleOutcome(key, { kind: 'failed', error });
        }
      });
    },
    [setOffer, startOwned, startStarter, settleOutcome],
  );

  const writing = offer !== null && (offer.phase === 'using' || offer.phase === 'eating');
  const busy = writing || useItem.isPending || useStarter.isPending || care.isPending;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  const clear = useCallback(
    (key?: number) => {
      const current = offerRef.current;
      if (!current || (key !== undefined && current.key !== key)) return;
      // An item whose write is out (or that is being eaten) cannot be taken back; only a waiting or failed one
      if (current.phase === 'using' || current.phase === 'eating') return;
      resetOwned();
      resetStarter();
      outcomes.current.delete(current.key);
      setOffer(null);
    },
    [resetOwned, resetStarter, setOffer],
  );

  const place = useCallback(
    (entry: RoomCareEntry, plan: DropPlan, roomId: RoomId): RoomOffer | null => {
      if (plan.kind === 'cancel' || !entry.usable) return null;
      // One at a time: a write out, a double tap or a repeated pointer event finds this already set
      const current = offerRef.current;
      if (busyRef.current || useItem.isPending || useStarter.isPending || care.isPending) return null;
      if (current && (current.phase === 'using' || current.phase === 'eating')) return null;
      // An item waiting (or failed) is replaced by the next one chosen; the same item again is already there
      if (current && current.entryKey === entry.key && current.phase === 'walking') return null;
      if (current) clear(current.key);
      resetOwned();
      resetStarter();
      setNotice(null);
      const key = ++offerKeyRef.current;
      const next: RoomOffer = { key, entryKey: entry.key, choice: entry.choice, name: entry.name, place: { kind: 'floor', x: plan.x, z: plan.z, roomId }, phase: 'walking' };
      setOffer(next);
      return next;
    },
    [clear, resetOwned, resetStarter, setOffer, useItem.isPending, useStarter.isPending, care.isPending],
  );

  const startEating = useCallback(
    (key: number, bites: number) => {
      setOffer((o) => (o && o.key === key ? { ...o, phase: 'eating', eatingSince: Date.now(), bites } : o));
    },
    [setOffer],
  );

  const finish = useCallback(
    (key: number, outcome?: { feedback: FeedbackResult; alreadyApplied?: boolean; soundPlayed?: boolean }) => {
      const current = offerRef.current;
      if (current && current.key === key) {
        outcomes.current.delete(key);
        setOffer(null);
      }
      if (!outcome || outcome.alreadyApplied) return;
      celebrate(outcome.feedback, { soundPlayed: outcome.soundPlayed });
    },
    [celebrate, setOffer],
  );

  const retry = useCallback((): Promise<UseOutcome> | null => {
    const current = offerRef.current;
    if (!current || current.phase !== 'failed') return null;
    resetOwned();
    resetStarter();
    return begin(current.key);
  }, [begin, resetOwned, resetStarter]);

  const putAway = useCallback(() => clear(), [clear]);

  // The result: handed to whoever began the use, once the write landed and the use has shown for a moment
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUseResult = useCallback(
    (r: UseResult) => {
      const current = offerRef.current;
      if (!current) return;
      const key = current.key;
      const land = () => {
        finishTimer.current = null;
        const feedback: FeedbackResult = { action: r.action, name: r.name, statsChanged: r.statsChanged, xpGained: r.xpGained, nextState: 'active', itemName: r.item.name };
        if (outcomes.current.has(key)) settleOutcome(key, { kind: 'landed', result: r, feedback });
        else {
          // Nobody is waiting (the director is gone): the offer ends here, celebrated unless it had already landed before
          setOffer((o) => (o && o.key === key ? null : o));
          if (!r.alreadyApplied) celebrate(feedback);
        }
      };
      const remaining = MIN_USE_MS - (Date.now() - (current.usingSince ?? 0));
      if (remaining > 0) finishTimer.current = setTimeout(land, remaining);
      else land();
    },
    [celebrate, setOffer, settleOutcome],
  );
  useEffect(() => () => {
    if (finishTimer.current) clearTimeout(finishTimer.current);
  }, []);
  useLatest(useItem.lastResult, onUseResult);
  useLatest(useStarter.lastResult, onUseResult);

  // A use failed: the item stays where it was, with Retry and Put away
  const itemError = useItem.error ?? useStarter.error;
  useEffect(() => {
    if (!itemError) return;
    const current = offerRef.current;
    if (!current || current.phase !== 'using') return;
    setOffer({ ...current, phase: 'failed', error: itemError.message });
    settleOutcome(current.key, { kind: 'failed', error: itemError.message });
  }, [itemError, setOffer, settleOutcome]);

  // ─── Rest ───
  const perform = care.perform;
  const [restWalking, setRestWalking] = useState(false);
  const rest = useCallback(
    (bed: { x: number; z: number } | null) => {
      if (busyRef.current || restWalking) return;
      const b = liveBlobbi.current;
      // Waking, an egg, or no bed in this room: rest where it is
      if (b.state === 'sleeping' || b.stage === 'egg' || !bed || !navRef.current.canWalk) {
        perform(b.d, 'rest');
        return;
      }
      setRestWalking(true);
      void navRef.current.approach(bed.x, bed.z).then((outcome) => {
        setRestWalking(false);
        // Only on arrival, and only if still awake: the walk alone writes nothing
        if (outcome === 'arrived' && liveBlobbi.current.state === 'active') perform(liveBlobbi.current.d, 'rest');
      });
    },
    [perform, restWalking],
  );
  useLatest(care.lastResult, (r: CareResult) => celebrate({ action: r.action, name: r.name, statsChanged: r.statsChanged, xpGained: r.xpGained, nextState: r.nextState }));

  return {
    inventory,
    offer,
    busy: busy || restWalking,
    place,
    begin,
    startEating,
    finish,
    clear,
    retry,
    putAway,
    rest,
    restPending: care.isPending || restWalking,
    feedback,
    error: care.error,
    notice,
    notify: setNotice,
    celebrate,
  };
}

/** Call `handle` once per new value of `value` (a mutation's latest result). */
function useLatest<T>(value: T | undefined, handle: (value: T) => void) {
  const handled = useRef<T | undefined>(undefined);
  const handleRef = useRef(handle);
  handleRef.current = handle;
  useEffect(() => {
    if (value === undefined || handled.current === value) return;
    handled.current = value;
    handleRef.current(value);
  }, [value]);
}
