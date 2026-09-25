import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProjectedBlobbiState } from '@blobbi-kit/react';
import { getStatStatus, getVisibleStats, type BlobbiCompanion, type BlobbonautProfile, type NostrEvent } from '@blobbi-kit/core';
import { isBlobbiEmotion, type BlobbiEmotion } from '@blobbi-kit/renderer';
import { MapPin } from 'lucide-react';

import { availableCareActions, useCareActions, type CareAction, type CareResult } from '@/features/care';
import { useLifecycle, useLifecycleCeremony, type CeremonyKind } from '@/features/lifecycle';
import { InventorySheet, ItemGlyph, useHomeInventory, useStarterUse, useUseItem, useWornEquipment, type ItemUseResult, type StarterUseResult } from '@/features/inventory';
import { soundForCare, soundForPoke, soundForReveal, useSound } from '@/features/sound';
import { BLOBBI_ISLAND_URL } from '@/config/ecosystem';
import type { StatItem } from './BlobbiStatusPanel';
import { CareError, CareFeedback } from './CareFeedback';
import type { FeedbackResult } from './care-feedback-text';
import { describeMood } from './mood';
import { careOptionsFor, type CareChoice, type CareOption, type CareVerb } from './care-model';
import { detectStreakIncrease, type StreakChange } from './streak';
import { HOME_SPACE, STAGE_OBJECTS, type StageObjectKind } from './space/home-space';
import { FurnitureLayer, RoomBackdrop, approachSpot, surfaceBackground, type Placement } from './rooms';
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
  type FloorPoint,
} from './scene';
import { ActionBar, BlobbiSheet, CareOptions, GameShell, HudTop, MenuSheet } from './shell';
import { StreakMoment } from './StreakMoment';
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
/**
 * Dev-only expression preview (`?expression=happy|excited|sad|sleepy|
 * surprised|upset`): the baseline face is pinned so each preset can be looked
 * at on each stage at game size. Reactions still play over it.
 */
