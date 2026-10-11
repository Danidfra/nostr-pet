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
 * and their guards stand: one use at a time (`use` returns false while one
 * is in flight), a fresh 31124 and a fresh balance read right before any
 * signature, an ambiguous publish never retried by itself. What this adds
 * is the room's choreography around them, the home's `offerItem` in 3D:
 *
 *   hand      food or drink given to the Blobbi: the use starts at once;
 *   set down  anything else (or food set on the floor): it lies there, the
 *             Blobbi walks to it (`approach`), and only on ARRIVAL does the
 *             use start. A walk replaced, stopped (a room switch, a tap
 *             elsewhere) or refused uses nothing and the item goes back.
 *
 * Then the celebration waits for the authoritative result AND for the use
 * to have been visible a moment (`MIN_USE_MS`): the face, a hop, the stat
 * chips and the sound come from what the write actually changed. Food and
 * drink are eaten first, and only then: once the write has landed, the
 * offer turns `eating` for a few bites (`EAT`), the munch playing with
 * them, and the celebration follows the last bite. Nothing is shown eaten
 * before the pipeline says it was. A failed
 * use leaves the item where it was with Retry (an explicit tap; an owned
 * spend resumes its own record rather than signing a new one) and Put away.
 *
 * Selecting, dragging, hovering, walking and putting away write nothing.
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
  /** Handed over, or lying on the floor of a room for the Blobbi to come to. */
  place: { kind: 'hand' } | { kind: 'floor'; x: number; z: number; roomId: RoomId };
  /** On its way, being used (the write out), eaten (the write landed: food and drink only), or failed. */
  phase: 'walking' | 'using' | 'eating' | 'failed';
  usingSince?: number;
  /** Eating: when it began, and how many bites it takes. */
  eatingSince?: number;
  bites?: number;
  /** Why the use failed, in words the player can act on. */
  error?: string;
}

export interface RoomCareFeedback {
  result: FeedbackResult;
  /** Changes with each result, so the chips replay. */
  key: number;
}

