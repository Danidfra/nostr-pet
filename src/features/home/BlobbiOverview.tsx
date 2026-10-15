import { useDailyXp } from '@/features/progression/useDailyXp';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProjectedBlobbiState } from '@blobbi-kit/react';
import { getStatStatus, getVisibleStats, type BlobbiCompanion, type BlobbonautProfile, type NostrEvent } from '@blobbi-kit/core';
import { MapPin } from 'lucide-react';

import { availableCareActions, useCareActions, type CareAction, type CareResult } from '@/features/care';
import { hatchOnScreen, useFirstBlobbiHatch, useLifecycle, useLifecycleCeremony, type CeremonyKind, type HatchBeat } from '@/features/lifecycle';
import { InventorySheet, ItemGlyph, useHomeInventory, useStarterUse, useUseItem, useWornEquipment, type ItemGlyphModel, type ItemUseResult, type StarterUseResult } from '@/features/inventory';
import type { BlobbiVisualEffect } from '@blobbi-kit/renderer';
import { soundForCare, soundForPoke, soundForReveal, useSound } from '@/features/sound';
import { BLOBBI_ISLAND_URL } from '@/config/ecosystem';
import type { StatItem } from './BlobbiStatusPanel';
import { CareError, CareFeedback } from './CareFeedback';
import type { FeedbackResult } from './care-feedback-text';
import { describeMood } from './mood';
import { type CareChoice, type CareVerb } from './care-model';
import { homeCareEntries, ownedEntry, type CareEntry } from '@/features/care-ui/care-entries';
import { detectStreakIncrease, flameDays, type StreakChange } from './streak';
import { useCareGiven } from '@/features/journey/care-receipts';
import { HOME_SPACE, STAGE_OBJECTS, type StageObjectKind } from './space/home-space';
import { FurnitureLayer, RoomBackdrop, approachSpot, surfaceBackground, type Placement } from './rooms';
import { BathToolBar, BathTouchLayer, BathTub2D, useBathSession, type BathCommitOutcome } from '@/features/bath';
import { MEDICINE_FACE, MEDICINE_MOMENT, MedicineDose, medicineRefusal, type MedicinePhase } from './medicine';
import { GESTURES } from './scene/gestures';
import type { ActiveGesture } from './scene/useReactionPolicy';
import type { ExpressionName } from '@/features/expression/faces';
import type { EyeOffset } from './scene/gaze';
import type { PokeGesture } from './personality';
import type { Run } from '@/features/room/lib/room-interaction';
import {
  BlobbiActor,
  DoorArt,
  HomeScene,
  NeedBubbles,
  SceneObjectView,
  itemObjectAt,
  sceneObject,
  useBlobbiPresentation,
  useReducedMotion,
  MIN_USE_MS,
  OFFER_SPOT,
  OFFER_APPROACH,
  clampToFloor,
  placeOnFloor,
  type FloorPoint,
} from './scene';
import { ActionBar, BlobbiSheet, CareOptions, GameShell, HudTop, MenuSheet } from './shell';
import { ModeToggle } from './shell/ModeToggle';
import { useModeSwitch } from './shell/useModeSwitch';
import { StreakMoment } from './StreakMoment';
import { HatchTheater } from '@/features/room/components/HatchTheater';
import { useGuest, useGuestUi, useSaveInvite } from '@/features/guest';
import { GuestInvite } from '@/features/guest/GuestInvite';
import { GuestStatusPill, GuestStatusSheet, SavedPill } from '@/features/guest/GuestStatus';
import { useJourney } from '@/features/journey/useJourney';
import { JourneySheet } from '@/features/journey/JourneySheet';
import type { ObjectiveAction } from '@/features/journey/journey';
import { WorldsSheet } from '@/features/worlds/WorldsSheet';
import type { LifecycleTask } from '@/features/lifecycle';
import type { HealthLevel } from '@/lib/relay-health';

interface BlobbiOverviewProps {
  blobbi: BlobbiCompanion;
  companions: readonly BlobbiCompanion[];
  profile: BlobbonautProfile | null | undefined;
  pubkey: string | undefined;
  onSelect: (d: string) => void;
  updateCompanionEvent: (event: NostrEvent) => void;
  refresh: () => void;
  /** Connection health for the HUD chip. */
  connection?: { level: HealthLevel; online: boolean; onRetry: () => void };
}

/** Dev-only lifecycle shortcuts: never in a production build, and off unless the flag is set. */
/** The account's first egg: how long it rests on its nest before the theatre opens by itself (as in the room). */
const FIRST_HATCH_LEAD_MS = 1_400;

const DEV_LIFECYCLE_TOOLS = import.meta.env.DEV && import.meta.env.VITE_BLOBBI_DEV_TOOLS === 'true';
/**
 * Dev-only composition preview (`?preview=bed|tub`): the piece is out and
 * the Blobbi stands at its spot on load, with no walk and no write, so the
 * proportions can be looked at without caring for a real Blobbi. Same
 * flag and build guard as the lifecycle shortcuts.
 */
const DEV_PREVIEW: StageObjectKind | null = DEV_LIFECYCLE_TOOLS && typeof window !== 'undefined' ? ((): StageObjectKind | null => {
  const v = new URLSearchParams(window.location.search).get('preview');
  return v === 'bed' || v === 'tub' ? v : null;
})() : null;

/** What a hatch is doing, in words: the ceremony reads without any animation. */
function hatchCaption(beat: HatchBeat, name: string): string {
  switch (beat) {
    case 'stirring':
      return 'Something is stirring inside the egg…';
    case 'cracking':
      return 'The shell is cracking…';
    case 'breaking':
      return 'Almost there…';
    case 'hatching':
      return `${name} is hatching!`;
    case 'hatched':
      return `${name} has hatched!`;
  }
}

/** An item set down in the room (owned or starter), and where its use stands. */
interface ItemOffer {
  choice: CareChoice;
  phase: 'walking' | 'using' | 'failed';
  key: number;
  /** Where it lies and where the Blobbi stands to use it. */
  spot: { position: FloorPoint; approach: FloorPoint };
  /** When the use began, for the minimum visible duration. */
  usingSince?: number;
}

/**
 * A piece of furniture that comes out for a care moment (the bed, the tub)
 * and goes away when the moment is over. Presentation state; the moment
 * itself is the existing care path (walk, then the kit's care effect).
 */
interface StageObject {
  kind: StageObjectKind;
  phase: 'walking' | 'using' | 'done';
  key: number;
}

/**
 * The home of one Blobbi: one space, the Blobbi in it, four care intents
 * and the bag under the thumb. Every value is read from shared parsed
 * state; nothing here computes decay, thresholds, levels or effects.
 * Movement, gaze, facing, reactions, what stands in the room and which
 * options are open are local presentation state and never publish.
 */
/** Relieved after medicine: a few sparkles (none under reduced motion). */
const MEDICINE_SPARKLES: readonly BlobbiVisualEffect[] = [{ id: 'golden-sparkles', intensity: 0.7 }];