const DEV_EXPRESSION: BlobbiEmotion | null = DEV_LIFECYCLE_TOOLS && typeof window !== 'undefined' ? ((): BlobbiEmotion | null => {
  const v = new URLSearchParams(window.location.search).get('expression');
  return v && isBlobbiEmotion(v) ? v : null;
})() : null;


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
export function BlobbiOverview(props: BlobbiOverviewProps) {
  // The scene is per Blobbi: switching Blobbis starts the newcomer at home
  // with no movement, pending walk, gaze, reaction or ceremony left
  // over from the previous one.
  return <BlobbiHome key={props.blobbi.d} {...props} />;
}

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
  const scene = useBlobbiPresentation({ blobbi: shownBlobbi, stats: projected?.stats, sceneRef, actorRef, isInCeremony: ceremony.presentation.exclusive, initialPosition, baselineOverride: DEV_EXPRESSION });

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
  const [offer, setOffer] = useState<ItemOffer | null>(null);
  const offerRef = useRef<ItemOffer | null>(null);
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

  // An item was used (owned or starter): the celebration waits for the write
  // AND for the use to have been visible for a moment (`MIN_USE_MS`).
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUseResult = useCallback(
    (r: ItemUseResult | StarterUseResult) => {
      const finish = () => {
        finishTimerRef.current = null;
        setOffer(null);
        retireTub();
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
  }, [itemError]);

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

  const ceremonyStart = ceremony.start;
  const startCeremony = useCallback(
    (kind: CeremonyKind) => {
      if (blobbi.state !== 'active') return;
      if (kind === 'hatch' && lifecycle.view.next !== 'hatch') return;
      if (kind === 'evolve' && lifecycle.view.next !== 'evolve') return;
      setBlobbiSheetOpen(false);
      ceremonyStart(kind);
    },
    [blobbi.state, lifecycle.view.next, ceremonyStart],
  );
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

  // Offering an item (owned or starter): it is set down in the room, the
  // Blobbi walks to it, and only on arrival does the semantic use start: a
  // spend + care for an owned item, care alone for a starter. A cleaning
  // item brings the tub out and the Blobbi gets in it.
  const offerKeyRef = useRef(0);
  const startUse = useItem.use;
  const resetUse = useItem.reset;
  const startStarter = useStarter.use;
  const resetStarter = useStarter.reset;
  const offerItem = useCallback(
    (choice: CareChoice) => {
      setItemsOpen(false);
      setDoorPrompt(false);
      resetUse();
      resetStarter();
      celebrate(900);
      const action = choice.entry.item.care?.action;
      let spot: ItemOffer['spot'];
      if (action === 'play') spot = { position: STAGE_OBJECTS.toySpot, approach: STAGE_OBJECTS.toyApproach };
      else if (action === 'clean' || action === 'medicine') {
        const tub = approachSpot(STAGE_OBJECTS.tub);
        spot = { position: clampToFloor({ x: tub.x - 0.24, y: tub.y + 0.1 }), approach: tub };
        setStage((s) => (s && s.kind === 'tub' && s.phase !== 'done' ? s : { kind: 'tub', phase: 'walking', key: ++stageKeyRef.current }));
      } else spot = { position: OFFER_SPOT, approach: OFFER_APPROACH };
      const next: ItemOffer = { choice, phase: canWalk ? 'walking' : 'using', key: ++offerKeyRef.current, spot };
      setOffer(next);
      offerRef.current = next;
      const begin = () => {
        if (offerRef.current?.key !== next.key) return;
        const using: ItemOffer = { ...next, phase: 'using', usingSince: Date.now() };
        offerRef.current = using;
        setOffer((o) => (o && o.key === next.key ? using : o));
        setStage((s) => (s && s.kind === 'tub' && s.phase === 'walking' ? { ...s, phase: 'using' } : s));
        const started = choice.source === 'owned' ? startUse({ entry: choice.entry, blobbiD: liveBlobbi.current.d }) : startStarter({ entry: choice.entry, blobbiD: liveBlobbi.current.d });
        if (!started) setOffer((o) => (o && o.key === next.key ? { ...o, phase: 'failed' } : o));
      };
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
    [canWalk, walkTo, startUse, startStarter, resetUse, resetStarter, celebrate, retireTub],
  );
  const putAway = useCallback(() => {
    resetUse();
    resetStarter();
    offerRef.current = null;
    setOffer(null);
    retireTub();
  }, [resetUse, resetStarter, retireTub]);

  // Choosing on the strip: an item, owned or starter, is offered. There is no
  // other way to feed, play or clean.
  const chooseOption = useCallback(
    (option: CareOption) => {
      setSelectedVerb(null);
      offerItem(option);
    },
    [offerItem],
  );

  // The verb row: a verb opens its options; Rest and Wake act at once (one
  // way only); tapping the open verb again closes it.
  const options = useMemo(() => (selectedVerb ? careOptionsFor(selectedVerb, inventory.starters, actions) : []), [selectedVerb, inventory.starters, actions]);
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
  const eggCrack = ceremony.presentation.eggCrack ?? lifecycle.view.eggCrack;
  const interactive = !sleeping && canWalk && !inCeremony;
  const usableItemCount = inventory.items.filter((i) => i.usability.ok && !i.unverified).length;
  const offerObject = offer ? itemObjectAt('offer', offer.choice.entry.item.name, offer.spot.position, offer.spot.approach) : null;
  const accessories = blobbi.stage === 'egg' ? undefined : worn.accessoriesFor(scene.presentation.facing);
  const actorEffects = useMemo(() => {
    const ceremonyEffects = ceremony.presentation.effects ?? [];
    return ceremonyEffects.length > 0 ? [...ceremonyEffects, ...worn.effects] : worn.effects;
  }, [ceremony.presentation.effects, worn.effects]);
  const lifecycleNext = lifecycle.view.next;
  const lifecycleReady = useMemo(() => (lifecycleNext === 'hatch' ? { kind: 'hatch' as const, label: 'Hatch!' } : lifecycleNext === 'evolve' ? { kind: 'evolve' as const, label: 'Evolve!' } : null), [lifecycleNext]);
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
  const busyWithObject = offer !== null || stage?.phase === 'walking';
  const streakForHud = useMemo(() => ({ days: blobbi.careStreak ?? 0, bumpKey: streakBump }), [blobbi.careStreak, streakBump]);

  return (
    <GameShell
      top={<HudTop blobbi={blobbi} mood={mood} statItems={statItems} streak={streakForHud} onOpenBlobbi={openBlobbiSheet} onOpenMenu={() => setMenuOpen(true)} connection={connection} />}
      scene={
        <HomeScene
          ref={sceneRef}
          label={`${blobbi.name}'s home`}
          room="home"
          floorLabel={sleeping ? `${blobbi.name} is asleep` : canWalk ? `Call ${blobbi.name} here` : `${blobbi.name} stays put`}
          onFloorTap={interactive ? onFloorTap : undefined}
          pointerHandlers={scene.scenePointerHandlers}
          objects={
            <>
              <FurnitureLayer placements={placements} interactive={interactive && !busyWithObject} onUse={useFurniture} stateOf={stageStateOf} />
              <SceneObjectView
                def={door}
                state={doorPrompt ? 'open' : 'closed'}
                onTap={interactive && !busyWithObject ? goToDoor : undefined}
                aside={
                  doorPrompt && (
                    <a href={BLOBBI_ISLAND_URL} target="_blank" rel="noopener noreferrer" className="door-prompt lifecycle-pill !animate-none" data-testid="door-prompt" onClick={() => setDoorPrompt(false)}>
                      <MapPin className="h-4 w-4" aria-hidden />
                      Go to the Island
                    </a>
                  )
                }
              >
                <DoorArt open={doorPrompt} />
              </SceneObjectView>
              {offer && offerObject && (
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
            <BlobbiActor ref={actorRef} blobbi={shownBlobbi} presentation={scene.presentation} inBed={inBed} happyKey={resultKey} onPoke={inCeremony ? undefined : onPoke} eggCrack={blobbi.stage === 'egg' ? eggCrack : undefined} effects={actorEffects} accessories={accessories}>
              <NeedBubbles items={sleeping || inCeremony ? [] : statItems} />
              <CareFeedback result={feedback} resultKey={resultKey} />
            </BlobbiActor>
          }
          foreground={
            <>
              <div className="absolute inset-x-4 top-16 flex flex-col items-center gap-2">
                <CareError error={care.error} />
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
              {streakMoment?.milestone && <StreakMoment change={streakMoment} onDone={dismissStreakMoment} reducedMotion={reducedMotion} />}
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
          options={selectedVerb && options.length > 0 ? <CareOptions verb={selectedVerb} options={options} onChoose={chooseOption} /> : undefined}
        />
      }
      overlays={
        <>
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
            devForce={devForce}
          />
          <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
          <InventorySheet
            open={itemsOpen}
            onClose={() => setItemsOpen(false)}
            inventory={inventory}
            blobbiName={blobbi.name}
            onUse={(entry) => offerItem({ source: 'owned', entry })}
            openUse={useItem.hasOpenUse(blobbi.d)}
            busy={useItem.isPending || useStarter.isPending || busyWithObject}
            worn={worn.wornAddresses}
          />
        </>
      }
    />
  );
}