interface UseRoomCareOptions {
  /** Fewer, quicker bites when the player prefers less motion. */
  reducedMotion?: boolean;
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
  /** Something is on its way or being written: no second use, no decorating. */
  busy: boolean;
  /** Use an entry the way a drop or the Use button planned. False when it could not start (busy, not usable, nowhere to go). */
  use: (entry: RoomCareEntry, plan: DropPlan, roomId: RoomId) => boolean;
  /** Try a failed use again (the player's tap; never by itself). */
  retry: () => void;
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

export function useRoomCare({ blobbi, pubkey, updateCompanionEvent, refresh, nav, react, hop, reducedMotion = false }: UseRoomCareOptions): RoomCare {
  const inventory = useHomeInventory({ pubkey, blobbi });
  const useItem = useUseItem({ pubkey, known: inventory.items, updateCompanionEvent, invalidate: refresh });
  const useStarter = useStarterUse({ pubkey, updateCompanionEvent, invalidate: refresh });
  const care = useCareActions({ pubkey, updateCompanionEvent, invalidate: refresh });
  const { play } = useSound();
  const reducedMotionRef = useRef(false);
  reducedMotionRef.current = reducedMotion;

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
      // In the room an energy drink is sipped (the home keeps its cheer)
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

  /** The semantic use, from an offer that has reached the Blobbi. */
  const begin = useCallback(
    (key: number) => {
      const current = offerRef.current;
      if (!current || current.key !== key) return;
      setOffer({ ...current, phase: 'using', usingSince: Date.now(), error: undefined });
      const request = { blobbiD: liveBlobbi.current.d };
      const started = current.choice.source === 'owned' ? startOwned({ ...request, entry: current.choice.entry }) : startStarter({ ...request, entry: current.choice.entry });
      if (!started) setOffer((o) => (o && o.key === key ? { ...o, phase: 'failed', error: 'Another use is still finishing. Try again in a moment.' } : o));
    },
    [setOffer, startOwned, startStarter],
  );

  const busy = offer !== null || useItem.isPending || useStarter.isPending || care.isPending;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  const use = useCallback(
    (entry: RoomCareEntry, plan: DropPlan, roomId: RoomId): boolean => {
      // One at a time: a double tap, a second drop or a repeated pointer event finds this already set
      if (busyRef.current || offerRef.current || plan.kind === 'cancel' || !entry.usable) return false;
      busyRef.current = true;
      resetOwned();
      resetStarter();
      setNotice(null);
      const key = ++offerKeyRef.current;
      const base = { key, entryKey: entry.key, choice: entry.choice, name: entry.name };
      if (plan.kind === 'hand') {
        setOffer({ ...base, place: { kind: 'hand' }, phase: 'walking' });
        begin(key);
        return true;
      }
      const place = { kind: 'floor' as const, x: plan.x, z: plan.z, roomId };
      setOffer({ ...base, place, phase: 'walking' });
      if (!navRef.current.canWalk) {
        // Nobody walks here (no 3D room, an egg): the item is used where it is set down, as on the home
        begin(key);
        return true;
      }
      void navRef.current.approach(plan.x, plan.z).then((outcome) => {
        if (offerRef.current?.key !== key) return;
        if (outcome === 'arrived') {
          begin(key);
          return;
        }
        // Replaced, stopped or refused: nothing was used, the item goes back
        setOffer(null);
        if (outcome === 'refused') setNotice(`${liveBlobbi.current.name} can't get to that spot.`);
      });
      return true;
    },
    [begin, resetOwned, resetStarter, setOffer],
  );

  const retry = useCallback(() => {
    const current = offerRef.current;
    if (!current || current.phase !== 'failed') return;
    resetOwned();
    resetStarter();
    begin(current.key);
  }, [begin, resetOwned, resetStarter]);

  const putAway = useCallback(() => {
    const current = offerRef.current;
    // An item whose write is out (or that is being eaten) cannot be taken back; only a waiting or failed one
    if (!current || current.phase === 'using' || current.phase === 'eating') return;
    resetOwned();
    resetStarter();
    setOffer(null);
  }, [resetOwned, resetStarter, setOffer]);

  // The result: celebrated once the write landed and the use has shown for a moment
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUseResult = useCallback(
    (r: ItemUseResult | StarterUseResult) => {
      const finish = () => {
        finishTimer.current = null;
        const result: FeedbackResult = { action: r.action, name: r.name, statsChanged: r.statsChanged, xpGained: r.xpGained, nextState: 'active', itemName: r.item.name };
        // Food and drink are eaten (now that the write has landed), bite by bite, the munch with them; then the celebration
        const bites = r.alreadyApplied ? 0 : bitesFor(r.action, reducedMotionRef.current);
        if (bites > 0 && offerRef.current) {
          setOffer((o) => (o ? { ...o, phase: 'eating', eatingSince: Date.now(), bites } : o));
          play(r.action === 'boost' ? 'drink' : 'eat');
          finishTimer.current = setTimeout(() => {
            finishTimer.current = null;
            setOffer(null);
            celebrate(result, { soundPlayed: true });
          }, bites * EAT.biteMs);
          return;
        }
        setOffer(null);
        if (r.alreadyApplied) return;
        celebrate(result);
      };
      const remaining = MIN_USE_MS - (Date.now() - (offerRef.current?.usingSince ?? 0));
      if (remaining > 0) finishTimer.current = setTimeout(finish, remaining);
      else finish();
    },
    [celebrate, setOffer, play],
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
    setOffer((o) => (o && o.phase === 'using' ? { ...o, phase: 'failed', error: itemError.message } : o));
  }, [itemError, setOffer]);

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
    use,
    retry,
    putAway,
    rest,
    restPending: care.isPending || restWalking,
    feedback,
    error: care.error,
    notice,
    notify: setNotice,
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