export function BlobbiOverview(props: BlobbiOverviewProps) {
  // The scene is per Blobbi: switching Blobbis starts the newcomer at home
  // with no movement, pending walk, gaze, reaction or ceremony left
  // over from the previous one.
  return <BlobbiHome key={props.blobbi.d} {...props} />;
}

const NO_TASKS: readonly LifecycleTask[] = [];

function BlobbiHome({ blobbi, companions, profile, pubkey, onSelect, updateCompanionEvent, refresh, connection }: BlobbiOverviewProps) {
  const projected = useProjectedBlobbiState(blobbi);
  const care = useCareActions({ pubkey, updateCompanionEvent, invalidate: refresh });
  const sound = useSound();

  // Items: the player's inventories (read-only) and the one write path that
  // uses a consumable on this Blobbi.
  const inventory = useHomeInventory({ pubkey, blobbi });
  const useItem = useUseItem({ pubkey, known: inventory.items, updateCompanionEvent, invalidate: refresh });
  // The starter kit's spend-free path (starter-catalog.ts): the same care effect, no inventory touched.
  const useStarter = useStarterUse({ pubkey, updateCompanionEvent, invalidate: refresh });
  // What the Island dressed it in, drawn here too (read-only).
  const worn = useWornEquipment({ pubkey, blobbi, items: inventory.items });

  const sceneRef = useRef<HTMLElement>(null);
  const actorRef = useRef<HTMLDivElement>(null);

  // Lifecycle: the kit's missions and transitions, and the ceremony that
  // dresses a transition. The ceremony performs the semantic write at one
  // point and reveals only when it landed.
  const lifecycle = useLifecycle({ blobbi, profile, pubkey, updateCompanionEvent, invalidate: refresh });
  const reducedMotion = useReducedMotion();
  const { hatch, evolve } = lifecycle;
  const performCeremony = useCallback((kind: CeremonyKind) => (kind === 'hatch' ? hatch() : evolve()), [hatch, evolve]);
  const [reveal, setReveal] = useState<{ kind: CeremonyKind; key: number } | null>(null);
  const ceremony = useLifecycleCeremony({
    perform: performCeremony,
    reducedMotion,
    onReveal: (kind) => setReveal((r) => ({ kind, key: (r?.key ?? 0) + 1 })),
  });

  const sleeping = blobbi.state === 'sleeping';
  // An egg lives on the nest (the bed, centred); a sleeper is in the bed; anyone else comes in at the entry.
  const isEgg = blobbi.stage === 'egg';
  const [initialPosition] = useState<FloorPoint>(() => (isEgg ? approachSpot(STAGE_OBJECTS.nest) : sleeping ? approachSpot(STAGE_OBJECTS.bed) : DEV_PREVIEW ? approachSpot(STAGE_OBJECTS[DEV_PREVIEW]) : HOME_SPACE.entry));
  // The dev bed preview shows the sleeping pose too (presentation only; care and writes see the real state).
  const shownBlobbi = DEV_PREVIEW === 'bed' && blobbi.state === 'active' ? { ...blobbi, state: 'sleeping' as const } : blobbi;
  const scene = useBlobbiPresentation({ blobbi: shownBlobbi, stats: projected?.stats, sceneRef, actorRef, isInCeremony: ceremony.presentation.exclusive, initialPosition });

  const statItems = useMemo<StatItem[]>(
    () =>
      projected
        ? getVisibleStats(blobbi.stage).map((stat) => ({
            stat,
            value: projected.stats[stat],
            status: getStatStatus(blobbi.stage, stat, projected.stats[stat]),
          }))
        : [],
    [projected, blobbi.stage],
  );
  const actions = useMemo(() => availableCareActions(blobbi), [blobbi]);
  const mood = describeMood(blobbi, projected?.stats);

  // Sheets
  const [blobbiSheetOpen, setBlobbiSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);
  const openItems = useCallback(() => setItemsOpen(true), []);
  const openBlobbiSheet = useCallback(() => setBlobbiSheetOpen(true), []);

  // The verb whose options are open (UI state), an item set down (offer),
  // a piece of furniture out for a moment (stage object).
  const [selectedVerb, setSelectedVerb] = useState<CareVerb | null>(null);
  const selectedVerbRef = useRef<CareVerb | null>(null);
  selectedVerbRef.current = selectedVerb;
  const [offer, setOffer] = useState<ItemOffer | null>(null);
  const offerRef = useRef<ItemOffer | null>(null);
  // Medicine's moment where the Blobbi stands (M15 care refinement): the dose, the wiggle, then relieved
  const [dose, setDose] = useState<{ key: number; glyph: ItemGlyphModel; phase: MedicinePhase } | null>(null);
  const doseRef = useRef<typeof dose>(null);
  doseRef.current = dose;
  const doseTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearDose = useCallback(() => {
    doseTimers.current.forEach(clearTimeout);
    doseTimers.current = [];
    setDose(null);
  }, []);
  useEffect(() => () => doseTimers.current.forEach(clearTimeout), []);
  useEffect(() => {
    offerRef.current = offer;
  }, [offer]);
  // A sleeper is in its bed from the start; the bed leaves when it wakes.
  const [stage, setStage] = useState<StageObject | null>(() => (sleeping && !isEgg ? { kind: 'bed', phase: 'using', key: 0 } : DEV_PREVIEW ? { kind: DEV_PREVIEW, phase: 'using', key: 0 } : null));
  const stageRef = useRef<StageObject | null>(stage);
  /** The tub came out for a clean item; when that use ends however it ends, the tub goes away. */
  const retireTub = useCallback(() => setStage((s) => (s && s.kind === 'tub' && s.phase !== 'done' ? { ...s, phase: 'done' } : s)), []);
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);
  const stageKeyRef = useRef(0);

  const liveBlobbi = useRef(blobbi);
  useEffect(() => {
    liveBlobbi.current = blobbi;
  }, [blobbi]);

  // A hop, fresh chips, a face and a word each time a care action lands.
  const [resultKey, setResultKey] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackResult | undefined>(undefined);
  // Real care landed on this visit (the flame may light before the receipts are read back, M14.1)
  const [caredThisVisit, setCaredThisVisit] = useState(false);
  const careGiven = useCareGiven(pubkey, caredThisVisit);
  const lastResult = care.lastResult;
  const handledResultRef = useRef<typeof lastResult>(undefined);
  const { reactToCare, celebrate } = scene;
  const play = sound.play;
  useEffect(() => {
    if (!lastResult || handledResultRef.current === lastResult) return;
    handledResultRef.current = lastResult;
    const r = lastResult as CareResult;
    setResultKey((k) => k + 1);
    setFeedback(r);
    setCaredThisVisit(true);
    reactToCare(r);
    const sound = soundForCare(r.action, r.nextState);
    if (sound) play(sound);
    // A stage object leaves once its moment has landed; the bed stays while the Blobbi sleeps in it.
    const current = stageRef.current;
    if (current && !(current.kind === 'bed' && r.nextState === 'sleeping')) {
      setStage({ ...current, phase: 'done' });
    }
  }, [lastResult, reactToCare, play]);

  // A care write that failed: the piece that came out for it goes away too.
  const careError = care.error;
  useEffect(() => {
    if (!careError) return;
    setStage((s) => (s && s.phase === 'using' ? { ...s, phase: 'done' } : s));
  }, [careError]);

  // The bed leaves a moment after waking; the tub a moment after the bath.
  useEffect(() => {
    if (stage?.phase !== 'done') return;
    const key = stage.key;
    const timer = setTimeout(() => setStage((s) => (s && s.key === key ? null : s)), 1_400);
    return () => clearTimeout(timer);
  }, [stage]);
  useEffect(() => {
    if (!sleeping && !DEV_PREVIEW) setStage((s) => (s && s.kind === 'bed' && s.phase === 'using' ? { ...s, phase: 'done' } : s));
  }, [sleeping]);
  // The authoritative state says asleep while no bed is out (a state change
  // that did not come through the Rest walk: a refetch, another client, a
  // dev fixture): the bed comes out and the sleeper is in it. A sleeper that
  // walked there is already at the bed, so nothing moves.
  const placeAt = scene.placeAt;
  const position = scene.presentation.position;
  useEffect(() => {
    if (!sleeping || isEgg) return;
    setStage((s) => (s && s.kind === 'bed' && s.phase !== 'done' ? s : { kind: 'bed', phase: 'using', key: ++stageKeyRef.current }));
    const bed = approachSpot(STAGE_OBJECTS.bed);
    if (Math.abs(position.x - bed.x) > 0.02 || Math.abs(position.y - bed.y) > 0.02) placeAt(bed);
    // Only the change of `sleeping` matters; the position is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleeping, isEgg, placeAt]);

  // An item was used (owned or starter): the celebration waits for the write
  // AND for the use to have been visible for a moment (`MIN_USE_MS`).
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The bath's write, waited for (M15): settled by the use's result or its error below. */
  const bathCommit = useRef<((outcome: BathCommitOutcome) => void) | null>(null);
  const onUseResult = useCallback(
    (r: ItemUseResult | StarterUseResult) => {
      // A bath's write landed: the bath goes on to its celebration; the chips and the sound below are the same
      if (bathCommit.current) {
        const settle = bathCommit.current;
        bathCommit.current = null;
        settle({ kind: 'landed', alreadyApplied: r.alreadyApplied });
      }
      const finish = () => {
        finishTimerRef.current = null;
        setOffer(null);
        retireTub();
        // Medicine landed: relieved, with sparkles, a moment
        const d = doseRef.current;
        if (d) {
          setDose({ ...d, phase: 'relieved' });
          doseTimers.current.push(setTimeout(() => setDose((now) => (now && now.key === d.key ? null : now)), MEDICINE_MOMENT.relievedMs));
        }
        // Real care landed (the flame may light, M14.1), whether or not the result was already applied
        setCaredThisVisit(true);
        if (r.alreadyApplied) return;
        setResultKey((k) => k + 1);
        setFeedback({ action: r.action, name: r.name, statsChanged: r.statsChanged, xpGained: r.xpGained, nextState: 'active', itemName: r.item.name });
        reactToCare({ action: r.action, nextState: 'active' });
        const sound = soundForCare(r.action, 'active');
        if (sound) play(sound);
      };
      const remaining = MIN_USE_MS - (Date.now() - (offerRef.current?.usingSince ?? 0));
      if (remaining > 0) finishTimerRef.current = setTimeout(finish, remaining);
      else finish();
    },
    [reactToCare, play, retireTub],
  );
  const lastItemResult = useItem.lastResult;
  const handledItemRef = useRef<typeof lastItemResult>(undefined);
  useEffect(() => {
    if (!lastItemResult || handledItemRef.current === lastItemResult) return;
    handledItemRef.current = lastItemResult;
    onUseResult(lastItemResult);
  }, [lastItemResult, onUseResult]);
  const lastStarterResult = useStarter.lastResult;
  const handledStarterRef = useRef<typeof lastStarterResult>(undefined);
  useEffect(() => {
    if (!lastStarterResult || handledStarterRef.current === lastStarterResult) return;
    handledStarterRef.current = lastStarterResult;
    onUseResult(lastStarterResult);
  }, [lastStarterResult, onUseResult]);
  useEffect(
    () => () => {
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    },
    [],
  );

  // A use failed: the item stays in the room with a way to retry or put it away.
  const itemError = useItem.error ?? useStarter.error;
  useEffect(() => {
    if (!itemError) return;
    setOffer((o) => (o ? { ...o, phase: 'failed' } : o));
    clearDose();
    // A bath's write failed: the bath shows why and waits for Try again
    if (bathCommit.current) {
      const settle = bathCommit.current;
      bathCommit.current = null;
      settle({ kind: 'failed', error: describeWriteError(itemError) });
    }
  }, [itemError, clearDose]);

  // The reveal of a lifecycle moment: a bigger face, a hop, a word, a sound.
  const handledRevealRef = useRef(0);
  useEffect(() => {
    if (!reveal || handledRevealRef.current === reveal.key) return;
    handledRevealRef.current = reveal.key;
    celebrate();
    setResultKey((k) => k + 1);
    play(soundForReveal(reveal.kind));
  }, [reveal, celebrate, play]);

  // The streak: the home only notices the authoritative number going up
  // between two versions of this Blobbi (a care write on a new day), never
  // on load. A moment for it, bigger on the milestones.
  const [streakMoment, setStreakMoment] = useState<StreakChange | null>(null);
  const [streakBump, setStreakBump] = useState(0);
  const streakRef = useRef(blobbi.careStreak);
  useEffect(() => {
    const change = detectStreakIncrease(streakRef.current, blobbi.careStreak);
    streakRef.current = blobbi.careStreak;
    if (!change) return;
    setStreakBump((k) => k + 1);
    setStreakMoment(change);
  }, [blobbi.careStreak]);
  const dismissStreakMoment = useCallback(() => setStreakMoment(null), []);

  // The first Blobbi of the account (first-blobbi.ts): its egg hatches without
  // the missions. Decided from the collection, confirmed against the relays
  // right before the write; the hatch is the same kit transition every hatch
  // is. Later eggs keep the mission gate below.
  // Today's missions keep counting and paying on the classic home too (shown in the room's Journey)
  // Today's missions and the day's award (one instance: a second would pay twice); the Journey shows them (M14.1)
  const daily = useDailyXp({ pubkey, companions, profile });
  const firstBlobbi = useFirstBlobbiHatch({ blobbi, companions, pubkey });
  const confirmFirstBlobbi = firstBlobbi.confirm;
  const ceremonyStart = ceremony.start;
  // A hatch is the theatre (`HatchTheater`, M13: the 2D home is where a first Blobbi is born): the shell opens under
  // the player's taps, and the theatre owns the one write and the reveal. The evolution keeps the home's ceremony.
  const [theater, setTheater] = useState(false);
  const theaterOpen = useRef(false);
  const [hatchError, setHatchError] = useState<string | null>(null);
  const { hatch: lifecycleHatch, clearError: clearLifecycleError } = lifecycle;
  const performHatch = useCallback(async (): Promise<boolean> => {
    setHatchError(null);
    clearLifecycleError();
    // The first egg's shortcut (no missions) only once the relays confirm it is still the first; fails closed
    if (firstBlobbi.qualifies && !(await confirmFirstBlobbi())) {
      setHatchError('Your egg could not be confirmed with the relays yet.');
      return false;
    }
    return lifecycleHatch();
  }, [firstBlobbi.qualifies, confirmFirstBlobbi, lifecycleHatch, clearLifecycleError]);
  const endTheater = useCallback(
    (hatched: boolean) => {
      setTheater(false);
      theaterOpen.current = false;
      // The baby is already where the egg lay; a hop to say hello (the theatre has played the sound)
      if (hatched) setResultKey((k) => k + 1);
    },
    [],
  );
  // Hatched elsewhere meanwhile (another device): the kit refused a second hatch; the collection catches up
  const lifecycleErrorMessage = lifecycle.error?.message ?? null;
  useEffect(() => {
    if (theater && lifecycleErrorMessage && /already hatched/i.test(lifecycleErrorMessage)) refresh();
  }, [theater, lifecycleErrorMessage, refresh]);
  const startCeremony = useCallback(
    (kind: CeremonyKind) => {
      if (blobbi.state !== 'active') return;
      if (kind === 'hatch') {
        if (blobbi.stage !== 'egg' || theaterOpen.current) return;
        if (!firstBlobbi.qualifies && lifecycle.view.next !== 'hatch') return;
        theaterOpen.current = true;
        setBlobbiSheetOpen(false);
        setMenuOpen(false);
        setTheater(true);
        return;
      }
      if (lifecycle.view.next !== 'evolve') return;
      setBlobbiSheetOpen(false);
      ceremonyStart(kind);
    },
    [blobbi.state, blobbi.stage, lifecycle.view.next, ceremonyStart, firstBlobbi.qualifies],
  );
  // The account's first egg: a moment after it is on screen and the home is quiet, the theatre opens by itself, once
  // per visit (M12.3's taps, M13's 2D home). Later leaves the Hatch! button in the dock. Nothing is written until the
  // last tap.
  const firstHatchDue = firstBlobbi.qualifies && isEgg && blobbi.state === 'active' && !!profile && offer === null && stage?.phase !== 'walking' && !theater;
  const invitedFirst = useRef(false);
  useEffect(() => {
    if (!firstHatchDue || invitedFirst.current) return;
    const timer = setTimeout(() => {
      invitedFirst.current = true;
      startCeremony('hatch');
    }, FIRST_HATCH_LEAD_MS);
    return () => clearTimeout(timer);
  }, [firstHatchDue, startCeremony]);
  const devForce = DEV_LIFECYCLE_TOOLS
    ? (kind: CeremonyKind) => {
        setBlobbiSheetOpen(false);
        ceremonyStart(kind);
      }
    : undefined;

  // The door: walk there, then the way out is offered at the door (a real
  // link, so the new tab opens from the player's own tap).
  const [doorPrompt, setDoorPrompt] = useState(false);

  const perform = care.perform;
  const walkTo = scene.walkTo;
  const canWalk = scene.canWalk;
  const door = sceneObject('door');

  // A care moment with a piece of furniture: it comes out, the Blobbi walks
  // to it, and only on arrival, only if still awake, the kit's care effect.
  // A tap elsewhere on the way replaces the walk: nothing is written and
  // the piece goes away.
  const [walkingFor, setWalkingFor] = useState<CareAction | null>(null);
  const careAtObject = useCallback(
    (kind: StageObjectKind, action: CareAction) => {
      const next: StageObject = { kind, phase: 'walking', key: ++stageKeyRef.current };
      setStage(next);
      stageRef.current = next;
      setDoorPrompt(false);
      setWalkingFor(action);
      const target = approachSpot(STAGE_OBJECTS[kind]);
      const begin = () => {
        setWalkingFor(null);
        if (stageRef.current?.key !== next.key) return;
        if (liveBlobbi.current.state !== 'active') {
          setStage(null);
          return;
        }
        setStage((s) => (s && s.key === next.key ? { ...s, phase: 'using' } : s));
        perform(liveBlobbi.current.d, action);
      };
      if (!canWalk) {
        begin();
        return;
      }
      void walkTo(target).then((outcome) => {
        if (outcome !== 'arrived') {
          setWalkingFor(null);
          setStage((s) => (s && s.key === next.key ? null : s));
          return;
        }
        begin();
      });
    },
    [walkTo, canWalk, perform],
  );

  // ─── The moments' reactions (the bath, M15; medicine, M15 care refinement) ───
  // The Blobbi's reactions through the bath, over its presentation: a named face, where its eyes go, a body gesture
  const [bathFace, setBathFace] = useState<ExpressionName | null>(null);
  const [bathGaze, setBathGaze] = useState<EyeOffset | null>(null);
  const [bathGesture, setBathGesture] = useState<ActiveGesture | null>(null);
  const bathGestureKey = useRef(0);
  const bathGestureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playBathGesture = useCallback((kind: PokeGesture) => {
    bathGestureKey.current += 1;
    setBathGesture({ kind, key: bathGestureKey.current });
    if (bathGestureTimer.current) clearTimeout(bathGestureTimer.current);
    bathGestureTimer.current = setTimeout(() => setBathGesture(null), GESTURES[kind].durationMs + 50);
  }, []);
  useEffect(() => () => {
    if (bathGestureTimer.current) clearTimeout(bathGestureTimer.current);
  }, []);
  const [bathNotice, setBathNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!bathNotice) return;
    const timer = setTimeout(() => setBathNotice(null), 3_200);
    return () => clearTimeout(timer);
  }, [bathNotice]);
  // Offering an item (owned or starter): it is set down in the room, the
  // Blobbi walks to it, and only on arrival does the semantic use start: a
  // spend + care for an owned item, care alone for a starter. A cleaning
  // item brings the tub out and the Blobbi gets in it.
  const offerKeyRef = useRef(0);
  const startUse = useItem.use;
  const resetUse = useItem.reset;
  const startStarter = useStarter.use;
  const resetStarter = useStarter.reset;
  const hasOpenUseNow = useItem.hasOpenUse;
  const positionRef = useRef(scene.presentation.position);
  positionRef.current = scene.presentation.position;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const healthRef = useRef(projected?.stats.health);
  healthRef.current = projected?.stats.health;
  const offerItem = useCallback(
    (choice: CareChoice) => {
      const action = choice.entry.item.care?.action;
      // Medicine has its own rule: refused when its health is full (not the bath's hygiene rule)
      const refusal = action === 'medicine' ? medicineRefusal(liveBlobbi.current.name, healthRef.current) : null;
      if (refusal) {
        setBathNotice(refusal);
        return;
      }
      setItemsOpen(false);
      setDoorPrompt(false);
      resetUse();
      resetStarter();
      clearDose();
      celebrate(900);
      // Medicine is a moment where it stands: no walk, never the tub. An owned use left open is resumed the plain way
      // (no moment: what lands is that other use, not this medicine)
      const moment = action === 'medicine' && !(choice.source === 'owned' && hasOpenUseNow(liveBlobbi.current.d));
      let spot: ItemOffer['spot'];
      if (action === 'play') spot = { position: STAGE_OBJECTS.toySpot, approach: STAGE_OBJECTS.toyApproach };
      else if (moment) {
        const at = positionRef.current;
        spot = { position: clampToFloor({ x: at.x + 0.12, y: at.y + 0.05 }), approach: at };
      } else if (action === 'clean') {
        const tub = approachSpot(STAGE_OBJECTS.tub);
        spot = { position: clampToFloor({ x: tub.x - 0.24, y: tub.y + 0.1 }), approach: tub };
        setStage((s) => (s && s.kind === 'tub' && s.phase !== 'done' ? s : { kind: 'tub', phase: 'walking', key: ++stageKeyRef.current }));
      } else spot = { position: OFFER_SPOT, approach: OFFER_APPROACH };
      const next: ItemOffer = { choice, phase: canWalk && !moment ? 'walking' : 'using', key: ++offerKeyRef.current, spot };
      setOffer(next);
      offerRef.current = next;
      const begin = () => {
        if (offerRef.current?.key !== next.key) return;
        const using: ItemOffer = { ...next, phase: 'using', usingSince: Date.now() };
        offerRef.current = using;
        setOffer((o) => (o && o.key === next.key ? using : o));
        setStage((s) => (s && s.kind === 'tub' && s.phase === 'walking' ? { ...s, phase: 'using' } : s));
        const started = choice.source === 'owned' ? startUse({ entry: choice.entry, blobbiD: liveBlobbi.current.d }) : startStarter({ entry: choice.entry, blobbiD: liveBlobbi.current.d });
        if (!started) {
          setOffer((o) => (o && o.key === next.key ? { ...o, phase: 'failed' } : o));
          clearDose();
        }
      };
      if (moment) {
        // Worried, the medicine to its mouth, a wiggle as it takes it; only then the write (nothing before it)
        const reduced = reducedMotionRef.current;
        const step = (ms: number, fn: () => void) => doseTimers.current.push(setTimeout(() => offerRef.current?.key === next.key && fn(), ms));
        setDose({ key: next.key, glyph: choice.entry.item.glyph, phase: 'dose' });
        step(reduced ? MEDICINE_MOMENT.reducedMs : MEDICINE_MOMENT.doseMs, () => {
          setDose((d) => (d && d.key === next.key ? { ...d, phase: 'wiggle' } : d));
          play('drink');
          if (!reduced) playBathGesture('wiggle');
          step(reduced ? MEDICINE_MOMENT.reducedMs : MEDICINE_MOMENT.wiggleMs, begin);
        });
        return;
      }
      if (!canWalk) {
        begin();
        return;
      }
      void walkTo(spot.approach).then((outcome) => {
        if (offerRef.current?.key !== next.key) return;
        if (outcome !== 'arrived') {
          setOffer(null);
          retireTub();
          return;
        }
        begin();
      });
    },
    [canWalk, walkTo, startUse, startStarter, resetUse, resetStarter, celebrate, retireTub, clearDose, play, playBathGesture, hasOpenUseNow],
  );
  const putAway = useCallback(() => {
    resetUse();
    resetStarter();
    clearDose();
    offerRef.current = null;
    setOffer(null);
    retireTub();
  }, [resetUse, resetStarter, retireTub, clearDose]);

  // ─── The bath (M15): a cleaning item is a small game, not a write at the tub ───
  // Where the Blobbi stands in the tub, and where it steps out to
  const tubSpot = useMemo(() => approachSpot(STAGE_OBJECTS.tub), []);
  const tubExit = useMemo(() => clampToFloor({ x: STAGE_OBJECTS.tub.x - 0.24, y: tubSpot.y + 0.14 }), [tubSpot]);
  const placeAtRef = useRef(placeAt);
  placeAtRef.current = placeAt;
  const walkToRef = useRef(walkTo);
  walkToRef.current = walkTo;
  const canWalkRef = useRef(canWalk);
  canWalkRef.current = canWalk;
  const beginBathWrite = useCallback(
    (choice: CareChoice) =>
      new Promise<BathCommitOutcome>((resolve) => {
        resetUse();
        resetStarter();
        bathCommit.current = resolve;
        const started = choice.source === 'owned' ? startUse({ entry: choice.entry, blobbiD: liveBlobbi.current.d }) : startStarter({ entry: choice.entry, blobbiD: liveBlobbi.current.d });
        if (!started) {
          bathCommit.current = null;
          resolve({ kind: 'failed', error: 'Another use is still finishing. Try again in a moment.' });
        }
      }),
    [resetUse, resetStarter, startUse, startStarter],
  );
  /** In the tub now (a soak): however the ritual ends, it steps out. */
  const inTub = useRef(false);
  const bath = useBathSession({
    name: blobbi.name,
    reducedMotion,
    hygiene: projected?.stats.hygiene,
    // A soak: an egg is bathed where it lies, on its nest; anyone else walks to the tub and jumps in (the ritual's
    // other games are played where the Blobbi stands)
    enter: isEgg
      ? null
      : async (run: Run) => {
          if (!canWalkRef.current) {
            placeAtRef.current(tubSpot);
            inTub.current = true;
            return true;
          }
          const outcome = await run.until(walkToRef.current(tubSpot));
          if (outcome !== 'arrived') return false;
          inTub.current = true;
          // The jump in: up over the rim and down into the water (the tub's front covers its lower body)
          if (!reducedMotionRef.current) playBathGesture('bounce');
          await run.wait(reducedMotionRef.current ? 150 : 520);
          return true;
        },
    exit: async (run: Run) => {
      // The jump out: a hop over the rim, then a step toward the viewer, wet
      if (!reducedMotionRef.current) playBathGesture('bounce');
      await run.wait(reducedMotionRef.current ? 150 : 420);
      inTub.current = false;
      if (liveBlobbi.current.state === 'active' && canWalkRef.current) await run.until(walkToRef.current(tubExit));
      else placeAtRef.current(tubExit);
    },
    leave: () => {
      // Still in the tub (a soak cut short): out of it, so the tub can go
      if (!inTub.current) return;
      inTub.current = false;
      if (liveBlobbi.current.state === 'active' && canWalkRef.current) void walkToRef.current(tubExit);
      else placeAtRef.current(tubExit);
    },
    commit: beginBathWrite,
    retry: beginBathWrite,
    // The drawing itself, inside the poke button: the actor's children (the need bubbles' icons, the bath's own
    // layer) come before it, and their first <svg> would be read as the body
    drawing: () => actorRef.current?.querySelector<SVGSVGElement>('[data-testid="blobbi-poke"] svg') ?? null,
    face: setBathFace,
    gaze: setBathGaze,
    gesture: playBathGesture,
    play,
    notify: setBathNotice,
  });
  const bathView = bath.view;
  // Busy for the whole time the bath is on screen, its celebration too (`active` ends at done; M15 integration)
  const bathing = bath.active || bathView !== null;
  // The tub comes out with the bath and sinks away a moment after it
  const [tubOut, setTubOut] = useState(false);
  const hadTub = useRef(false);
  useEffect(() => {
    const showing = !!bathView && !bathView.inPlace;
    if (showing) hadTub.current = true;
    else if (hadTub.current) {
      hadTub.current = false;
      setTubOut(true);
      const timer = setTimeout(() => setTubOut(false), 1_300);
      return () => clearTimeout(timer);
    }
  }, [bathView]);
  const tubZ = placeOnFloor(tubSpot).zIndex;
  const bathTub = bathView && !bathView.inPlace ? (bathView.stageId === 'jump-in' ? 'in' : 'using') : tubOut ? 'out' : null;
  const inMoment = !!bathView || !!dose;
  const bathPresentation = useMemo(
    () => (inMoment ? { ...scene.presentation, eyeOffset: bathGaze ?? scene.presentation.eyeOffset, gesture: bathGesture ?? scene.presentation.gesture } : scene.presentation),
    [inMoment, scene.presentation, bathGaze, bathGesture],
  );

  // Choosing on the strip: an item, owned or starter, is offered. There is no
  // other way to feed, play or clean. A cleaning item starts the bath (M15).
  const startBath = bath.start;
  const hasOpenUseRef = useRef(useItem.hasOpenUse);
  hasOpenUseRef.current = useItem.hasOpenUse;
  const chooseOption = useCallback(
    (entry: CareEntry) => {
      setSelectedVerb(null);
      // An owned use begun earlier and never finished is finished first (the ledger's resume), never bathed with (M15)
      if (entry.action === 'clean' && !(entry.choice.source === 'owned' && hasOpenUseRef.current(liveBlobbi.current.d))) {
        setItemsOpen(false);
        setDoorPrompt(false);
        startBath({ choice: entry.choice, name: entry.name, glyph: entry.glyph }, { inPlace: isEgg });
        return;
      }
      offerItem(entry.choice);
    },
    [offerItem, startBath, isEgg],
  );

  // The verb row: a verb opens its options; Rest and Wake act at once (one
  // way only); tapping the open verb again closes it.
  const options = useMemo(() => (selectedVerb ? homeCareEntries(selectedVerb, inventory, actions) : []), [selectedVerb, inventory, actions]);
  // The item in the middle of each verb's carousel, for the visit
  const [focusByVerb, setFocusByVerb] = useState<Partial<Record<CareVerb, string>>>({});
  const focusItem = useCallback((key: string) => setFocusByVerb((f) => (selectedVerbRef.current ? { ...f, [selectedVerbRef.current]: key } : f)), []);
  const selectVerb = useCallback(
    (verb: CareVerb) => {
      setDoorPrompt(false);
      if (verb === 'rest') {
        setSelectedVerb(null);
        // An egg rests where it lies, on the nest; a sleeper wakes; an awake Blobbi goes to bed.
        if (blobbi.state === 'sleeping' || isEgg) perform(blobbi.d, 'rest');
        else if (blobbi.state === 'active') careAtObject('bed', 'rest');
        return;
      }
      setSelectedVerb((v) => (v === verb ? null : verb));
    },
    [blobbi.d, blobbi.state, isEgg, perform, careAtObject],
  );
  useEffect(() => {
    if (selectedVerb && options.length === 0) setSelectedVerb(null);
  }, [selectedVerb, options.length]);

  const goToDoor = useCallback(() => {
    setDoorPrompt(false);
    setSelectedVerb(null);
    void walkTo(door.approach ?? door.position).then((outcome) => {
      if (outcome === 'arrived') setDoorPrompt(true);
    });
  }, [walkTo, door]);
  const onFloorTap = useCallback(
    (fraction: { x: number; y: number }) => {
      setDoorPrompt(false);
      setSelectedVerb(null);
      scene.onFloorTap(fraction);
    },
    [scene],
  );
  const pokeBlobbi = scene.poke;
  const onPoke = useCallback(() => {
    const reaction = pokeBlobbi();
    // The mode may have shown nothing (a ceremony): then nothing is heard either.
    if (reaction.expression !== null || reaction.mood === 'egg' || reaction.mood === 'asleep') {
      const sound = soundForPoke(reaction.mood);
      if (sound) play(sound);
    }
  }, [pokeBlobbi, play]);

  const pendingAction: CareAction | null = care.pendingAction ?? walkingFor;
  const inCeremony = ceremony.presentation.exclusive;
  // A hatch in progress: its beat for what is on screen, and a shell that never un-cracks while it runs.
  const hatchBeat = hatchOnScreen(ceremony.presentation.hatch, blobbi.stage);
  const eggCrack = ceremony.presentation.eggCrack ?? (hatchBeat ? 'heavy' : lifecycle.view.eggCrack);
  const interactive = !sleeping && canWalk && !inCeremony;
  const usableItemCount = inventory.items.filter((i) => i.usability.ok && !i.unverified).length;
  const offerObject = offer ? itemObjectAt('offer', offer.choice.entry.item.name, offer.spot.position, offer.spot.approach) : null;
  const accessories = blobbi.stage === 'egg' ? undefined : worn.accessoriesFor(scene.presentation.facing);
  const bathEffects = bath.effects;
  const relieved = dose?.phase === 'relieved' && !reducedMotion;
  const actorEffects = useMemo(() => {
    const ceremonyEffects = ceremony.presentation.effects ?? [];
    const extra = [...ceremonyEffects, ...bathEffects, ...(relieved ? MEDICINE_SPARKLES : [])];
    return extra.length > 0 ? [...extra, ...worn.effects] : worn.effects;
  }, [ceremony.presentation.effects, bathEffects, worn.effects, relieved]);
  const lifecycleNext = lifecycle.view.next;
  const firstHatchReady = firstBlobbi.qualifies;
  const lifecycleReady = useMemo(
    () => (lifecycleNext === 'hatch' || firstHatchReady ? { kind: 'hatch' as const, label: 'Hatch!' } : lifecycleNext === 'evolve' ? { kind: 'evolve' as const, label: 'Evolve!' } : null),
    [lifecycleNext, firstHatchReady],
  );
  const ceremonyView = { phase: ceremony.phase, kind: ceremony.kind, error: ceremony.error, dismiss: ceremony.dismiss };

  // What stands in the space: the home's furniture, the nest while the Blobbi
  // is an egg, plus the bed or the tub while they are out for a moment.
  const placements = useMemo<Placement[]>(() => [...HOME_SPACE.furniture, ...(isEgg ? [STAGE_OBJECTS.nest] : []), ...(stage ? [STAGE_OBJECTS[stage.kind]] : [])], [isEgg, stage]);
  const stageStateOf = useCallback(
    (placement: Placement) => {
      if (isEgg && placement === STAGE_OBJECTS.nest) return 'nest';
      return stage && placement === STAGE_OBJECTS[stage.kind] ? stage.phase : undefined;
    },
    [isEgg, stage],
  );
  // In bed (an egg on the nest, a sleeper in the bed) the bed is the ground: no shadow of its own.
  const inBed = isEgg || (sleeping && stage?.kind === 'bed');
  // The bed is the one piece a tap uses (rest); the tub only ever comes out with a cleaning item.
  const useFurniture = useCallback(
    (placement: Placement) => {
      if (placement.id === STAGE_OBJECTS.bed.id && placement !== STAGE_OBJECTS.nest && blobbi.state === 'active') careAtObject('bed', 'rest');
    },
    [blobbi.state, careAtObject],
  );

  // An item on the way or in use, or a walk to a piece, holds the verbs; a write in flight is `pendingAction`'s.
  const busyWithObject = offer !== null || stage?.phase === 'walking' || bathing;
  // The flame only after real care, never for hatching alone (`flameDays`, M14.1)
  const streakForHud = useMemo(() => ({ days: flameDays(blobbi.careStreak, careGiven), bumpKey: streakBump }), [blobbi.careStreak, careGiven, streakBump]);

  // A guest's home (M14): the invitation to save, by the shared rules (`useSaveInvite`, M15): a hatched Blobbi, real
  // care, about five minutes of active play, and a quiet home; once per visit. The menu keeps the way at all times.
  const guest = useGuest();
  const guestUi = useGuestUi();
  const guestActive = guest.mode === 'active';
  const requestSave = guestUi.requestSave;
  const homeQuiet = !busyWithObject && !theater && !inCeremony && pendingAction === null && !blobbiSheetOpen && !menuOpen && !itemsOpen && !sleeping;
  // The one switch between the two homes (M14.1), upper right; the first 3D asks first
  const modeSwitch = useModeSwitch();
  // The guest's status, by the name (M14.1): a word, and a short explanation on tap; "Saved to Nostr" once a save landed
  const [statusOpen, setStatusOpen] = useState(false);
  const leading = guestActive ? <GuestStatusPill onOpen={() => setStatusOpen(true)} /> : guestUi.saved ? <SavedPill /> : null;
  // The Journey and the worlds, from the Blobbi's sheet and the menu (M14.1): the same screens the 3D room has
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [worldsOpen, setWorldsOpen] = useState(false);
  const saveInvite = useSaveInvite({ hatched: !isEgg, quiet: homeQuiet && !statusOpen && !journeyOpen && !worldsOpen });
  const evolveTasks = lifecycle.view.process === 'evolving' ? lifecycle.view.tasks : NO_TASKS;
  const journeyBook = useJourney({ pubkey, companions, current: blobbi, profile, evolveTasks });
  const { noteCare, noteNapped, notePetted } = journeyBook;
  useEffect(() => {
    if (feedback) noteCare(feedback.action);
  }, [feedback, noteCare]);
  useEffect(() => {
    if (sleeping) noteNapped();
  }, [sleeping, noteNapped]);
  useEffect(() => {
    if (resultKey > 0 && !sleeping) notePetted();
    // A cuddle is remembered by the room; here the first landed care stands in for it (the 2D home has no stroke)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultKey]);
  const onJourneyAction = useCallback(
    (action: ObjectiveAction) => {
      setJourneyOpen(false);
      if (action.kind === 'room') selectVerb(action.room === 'kitchen' ? 'feed' : action.room === 'home' ? 'play' : action.room === 'care' ? 'clean' : 'rest');
      else if (action.kind === 'details') setBlobbiSheetOpen(true);
    },
    [selectVerb],
  );

  return (
    <GameShell
      top={<HudTop blobbi={blobbi} streak={streakForHud} onOpenMenu={() => setMenuOpen(true)} connection={connection} leading={leading} />}
      corner={<ModeToggle mode={modeSwitch.mode} onChoose={modeSwitch.choose} />}
      scene={
        <HomeScene
          ref={sceneRef}
          label={`${blobbi.name}'s home`}
          room="home"
          floorLabel={sleeping ? `${blobbi.name} is asleep` : canWalk ? `Call ${blobbi.name} here` : `${blobbi.name} stays put`}
          onFloorTap={interactive && !bathing && !dose ? onFloorTap : undefined}
          pointerHandlers={scene.scenePointerHandlers}
          objects={
            <>
              <FurnitureLayer placements={placements} interactive={interactive && !busyWithObject} onUse={useFurniture} stateOf={stageStateOf} />
              {/* The bath's tub (M15): two layers, the Blobbi between them */}
              {bathTub && <BathTub2D placement={STAGE_OBJECTS.tub} part="back" zIndex={tubZ - 1} phase={bathTub} stage={bathView?.stageId ?? null} reducedMotion={reducedMotion} />}
              {bathTub && <BathTub2D placement={STAGE_OBJECTS.tub} part="front" zIndex={tubZ + 1} phase={bathTub} stage={bathView?.stageId ?? null} reducedMotion={reducedMotion} />}
              <SceneObjectView
                def={door}
                state={doorPrompt ? 'open' : 'closed'}
                onTap={interactive && !busyWithObject ? goToDoor : undefined}
                aside={
                  doorPrompt &&
                  (guestActive ? (
                    // A guest's Blobbi is not known on the Island yet: the door is the way to save, never a dead link
                    <button
                      type="button"
                      className="door-prompt lifecycle-pill !animate-none"
                      data-testid="door-prompt"
                      data-guest="true"
                      onClick={() => {
                        setDoorPrompt(false);
                        requestSave();
                      }}
                    >
                      <MapPin className="h-4 w-4" aria-hidden />
                      Save to visit the Island
                    </button>
                  ) : (
                    <a href={BLOBBI_ISLAND_URL} target="_blank" rel="noopener noreferrer" className="door-prompt lifecycle-pill !animate-none" data-testid="door-prompt" onClick={() => setDoorPrompt(false)}>
                      <MapPin className="h-4 w-4" aria-hidden />
                      Go to the Island
                    </a>
                  ))
                }
              >
                <DoorArt open={doorPrompt} />
              </SceneObjectView>
              {/* Medicine's moment draws its dose at the mouth; the item shows on the floor only to try again */}
              {offer && offerObject && !(dose && dose.key === offer.key && offer.phase !== 'failed') && (
                <SceneObjectView
                  def={offerObject}
                  state={offer.phase}
                  onTap={offer.phase === 'using' ? undefined : putAway}
                  aside={
                    offer.phase === 'failed' && (
                      <div className="offer-prompt" data-testid="offer-prompt">
                        <button type="button" className="lifecycle-pill !animate-none !px-3 !py-1.5 !text-xs" onClick={() => offerItem(offer.choice)} data-testid="offer-retry">
                          Try again
                        </button>
                        <button type="button" className="home-glass rounded-full px-3 py-1.5 text-xs font-semibold" onClick={putAway} data-testid="offer-put-away">
                          Put away
                        </button>
                      </div>
                    )
                  }
                >
                  <div className="offer-art">
                    <ItemGlyph glyph={offer.choice.entry.item.glyph} fill />
                  </div>
                </SceneObjectView>
              )}
            </>
          }
          actor={
            // While the theatre holds the egg, the home's own drawing of it steps aside: one Blobbi on screen
            <div className="contents" style={theater ? { visibility: 'hidden' } : undefined} data-testid="home-actor-slot">
              <BlobbiActor ref={actorRef} blobbi={shownBlobbi} presentation={bathPresentation} faceName={bathView ? bathFace : dose ? MEDICINE_FACE[dose.phase] : null} inBed={inBed} happyKey={resultKey} onPoke={inCeremony || bathing || dose ? undefined : onPoke} eggCrack={blobbi.stage === 'egg' ? eggCrack : undefined} hatch={hatchBeat} effects={actorEffects} accessories={accessories}>
                <NeedBubbles items={sleeping || inCeremony || bathing ? [] : statItems} />
                <CareFeedback result={feedback} resultKey={resultKey} />
                {/* The bath on its body (M15): the surface the player rubs, the foam, the water, the tool in hand */}
                {bathView && <BathTouchLayer view={bathView} input={bath.input} reducedMotion={reducedMotion} name={blobbi.name} />}
                {/* Medicine (M15 care refinement): the dose on its way to the mouth */}
                {dose && <MedicineDose glyph={dose.glyph} phase={dose.phase} reducedMotion={reducedMotion} />}
              </BlobbiActor>
            </div>
          }
          foreground={
            <>
              <div className="absolute inset-x-4 top-16 flex flex-col items-center gap-2">
                <CareError error={care.error} />
                {bathNotice && (
                  <p role="status" className="home-glass rounded-xl px-3 py-2 text-center text-sm" data-testid="bath-notice">
                    {bathNotice}
                  </p>
                )}
                {itemError && offer?.phase === 'failed' && (
                  <p role="alert" className="home-glass rounded-xl px-3 py-2 text-center text-sm text-destructive" data-testid="item-error">
                    {itemError.message}
                  </p>
                )}
                {ceremony.phase === 'failed' && (
                  <p role="alert" className="home-glass rounded-xl px-3 py-2 text-center text-sm text-destructive" data-testid="ceremony-error">
                    {(lifecycle.error ?? ceremony.error)?.message}{' '}
                    <button
                      type="button"
                      className="ml-1 text-xs font-semibold underline"
                      onClick={() => {
                        lifecycle.clearError();
                        ceremony.dismiss();
                      }}
                    >
                      Dismiss
                    </button>
                  </p>
                )}
              </div>
              {hatchBeat && (
                <p role="status" aria-live="polite" className="hatch-caption home-glass" data-testid="hatch-caption" data-beat={hatchBeat.beat}>
                  {hatchCaption(hatchBeat.beat, blobbi.name)}
                </p>
              )}
              {streakMoment?.milestone && <StreakMoment change={streakMoment} onDone={dismissStreakMoment} reducedMotion={reducedMotion} />}
              {saveInvite.open && guestActive && <GuestInvite name={blobbi.name} onSave={saveInvite.save} onLater={saveInvite.later} onNever={saveInvite.never} reducedMotion={reducedMotion} />}
            </>
          }
        >
          <RoomBackdrop room={HOME_SPACE.room} />
        </HomeScene>
      }
      bottom={
        <ActionBar
          actions={actions}
          selected={selectedVerb}
          pendingAction={pendingAction}
          onSelect={selectVerb}
          onOpenItems={openItems}
          itemCount={usableItemCount}
          lifecycleReady={lifecycleReady}
          onLifecycle={startCeremony}
          disabled={inCeremony || busyWithObject}
          floorBackground={surfaceBackground(HOME_SPACE.room.surfaces.floor)}
          blobbi={blobbi}
          mood={mood}
          statItems={statItems}
          onOpenBlobbi={openBlobbiSheet}
          options={
            bathView ? (
              <div className="care-options" data-testid="care-options" data-bath="true">
                <BathToolBar view={bathView} onStop={() => bath.cancel('stopped')} onRetry={bath.retry} reducedMotion={reducedMotion} variant="home" />
              </div>
            ) : selectedVerb && options.length > 0 ? (
              <CareOptions
                verb={selectedVerb}
                entries={options}
                focusedKey={focusByVerb[selectedVerb] ?? null}
                onFocus={focusItem}
                onChoose={chooseOption}
                disabled={useItem.isPending || useStarter.isPending || busyWithObject}
              />
            ) : undefined
          }
        />
      }
      overlays={
        <>
          {theater && (
            <HatchTheater
              blobbi={blobbi}
              perform={performHatch}
              error={hatchError ?? lifecycleErrorMessage}
              reducedMotion={reducedMotion}
              play={play}
              onDone={endTheater}
              onRecover={refresh}
              savingNote={guestActive ? 'Keeping the hatch on this device' : undefined}
            />
          )}
          <BlobbiSheet
            open={blobbiSheetOpen}
            onClose={() => setBlobbiSheetOpen(false)}
            blobbi={blobbi}
            mood={mood}
            statItems={statItems}
            profile={profile}
            companions={companions}
            onSelect={(d) => {
              setBlobbiSheetOpen(false);
              onSelect(d);
            }}
            lifecycle={lifecycle}
            ceremony={ceremonyView}
            onCeremony={startCeremony}
            firstBlobbi={firstBlobbi.qualifies}
            devForce={devForce}
            guest={guestActive}
            onOpenJourney={() => {
              setBlobbiSheetOpen(false);
              setJourneyOpen(true);
            }}
          />
          <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} onOpenWorlds={() => setWorldsOpen(true)} />
          <JourneySheet open={journeyOpen} onClose={() => setJourneyOpen(false)} chapters={journeyBook.chapters} onAction={onJourneyAction} progress={{ xp: profile?.xp, level: journeyBook.level }} daily={daily} canAdoptMore={false} />
          <WorldsSheet
            open={worldsOpen}
            onClose={() => setWorldsOpen(false)}
            blobbi={blobbi}
            guest={guestActive}
            onSave={() => {
              setWorldsOpen(false);
              requestSave();
            }}
            onTravel={(world) => {
              // No key travels: the other world asks for its own sign-in; a new tab keeps the home as it is
              if (world.url) window.open(world.url, '_blank', 'noopener');
              setWorldsOpen(false);
            }}
          />
          <GuestStatusSheet open={statusOpen && guestActive} onClose={() => setStatusOpen(false)} name={blobbi.name} onSave={requestSave} storageOk={guest.storageOk} />
          <InventorySheet
            open={itemsOpen}
            onClose={() => setItemsOpen(false)}
            inventory={inventory}
            blobbiName={blobbi.name}
            // An earlier use left unfinished is finished first (the ledger's resume), never bathed with
            onUse={(entry) => chooseOption(ownedEntry(entry))}
            openUse={useItem.hasOpenUse(blobbi.d)}
            busy={useItem.isPending || useStarter.isPending || busyWithObject}
            worn={worn.wornAddresses}
          />
        </>
      }
    />
  );
}

/** Why a write failed, in a line that is never empty (an AggregateError from the relays says nothing itself). */
function describeWriteError(error: Error): string {
  if (error.message) return error.message;
  const inner = error instanceof AggregateError ? (error.errors[0] as Error | undefined)?.message : undefined;
  return inner || 'The relays did not accept it.';
}
