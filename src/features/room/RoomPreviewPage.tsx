/**
 * `/room` — the 3D room, as a preview beside the home (dev builds only; see
 * `AppRouter`). Milestones 1 and 2 of bringing Ditto's room to this app: the
 * diorama, its camera and lighting, the registry's rooms painted as paper,
 * Ditto's default furniture, the room switcher, and the player's own Blobbi
 * drawn by the canonical renderer, walking the room at its own gait's pace,
 * facing the way it goes, looking at the pointer when its face is visible.
 * Decorating (milestone 3) is Ditto's: the decorate button, the editing
 * camera, drag and drop on the grid, the catalog tray, wallpaper and
 * flooring, save and cancel. What is saved is kept on this device, per
 * player, Blobbi and room (milestone 5, `room-store.ts`): never published.
 *
 * Care (milestone 4): each room's items in a strip along the dock (the
 * registry's activities: food and drink in the kitchen, soap and medicine in
 * the care room, toys in the living room), starters and owned items with
 * their counts; selected, then used with the Use button or dragged onto the
 * Blobbi or the floor; the bed, the fridge, the tub and the toy box answer a
 * tap. Every use goes through the home's own write paths (`useRoomCare`);
 * choosing, dragging, walking and the room itself publish nothing.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useProjectedBlobbiState } from '@blobbi-kit/react';
import type { BlobbiCompanion, NostrEvent } from '@blobbi-kit/core';

import { useHomeBlobbi } from '@/hooks/useHomeBlobbi';
import { useRelayHealth } from '@/hooks/useRelayHealth';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { getStatStatus, getVisibleStats, type BlobbonautProfile } from '@blobbi-kit/core';
import { MenuSheet } from '@/features/home/shell';
import { InventorySheet, useWornEquipment } from '@/features/inventory';
import { ownedEntry } from '@/features/care-ui/care-entries';
import { useFirstBlobbiHatch, useLifecycle, type CeremonyKind } from '@/features/lifecycle';
import { detectStreakIncrease, flameDays, type StreakChange } from '@/features/home/streak';
import { useCareGiven } from '@/features/journey/care-receipts';
import { StreakMoment } from '@/features/home/StreakMoment';
import { describeMood } from '@/features/home/mood';
import type { StatItem } from '@/features/home/BlobbiStatusPanel';
import { RoomBlobbiSheet } from './components/RoomBlobbiSheet';
import { HatchTheater } from './components/HatchTheater';
import { soundForReveal } from '@/features/sound';
import { baselineExpression } from '@/features/home/scene/reactions';
import { useGazePolicy } from '@/features/home/scene/useGazePolicy';
import { useHoverCapable } from '@/features/home/scene/SceneSettings';
import { DEFAULT_ROOM, resolveRoom, type RoomId } from '@/features/home/rooms/rooms';
import { RoomShell, type RoomEditorBinding } from './components/RoomShell';
import { RoomBlobbi } from './components/RoomBlobbi';
import { RoomDecoratorOverlay, RoomDecoratorToolbar } from './components/RoomDecorator';
import { useRoomNavigation } from './hooks/useRoomNavigation';
import { useRoomDecorator } from './hooks/useRoomDecorator';
import { useRoomActorModel } from './hooks/useRoomActorModel';
import { useRoomCare } from './hooks/useRoomCare';
import { useRoomInteractions } from './hooks/useRoomInteractions';
import { propKindFor } from './lib/room-props';
import { useRoomLife } from './hooks/useRoomLife';
import { useSound, soundForPoke } from '@/features/sound';
import { useReducedMotion } from '@/features/home/scene/SceneSettings';
import { POKE_PATIENCE, pokeReaction, type PokeGesture } from '@/features/home/personality';
import type { EyeOffset } from '@/features/home/scene/gaze';
import type { HealthLevel } from '@/lib/relay-health';
import { usePresence } from '@/features/teleport/react/usePresence';
import { journeyFrame } from '@/features/teleport/timeline';
import { RoomDevTools } from './components/RoomDevTools';
import { RoomErrorBoundary } from './components/RoomErrorBoundary';
import { useRoomItemDrag } from './hooks/useRoomItemDrag';
import { RoomBottomBar, RoomCareCards } from './components/RoomCarePanel';
import { RoomHeader } from './components/RoomHeader';
import { WorldsSheet } from '@/features/worlds/WorldsSheet';
import { useGuest, useGuestUi, useSaveInvite } from '@/features/guest';
import { GuestInvite } from '@/features/guest/GuestInvite';
import { GuestStatusPill, GuestStatusSheet, SavedPill } from '@/features/guest/GuestStatus';
import { useWorldDeparture } from '@/features/worlds/useWorldDeparture';
import { DepartureCard } from '@/features/worlds/DepartureCard';
import { useJourney } from '@/features/journey/useJourney';
import { useDailyXp } from '@/features/progression/useDailyXp';
import { JourneySheet } from '@/features/journey/JourneySheet';
import { ChapterToast } from '@/features/journey/ChapterToast';
import type { ObjectiveAction } from '@/features/journey/journey';
import type { LifecycleTask } from '@/features/lifecycle';
import { AdoptionFlow } from '@/features/adoption/AdoptionFlow';
import { GameOverlay } from '@/features/home/shell/GameOverlay';
import { RoomStatusHud } from './components/RoomStatusHud';
import { RoomBlobbiOverlay, RoomDragGhost, RoomFloorItem } from './components/RoomCareParts';
import { BathToolBar, BathTouchLayer, useBathSession, type BathCommitOutcome, type BathItem } from '@/features/bath';
import { bodyBottomInset } from './lib/body-inset';
import { BATH_ELEV, type BathSceneState } from './lib/scene/bath-scene';
import type { Run } from './lib/room-interaction';
import type { CareChoice } from '@/features/home/care-model';
import { CAMERA_AZIMUTH } from './lib/room-geometry';
import { useReactionPolicy } from '@/features/home/scene/useReactionPolicy';
import { roomById, type RoomActivity } from '@/features/home/rooms/rooms';
import { resolveFurniture, type FurnitureInteraction } from './lib/furniture-3d';
import { MAIN_BLOBBI, blobbiReachTiles } from './lib/room-geometry';
import type { FurniturePlacement } from './lib/room-furniture';
import { planDrop, planUse, shelfEntries, shelfKey, type CareShelf, type DropPlace, type RoomCareEntry } from './lib/room-care';
import { RoomSettings } from './components/RoomSettings';
import { readRoomIntroSeen, writeRoomIntroSeen } from '@/lib/home-experience';
import { FridgeSheet } from './components/FridgeSheet';
import { ModeToggle } from '@/features/home/shell/ModeToggle';
import { RoomIntro } from './components/RoomIntro';
import { LOOK_GUIDE_DOCK_MS, guideAfterIntro, guideOnSheetOpen, readLookGuideShown, writeLookGuideShown, type LookGuideStage } from './lib/look-guide';
import { useModeSwitch } from '@/features/home/shell/useModeSwitch';
import { useBlobbiAppearance } from './lib/blobbi-appearance';
import { ZOOM_STEP, useRoomZoom } from './lib/room-zoom';
import { useRoomSession } from './lib/room-session';
import { roomStoreKey, type LoadStatus, type SaveStatus } from './lib/room-store';
import { walkSpeedFor } from './lib/room-pace';
import { pickGaze } from './lib/room-gaze';
import { useRoomMemory } from './hooks/useRoomMemory';
import { useRoomTransitions } from './hooks/useRoomTransitions';
import { useRoomQuality } from './hooks/useRoomQuality';
import { arrivalDelay, arrivesOnEntry } from './lib/room-arrival';
import type { RoomSceneStatus } from './hooks/useRoomScene';
import { useEatingPresentation } from './hooks/useEatingPresentation';
import { usePetting } from './hooks/usePetting';
import { useExpression } from '@/features/expression/react/useExpression';
import { PRIORITY } from '@/features/expression/controller';
import { proceduralFace, type ExpressionName } from '@/features/expression/faces';

/** The room's dev tools (animations, teleport, performance…): a development build with the dev tools only, never production. */
const DEV_TELEPORT = import.meta.env.DEV && import.meta.env.VITE_BLOBBI_DEV_TOOLS === 'true';
/** Concentrating on a journey: eyes shut tight, brows down, mouth set, cheeks flushed with the effort (the renderer's own parts). */
/** How long the relieved, happy face lasts after an arrival. */
const RELIEF_MS = 1_800;
/** How long its eyes stay on something the player touched. */
const ATTENTION_MS = 1_600;
/** When a 3D Blobbi's landing hop comes after a room change: as the room finishes folding in. */
/** How long the carousel pulses when a piece of furniture points at it (one turn of Ditto's guide pulse). */
const PULSE_MS = 2_600;

export default function RoomPreviewPage() {
  const home = useHomeBlobbi();
  // Connection health for the header: a retry forgets past failures and re-reads
  const { health, reset } = useRelayHealth();
  const refresh = home.refresh;
  const retry = useCallback(() => {
    reset();
    refresh();
  }, [reset, refresh]);
  const connection = useMemo(() => ({ level: health.level, online: health.online, onRetry: retry }), [health.level, health.online, retry]);
  return (
    <div className="game-shell" data-testid="room-preview">
      <div className="game-frame">
        <div className="game-column">
          {home.status === 'ready' && home.current ? (
            // A render error in the room stays in the room: the page, the fixture and the way home remain
            <RoomErrorBoundary>
              <BlobbiRoom
                key={`${home.pubkey ?? 'anon'}:${home.current.d}`}
                blobbi={home.current}
                companions={home.companions}
                profile={home.profile}
                pubkey={home.pubkey}
                onSelect={home.select}
                updateCompanionEvent={home.updateCompanionEvent}
                refresh={home.refresh}
                connection={connection}
              />
            </RoomErrorBoundary>
          ) : home.status === 'signed-out' || home.status === 'empty' ? (
            // The room is the home; the way in (the welcome, an account, the egg) is at the root
            <Navigate to="/" replace />
          ) : (
            <RoomMessage status={home.status} error={home.error} onRetry={home.refresh} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Why the room has no Blobbi to show: a read still out, a failed one (with its cause and a retry), nobody signed in, nothing adopted. */
function RoomMessage({ status, error, onRetry }: { status: ReturnType<typeof useHomeBlobbi>['status']; error: unknown; onRetry: () => void }) {
  const failed = status === 'error';
  const text =
    status === 'signed-out' ? 'Sign in on the home screen to see your Blobbi in its room.'
    : status === 'empty' ? 'Adopt a Blobbi on the home screen first.'
    : failed ? (error instanceof Error && error.message ? error.message : 'The relays did not answer.')
    : 'Looking for your Blobbi…';
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center" role={failed ? 'alert' : 'status'} data-testid="room-message" data-status={status}>
      <p className="scene-text max-w-md text-sm text-foreground/80">{text}</p>
      {failed && (
        <button type="button" onClick={onRetry} className="onboard-btn !w-auto !px-4 !py-2 text-sm" data-testid="room-retry">
          Try again
        </button>
      )}
      <Link to="/" className="onboard-btn onboard-btn--secondary !w-auto !px-4 !py-2 text-sm">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Home
      </Link>
    </div>
  );
}

/** What a piece of furniture opens when tapped: the items of its activities (the bed is rest, handled on its own). */
const FURNITURE_SHELVES: Record<Exclude<FurnitureInteraction, 'bed'>, { label: string; activities: readonly RoomActivity[] }> = {
  fridge: { label: 'From the fridge', activities: ['feed', 'boost'] },
  bath: { label: 'At the tub', activities: ['clean', 'medicine'] },
  toys: { label: 'From the toy box', activities: ['play'] },
};

interface BlobbiRoomProps {
  blobbi: BlobbiCompanion;
  companions: readonly BlobbiCompanion[];
  profile: BlobbonautProfile | null | undefined;
  pubkey: string | undefined;
  onSelect: (d: string) => void;
  updateCompanionEvent: (event: NostrEvent) => void;
  refresh: () => void;
  connection?: { level: HealthLevel; online: boolean; onRetry: () => void };
}

/** No growing-up tasks (the journey's list when the Blobbi is not on its way to growing up). */
const NO_TASKS: readonly LifecycleTask[] = [];

/** How long a first Blobbi's egg is simply there before the theatre opens on it, for the player's taps. */
const FIRST_HATCH_LEAD_MS = 1_400;
/** How long the room's reveal face lasts after a hatch or an evolution. */
const REVEAL_MS = 2_400;

function BlobbiRoom({ blobbi, companions, profile, pubkey, onSelect, updateCompanionEvent, refresh, connection }: BlobbiRoomProps) {
  const projected = useProjectedBlobbiState(blobbi);
  const isSleeping = blobbi.state === 'sleeping';
  const isEgg = blobbi.stage === 'egg';
  // What the room remembers on this device: the last room, where the Blobbi stood in each, the rooms seen built
  const memory = useRoomMemory(pubkey, blobbi.d);
  // The room the player chose (the last one, on a return); a sleeper is in the bedroom whatever was chosen.
  const [chosenRoom, setChosenRoom] = useState<RoomId>(() => memory.initialRoom ?? DEFAULT_ROOM);
  const resolvedRoom = resolveRoom(chosenRoom, isSleeping);
  useEffect(() => memory.rememberRoom(chosenRoom), [memory, chosenRoom]);
  // What each room shows this session: saved decorations, else the defaults.
  // Kept on this device for this player and this Blobbi; written on Save only
  const rooms = useRoomSession({ storageKey: roomStoreKey(pubkey, blobbi.d) });
  const storeNotice = useStoreNotice(rooms.persistence);
  const decorator = useRoomDecorator({ roomId: resolvedRoom, furniture: rooms.furnitureFor(resolvedRoom), layout: rooms.layoutFor(resolvedRoom), onSave: rooms.saveRoom });
  const nav = useRoomNavigation({ blobbi, editing: decorator.editing });
  const actorRef = useRef<HTMLDivElement | null>(null);
  // How the Blobbi gets from room to room: a scene (a first visit's spectacle, a quick return, now and then a
  // surprise), the new room coming on screen part way through it. Everything it borrows is late-bound: it only
  // calls these once the room is drawn.
  const transitions = useRoomTransitions({
    initialRoom: resolvedRoom,
    controlRef: nav.shellProps.controlRef,
    boxRef: actorRef,
    memory,
    canAct: () => canActRef.current,
    reducedMotion: () => reduceMotionRef.current,
    // The body's widest reach, toward the open edges or the walls alike
    reach: () => { const r = blobbiReachTiles(blobbi.stage); return Math.max(r.front, r.back); },
    play: (sound) => play(sound),
    showFace: (source, name, opts) => showFace(source, name, opts),
    clearFace: (source) => clearFace(source),
  });
  const requestRoom = transitions.request;
  useEffect(() => {
    if (!decorator.editing) requestRoom(resolvedRoom);
  }, [resolvedRoom, decorator.editing, requestRoom]);
  // The room on screen (the room being decorated is pinned, so falling asleep meanwhile doesn't move the view out
  // from under the draft); the header names the one asked for at once
  const roomId = decorator.room ?? transitions.shownRoom;
  const transitioning = transitions.transitioning;
  const { facing, motion } = nav;
  const baseline = useMemo(() => baselineExpression(blobbi, projected?.stats), [blobbi, projected?.stats]);
  // A care result's face for a moment (the 2D drawing's; the 3D model hops), then the baseline again
  const reactions = useReactionPolicy();
  // Its face: one controller decides between everything that wants one (a reaction, a journey, a scene, care,
  // petting), by priority; the drawing eases between the kit's faces, and the 3D model wears the same face
  const expression = useExpression(baseline, { reducedMotion: false });
  const showFace = expression.show;
  const clearFace = expression.clear;
  useEffect(() => {
    if (reactions.reaction && reactions.reaction !== 'neutral') showFace('reaction', reactions.reaction, { priority: PRIORITY.reaction });
    else clearFace('reaction');
  }, [reactions.reaction, showFace, clearFace]);
  const layout = decorator.layoutDraft ?? rooms.layoutFor(roomId);
  const placements = decorator.draft ?? rooms.furnitureFor(roomId);
  const walkSpeed = useMemo(() => walkSpeedFor(blobbi.stage, blobbi.visualGeneration), [blobbi.stage, blobbi.visualGeneration]);
  // How it is drawn: the kit's 2D (default) or the 3D model, this device's choice; one Blobbi, one walk, either way
  const [appearance, setAppearance] = useBlobbiAppearance();
  // How much the 3D room spends drawing itself: the player's choice, or chosen and adjusted for this device
  const quality = useRoomQuality();
  // How close the room is looked at: this device's preference over the responsive framing
  const zoom = useRoomZoom();
  const actor3d = useRoomActorModel(blobbi, appearance);
  // The 3D model could not be built here: the choice becomes 2D (kept), never switched back by itself
  useEffect(() => {
    if (actor3d.failed && appearance === '3d') setAppearance('2d');
  }, [actor3d.failed, appearance, setAppearance]);

  // The eyes: on the pointer while standing with a face in view (the home's
  // gaze policy over the room's own element), a glance the way it goes while walking.
  const shellRef = useRef<HTMLDivElement | null>(null);
  // Where the eyes are, for the gaze: the Blobbi's art box on its feet, in 2D and 3D alike (the 2D drawing's own box
  // is folded away while the model stands in, and measuring it aimed the model's eyes from its feet)
  const gazeBoxRef = useRef<HTMLDivElement | null>(null);
  const hoverCapable = useHoverCapable();
  const gaze = useGazePolicy({ actorRef: gazeBoxRef, sceneRef: shellRef, hoverCapable, actorKey: `${facing}:${motion}`, enabled: !isEgg && !isSleeping && facing !== 'back' && !decorator.editing });
  const pointerHandlers = useMemo(() => ({ onPointerMove: gaze.onPointerMove, onPointerLeave: gaze.onPointerLeave, onPointerDown: gaze.onPointerDown }), [gaze.onPointerMove, gaze.onPointerLeave, gaze.onPointerDown]);

  const { draft, layoutDraft, selectedIndex, select, setDraft, setLayoutDraft, move, setInvalid, invalid, save, cancel } = decorator;
  const controlRef = nav.shellProps.controlRef;

  // ─── Its body: one gesture vocabulary (the home's), played by whichever drawing stands in the room ───
  const { play } = useSound();
  const reducedMotion = useReducedMotion();
  const [gestureNow, setGestureNow] = useState<{ kind: PokeGesture; key: number } | null>(null);
  const gestureKey = useRef(0);
  const gesture = useCallback((kind: PokeGesture) => {
    gestureKey.current += 1;
    setGestureNow({ kind, key: gestureKey.current });
    controlRef.current?.gesture(kind);
  }, [controlRef]);
  // A moment's attention: its eyes on something the player just touched
  const [attention, setAttention] = useState<EyeOffset | null>(null);
  useEffect(() => {
    if (!attention) return;
    const timer = setTimeout(() => setAttention(null), ATTENTION_MS);
    return () => clearTimeout(timer);
  }, [attention]);

  // ─── Where it is: here, leaving, away, arriving (a journey is presentation only; nothing is written) ───
  const reduceMotionRef = useRef(reducedMotion);
  reduceMotionRef.current = reducedMotion;
  const [relievedFor, setRelievedFor] = useState<number | null>(null);
  // Coming home (`room-arrival.ts`): decided once, when the room mounts (never by a re-render): a hatched, awake
  // Blobbi is away at first and arrives once the room is on screen; an egg (its first moment is the hatch theatre)
  // and a sleeper are simply here
  const [arrival, setArrival] = useState<'waiting' | 'done' | 'none'>(() => (arrivesOnEntry({ stage: blobbi.stage, sleeping: isSleeping }) ? 'waiting' : 'none'));
  const presence = usePresence({
    initial: arrival === 'waiting' ? 'absent' : 'present',
    reducedMotion: () => reduceMotionRef.current,
    onCue: (cue) => {
      play(cue);
      if (cue === 'tada') {
        // "It worked!": eyes open, a relieved smile, a little hop
        setRelievedFor(presence.controller.snapshot().journey?.startedAt ?? null);
        showFace('relief', 'relieved', { priority: PRIORITY.journey, durationMs: RELIEF_MS });
        gesture('bounce');
      }
    },
  });
  const journey = presence.journey;
  const present = presence.state === 'present';
  // The room on screen: its scene's status, and whether the first room's fold-in has played (a room seen before, or
  // reduced motion, has none to wait for)
  const [sceneStatus, setSceneStatus] = useState<RoomSceneStatus | null>(null);
  // The scene's status as last reported, whatever the arrival is doing: decorating needs the 3D room, and the dock's
  // room button says why when there is none (M14.1)
  const [shellStatus, setShellStatus] = useState<RoomSceneStatus | null>(null);
  const sceneIs3d = shellStatus !== 'unavailable';
  const [entryBuilt, setEntryBuilt] = useState(() => transitions.roomEntry.intro !== 'build' || reducedMotion);
  const markSeen = memory.markSeen;
  const onRoomBuilt = useCallback((id: RoomId) => {
    markSeen(id);
    setEntryBuilt(true);
  }, [markSeen]);
  // The scene's status goes to the navigation (it walks only in a ready scene) and, while an arrival waits, to the
  // arrival. One handler for both: the shell takes one, and the navigation's must never be replaced
  const navStatus = nav.shellProps.onStatusChange;
  const arrivalWaiting = arrival === 'waiting';
  const onSceneStatus = useCallback((status: RoomSceneStatus) => {
    navStatus(status);
    setShellStatus(status);
    if (arrivalWaiting) setSceneStatus(status);
  }, [navStatus, arrivalWaiting]);
  const enterPresence = presence.enter;
  useEffect(() => {
    if (arrival !== 'waiting') return;
    const delay = arrivalDelay(sceneStatus, entryBuilt);
    if (delay === null) return;
    const timer = setTimeout(() => {
      setArrival('done');
      enterPresence();
    }, delay);
    return () => clearTimeout(timer);
  }, [arrival, sceneStatus, entryBuilt, enterPresence]);
  // Whether the Blobbi can play a room transition's scene: here, awake, hatched
  const canActRef = useRef(false);
  canActRef.current = present && !isEgg && !isSleeping;
  const absent = presence.state === 'absent';
  // Concentrating, eyes shut tight, the whole journey, until an arrival's "ta-da"
  const concentrating = journey !== null && !(journey.kind === 'arrive' && relievedFor === journey.startedAt);
  useEffect(() => {
    controlRef.current?.journey(journey ? { kind: journey.kind, startedAt: journey.startedAt, reduced: journey.reduced } : null);
  }, [controlRef, journey]);
  // The development scrubber's moment, on both drawings at once
  const [journeyPreview, setJourneyPreview] = useState<{ kind: 'depart' | 'arrive'; t: number; reduced: boolean } | null>(null);
  useEffect(() => {
    controlRef.current?.journeyPreview(journeyPreview);
  }, [controlRef, journeyPreview]);
  // A scrubbed moment shows the face that moment asks for
  const previewFace = journeyPreview ? journeyFrame(journeyPreview.kind, journeyPreview.t, journeyPreview.reduced).face : null;
  const journeyFace: ExpressionName | null = previewFace === 'concentrate' || (!journeyPreview && concentrating) ? 'concentrating' : previewFace === 'relieved' ? 'relieved' : null;
  useEffect(() => {
    if (journeyFace) showFace('journey', journeyFace, { priority: PRIORITY.journey });
    else clearFace('journey');
  }, [journeyFace, showFace, clearFace]);
  // The 3D model wears the drawing's face (the kit's procedural face for the same expression)
  useEffect(() => {
    controlRef.current?.face(proceduralFace(expression.face === baseline ? (baseline === 'neutral' ? null : baseline) : expression.face));
  }, [controlRef, expression.face, baseline, actor3d.model]);

  // ─── Care: one adapter over the home's write paths ───
  const hop = useCallback(() => gesture('bounce'), [gesture]);
  const care = useRoomCare({ blobbi, pubkey, updateCompanionEvent, refresh, nav, react: reactions.react, hop });
  // The scenes around care (`useRoomInteractions`): the dish, the ball, the Blobbi noticing, coming, eating, playing
  const interactions = useRoomInteractions({
    care,
    nav,
    controlRef: nav.shellProps.controlRef,
    roomId: transitions.shownRoom,
    present: present && !isEgg && !isSleeping,
    enabled: !decorator.editing && !transitions.transitioning,
    reducedMotion,
    blobbiName: blobbi.name,
    showFace,
    clearFace,
    gesture,
    play,
  });
  // The dev tools open on their performance view, with the indicator on, when the link says `?perf` (handy on a phone)
  const [perfRequested] = useState(() => typeof location !== 'undefined' && new URLSearchParams(location.search).has('perf'));
  // Food taken: eaten bite by bite once its use has landed (never before): the face and the body's dip
  const eatingView = useEatingPresentation({ eating: interactions.eating, controlRef, boxRef: actorRef, showFace, clearFace, reducedMotion });

  // ─── The bath (M15): a cleaning item is a small game at the tub, one write at its end ───
  const [bathGaze, setBathGaze] = useState<EyeOffset | null>(null);
  const placementsRef = useRef(placements);
  placementsRef.current = placements;
  const tubIndex = useMemo(() => placements.findIndex((p) => p.at === 'floor' && resolveFurniture(p.id)?.interaction === 'bath'), [placements]);
  const tubIndexRef = useRef(tubIndex);
  tubIndexRef.current = tubIndex;
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const careRef = useRef(care);
  careRef.current = care;
  /** The write of a bath: the room's own offer, placed and begun only when the bath is played out. */
  const bathWrite = useCallback(
    async (choice: CareChoice, name: string): Promise<BathCommitOutcome> => {
      const c = careRef.current;
      const at = controlRef.current?.blobbiPosition() ?? { x: 4.5, z: 4.5 };
      const entry = { key: `bath|${name}`, choice, name, glyph: choice.entry.item.glyph, action: 'clean' as const, quantity: null, usable: true, reason: null };
      const placed = c.place(entry, { kind: 'set-down', x: at.x, z: at.z }, roomIdRef.current);
      if (!placed) return { kind: 'failed', error: 'Another use is still finishing. Try again in a moment.' };
      const outcome = await c.begin(placed.key);
      if (outcome.kind === 'landed') {
        c.finish(placed.key, { feedback: outcome.feedback, alreadyApplied: !!outcome.result?.alreadyApplied });
        return { kind: 'landed', alreadyApplied: !!outcome.result?.alreadyApplied };
      }
      return { kind: 'failed', error: outcome.error };
    },
    [controlRef],
  );
  const bathRetry = useCallback(async (): Promise<BathCommitOutcome> => {
    const c = careRef.current;
    const current = c.offer;
    const again = c.retry();
    if (!again || !current) return { kind: 'failed', error: 'Nothing to try again.' };
    const outcome = await again;
    if (outcome.kind === 'landed') {
      c.finish(current.key, { feedback: outcome.feedback, alreadyApplied: !!outcome.result?.alreadyApplied });
      return { kind: 'landed', alreadyApplied: !!outcome.result?.alreadyApplied };
    }
    return { kind: 'failed', error: outcome.error };
  }, []);
  const runBath = interactions.run;
  const bathStart = useCallback((_name: string, script: (run: Run) => Promise<void>) => runBath('bathing', script), [runBath]);
  const bath = useBathSession({
    name: blobbi.name,
    reducedMotion,
    hygiene: projected?.stats.hygiene,
    start: bathStart,
    // Into the tub: a walk to it, then a hop onto its floor, facing the room; an egg (no walk) and a room without a
    // tub are bathed where the Blobbi lies
    enter: isEgg || tubIndex < 0
      ? null
      : async (run: Run) => {
          const control = controlRef.current;
          const rect = control?.itemFootprint(tubIndexRef.current);
          if (!control || !rect || !nav.canWalk) return true;
          const cx = (rect.x0 + rect.x1) / 2;
          const cz = (rect.z0 + rect.z1) / 2;
          const outcome = await run.until(nav.approach(cx, cz, Math.max(rect.x1 - rect.x0, rect.z1 - rect.z0) / 2));
          if (outcome !== 'arrived') return false;
          // A little hop in: up over the rim and down onto the tub's floor (at once under reduced motion)
          const from = control.blobbiPosition() ?? { x: cx, z: cz };
          const steps = reduceMotionRef.current ? 1 : 10;
          for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const arc = i === steps ? 0 : Math.sin(t * Math.PI) * 1.1;
            control.script({ x: from.x + (cx - from.x) * t, z: from.z + (cz - from.z) * t, elev: BATH_ELEV * t + arc, heading: CAMERA_AZIMUTH });
            if (i < steps) await run.wait(34);
          }
          return true;
        },
    leave: () => {
      // Out of the tub: back on the floor, at the free spot nearest it; a write that failed is taken back with the bath
      controlRef.current?.script(null);
      controlRef.current?.bath(null);
      careRef.current.clear();
    },
    commit: (choice) => bathWrite(choice, bathItemRef.current?.name ?? 'Soap'),
    retry: bathRetry,
    drawing: () => actorRef.current?.querySelector('svg') ?? null,
    face: (name) => (name ? showFace('bath', name, { priority: PRIORITY.care }) : clearFace('bath')),
    gaze: setBathGaze,
    gesture,
    play,
    notify: care.notify,
  });
  const bathItemRef = useRef<BathItem | null>(null);
  const bathView = bath.view;
  const bathing = bath.active;
  // The scene draws the bath (the hollow tub, the water, the foam, the tools) from the same state the layer draws
  useEffect(() => {
    const control = controlRef.current;
    if (!control) return;
    if (!bathView || bathView.inPlace || tubIndex < 0) {
      control.bath(null);
      return;
    }
    const state: BathSceneState = { itemIndex: tubIndex, status: bathView.status, tool: bathView.tool, foam: bathView.foam, mask: bathView.mask, grid: bathView.grid, outline: bathView.outline, pointer: bathView.pointer, celebrating: bathView.celebrating };
    control.bath(state);
  }, [bathView, tubIndex, controlRef]);
  // The 3D model draws the foam, the water and the tools itself; the page's drawing has them on its layer
  const [modelDrawn, setModelDrawn] = useState(false);
  useEffect(() => {
    if (!bathView) return;
    const read = () => setModelDrawn(controlRef.current?.modelDrawn() ?? false);
    read();
    const timer = setInterval(read, 400);
    return () => clearInterval(timer);
  }, [bathView, controlRef, actor3d.model]);
  const bathInset = useMemo(() => (isEgg ? 0 : bodyBottomInset(blobbi, facing)), [blobbi, facing, isEgg]);
  const startBath = bath.start;
  const offerBath = useCallback((entry: RoomCareEntry): boolean => {
    if (!present || transitioning || decorator.editing) return false;
    const item: BathItem = { choice: entry.choice, name: entry.name, glyph: entry.glyph };
    bathItemRef.current = item;
    return startBath(item, { inPlace: isEgg || tubIndexRef.current < 0 || !nav.canWalk });
  }, [startBath, present, transitioning, decorator.editing, isEgg, nav.canWalk]);
  const cancelBath = bath.cancel;

  // ─── The screens over the room: the menu, the Blobbi's details, the whole inventory ───
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);
  const statItems = useMemo<StatItem[]>(
    () => (projected ? getVisibleStats(blobbi.stage).map((stat) => ({ stat, value: projected.stats[stat], status: getStatStatus(blobbi.stage, stat, projected.stats[stat]) })) : []),
    [projected, blobbi.stage],
  );
  const mood = describeMood(blobbi, projected?.stats);
  // What the Island dressed it in, drawn on the 2D drawing too (read-only; the 3D model goes undressed)
  const worn = useWornEquipment({ pubkey, blobbi, items: care.inventory.items });
  const accessories = isEgg ? undefined : worn.accessoriesFor(facing);
  // The lifecycle: the kit's transitions, as on the classic home; the room's reveal is a face, a hop and a sound
  const lifecycle = useLifecycle({ blobbi, profile, pubkey, updateCompanionEvent, invalidate: refresh });
  const firstBlobbi = useFirstBlobbiHatch({ blobbi, companions, pubkey });
  const lifecyclePending = lifecycle.pending;
  // The journey: chapters derived from the canonical record (and a cuddle and a nap remembered on this device)
  const evolveTasks = lifecycle.view.process === 'evolving' ? lifecycle.view.tasks : NO_TASKS;
  const journeyBook = useJourney({ pubkey, companions, current: blobbi, profile, evolveTasks });
  // Today's missions: the ecosystem's daily missions, the XP they pay written once per day (`features/progression`)
  const daily = useDailyXp({ pubkey, companions, profile });
  // A guest's room (M14): the worlds and another egg wait for a saved Blobbi; the menu offers the save
  const guest = useGuest();
  const guestUi = useGuestUi();
  const guestActive = guest.mode === 'active';
  // The one switch between the two homes (M14.1); the first 3D asked first, from the 2D home
  const modeSwitch = useModeSwitch();
  // The room's introduction, the first time it opens on this device (read once; the choice is written on dismissal)
  const [introOpen, setIntroOpen] = useState(() => !readRoomIntroSeen());
  // The one-time guide to the Blobbi's look (M14.3): the dock's bubble after the introduction, the lit card in the
  // sheet it opens, then never again on this browser (remembered the moment it shows)
  const [lookGuide, setLookGuide] = useState<LookGuideStage | null>(null);
  const endLookGuide = useCallback(() => setLookGuide(null), []);
  const openSheet = useCallback(() => {
    setSheetOpen(true);
    setLookGuide((g) => guideOnSheetOpen(g));
  }, []);
  useEffect(() => {
    if (lookGuide !== 'dock') return;
    // Another interaction (the floor, the carousel, the menu, the room) puts the bubble away; so does waiting
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.('[data-testid="room-bar-blobbi-slot"]')) return;
      setLookGuide(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLookGuide(null);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    const t = setTimeout(() => setLookGuide(null), LOOK_GUIDE_DOCK_MS);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      clearTimeout(t);
    };
  }, [lookGuide]);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [worldsOpen, setWorldsOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [adoptOpen, setAdoptOpen] = useState(false);
  const { noteCare, noteNapped } = journeyBook;
  const careFeedbackKey = care.feedback?.key;
  const careFeedbackAction = care.feedback?.result.action;
  useEffect(() => {
    if (careFeedbackKey !== undefined && careFeedbackAction) {
      noteCare(careFeedbackAction);
      setCaredThisVisit(true);
    }
  }, [careFeedbackKey, careFeedbackAction, noteCare]);
  useEffect(() => {
    if (isSleeping) noteNapped();
  }, [isSleeping, noteNapped]);
  const ceremonyView = useMemo(
    () => ({ phase: lifecyclePending === 'hatch' || lifecyclePending === 'evolve' ? ('publishing' as const) : ('idle' as const), kind: lifecyclePending === 'hatch' || lifecyclePending === 'evolve' ? lifecyclePending : null, error: lifecycle.error, dismiss: lifecycle.clearError }),
    [lifecyclePending, lifecycle.error, lifecycle.clearError],
  );
  const { hatch, evolve } = lifecycle;
  const confirmFirstBlobbi = firstBlobbi.confirm;
  const ceremonyRunning = useRef(false);
  // A hatch is the theatre (`HatchTheater`): the shell opens under the player's taps, and it owns the one write and
  // the reveal (M12.3)
  const [theater, setTheater] = useState(false);
  const [hatchError, setHatchError] = useState<string | null>(null);
  const performHatch = useCallback(async (): Promise<boolean> => {
    setHatchError(null);
    lifecycle.clearError();
    // The first egg's shortcut (no missions) only once the relays confirm it is still the first; fails closed
    if (firstBlobbi.qualifies && !(await confirmFirstBlobbi())) {
      setHatchError('Your egg could not be confirmed with the relays yet.');
      return false;
    }
    return hatch();
  }, [firstBlobbi.qualifies, confirmFirstBlobbi, hatch, lifecycle]);
  const endTheater = useCallback(
    (hatched: boolean) => {
      setTheater(false);
      ceremonyRunning.current = false;
      if (hatched) {
        gesture('bounce');
        showFace('reveal', 'happy', { priority: PRIORITY.journey, durationMs: REVEAL_MS });
      }
    },
    [gesture, showFace],
  );
  // Hatched elsewhere meanwhile (another device): the kit refused a second hatch; the collection catches up
  const lifecycleError = lifecycle.error?.message ?? null;
  useEffect(() => {
    if (lifecycleError && /already hatched/i.test(lifecycleError)) refresh();
  }, [lifecycleError, refresh]);
  const lifecycleNext = lifecycle.view.next;
  const startCeremony = useCallback(
    async (kind: CeremonyKind) => {
      if (ceremonyRunning.current || blobbi.state !== 'active') return;
      // The kit's rules, as on the classic home: an egg hatches when its incubation is done (the account's first egg
      // needs none, confirmed with the relays before the write); a baby grows up when its tasks are done
      if (kind === 'hatch') {
        if (blobbi.stage !== 'egg') return;
        if (!firstBlobbi.qualifies && lifecycleNext !== 'hatch') return;
        ceremonyRunning.current = true;
        setSheetOpen(false);
        setMenuOpen(false);
        setTheater(true);
        return;
      }
      if (lifecycleNext !== 'evolve') return;
      ceremonyRunning.current = true;
      try {
        const landed = await evolve();
        if (!landed) return;
        setSheetOpen(false);
        play(soundForReveal(kind));
        showFace('reveal', 'excited', { priority: PRIORITY.journey, durationMs: REVEAL_MS });
        gesture('bounce');
      } finally {
        ceremonyRunning.current = false;
      }
    },
    [blobbi.state, blobbi.stage, firstBlobbi.qualifies, lifecycleNext, evolve, play, showFace, gesture],
  );
  // An egg that may hatch now (the account's first needs nothing more; another once its incubation is done). Being
  // ready is never the hatch itself: the shell opens under the player's taps, in the theatre
  const hatchReady = isEgg && blobbi.state === 'active' && !!profile && (firstBlobbi.qualifies || lifecycleNext === 'hatch');
  // The account's first egg: a moment after it is on screen and the room is quiet, the theatre opens by itself, once
  // per visit (a failed write's Later leaves the invitation in the room). Nothing is written until the last tap
  const inviteDue = firstBlobbi.qualifies && hatchReady && care.offer === null && interactions.activity === null && !transitions.transitioning && !theater;
  const invited = useRef(false);
  useEffect(() => {
    if (blobbi.stage !== 'egg') invited.current = false;
  }, [blobbi.stage]);
  useEffect(() => {
    if (!inviteDue || invited.current) return;
    const timer = setTimeout(() => {
      invited.current = true;
      void startCeremony('hatch');
    }, FIRST_HATCH_LEAD_MS);
    return () => clearTimeout(timer);
  }, [inviteDue, startCeremony]);
  const inviteHatch = useCallback(() => void startCeremony('hatch'), [startCeremony]);
  // The streak: noticed only when the authoritative number goes up between two versions of this Blobbi
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
  // The flame only after real care, never for hatching alone (`flameDays`, M14.1): the same rule as the 2D home's
  const [caredThisVisit, setCaredThisVisit] = useState(false);
  const careGiven = useCareGiven(pubkey, caredThisVisit);
  const streak = useMemo(() => ({ days: flameDays(blobbi.careStreak, careGiven), bumpKey: streakBump }), [blobbi.careStreak, careGiven, streakBump]);
  const usableItemCount = care.inventory.items.filter((i) => i.usability.ok && !i.unverified).length;

  // What the strip shows: the room's own shelf, or what a piece of furniture opened (until the room changes)
  const [furnitureShelf, setFurnitureShelf] = useState<CareShelf | null>(null);
  // A piece of furniture pointed at the carousel: its middle card pulses for a moment (Ditto's guide ring)
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!pulse) return;
    const timer = setTimeout(() => setPulse(false), PULSE_MS);
    return () => clearTimeout(timer);
  }, [pulse]);
  useEffect(() => setFurnitureShelf(null), [roomId]);
  const shelf = useMemo<CareShelf>(() => furnitureShelf ?? { kind: 'room', roomId }, [furnitureShelf, roomId]);
  const hasStrip = furnitureShelf !== null || (roomId !== 'rest' && roomId !== 'closet');
  const entries = useMemo(() => (hasStrip ? shelfEntries(shelf, care.inventory) : []), [hasStrip, shelf, care.inventory]);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  // The selection, per shelf, for this visit (React state only; selecting never uses anything)
  const [selections, setSelections] = useState<Record<string, string>>({});
  const currentShelfKey = shelfKey(shelf);
  const chosen = selections[currentShelfKey];
  const selectedKey = chosen && entries.some((e) => e.key === chosen) ? chosen : null;
  const selectItem = useCallback((key: string) => setSelections((s) => (s[currentShelfKey] === key ? s : { ...s, [currentShelfKey]: key })), [currentShelfKey]);

  // Where a point in the room lands: on the Blobbi (as a tap would find it, 2D or 3D alike), the floor, or nowhere
  const placeAt = useCallback((clientX: number, clientY: number): DropPlace => {
    const control = controlRef.current;
    const hit = control?.pickAt(clientX, clientY);
    if (!control || !hit) return { kind: 'nowhere' };
    if (hit.kind === 'actor') return hit.id === MAIN_BLOBBI ? { kind: 'blobbi' } : { kind: 'nowhere' };
    if (hit.kind === 'floor') return { kind: 'floor', x: hit.x, z: hit.z };
    const floor = control.floorAt(clientX, clientY);
    return floor ? { kind: 'floor', ...floor } : { kind: 'nowhere' };
  }, [controlRef]);
  const applyEntry = interactions.offer;
  const drag = useRoomItemDrag({
    onTap: selectItem,
    // Lights the drop ring or the floor under the item, with no render (the shell's data attribute)
    onHover: (_key, point) => {
      const shell = shellRef.current?.querySelector<HTMLElement>('[data-testid="room-shell"]');
      if (!shell) return;
      if (point) shell.dataset.drop = placeAt(point.x, point.y).kind;
      else delete shell.dataset.drop;
    },
    onDrop: (key, clientX, clientY) => {
      const entry = entriesRef.current.find((e) => e.key === key);
      if (!entry) return;
      selectItem(key);
      const plan = planDrop(entry.action, placeAt(clientX, clientY), controlRef.current?.blobbiPosition() ?? null);
      if (plan.kind === 'cancel') return;
      // A cleaning item let go anywhere in the room is a bath (M15); one that cannot start now says why and does nothing
      if (entry.action === 'clean') {
        offerBath(entry);
        return;
      }
      applyEntry(entry, plan, roomId);
    },
  });
  const startDrag = drag.start;
  const onDragStart = useCallback((e: ReactPointerEvent, entry: RoomCareEntry) => {
    // Only into a 3D room, which can tell the Blobbi from the floor; without it, Use is the way
    if (controlRef.current && present && !transitioning) startDrag(e, entry.key);
  }, [controlRef, startDrag, present, transitioning]);
  const onUse = useCallback((entry: RoomCareEntry) => {
    selectItem(entry.key);
    // A cleaning item is a bath (M15): the tub, the soap, the shower, the towel, then the one write; a bath that cannot
    // start now (squeaky clean already, the Blobbi away) says why and does nothing else
    if (entry.action === 'clean') {
      offerBath(entry);
      return;
    }
    applyEntry(entry, planUse(entry.action, controlRef.current?.blobbiPosition() ?? null), roomId);
  }, [selectItem, applyEntry, controlRef, roomId, offerBath]);

  // A drag ends without a drop when the room changes, decorating begins, or the item is gone or no longer usable
  const cancelDrag = drag.cancel;
  useEffect(() => cancelDrag(), [roomId, decorator.editing, cancelDrag]);
  const dragged = drag.session ? entries.find((e) => e.key === drag.session!.key) ?? null : null;
  const draggedGone = drag.session !== null && (!dragged || !dragged.usable || care.busy || (dragged.choice.source === 'owned' && care.inventory.status !== 'ready'));
  useEffect(() => {
    if (draggedGone) cancelDrag();
  }, [draggedGone, cancelDrag]);
  // Picked up: "hup"
  const lifted = drag.session?.lifted ?? false;
  useEffect(() => {
    if (lifted) play('pickup');
  }, [lifted, play]);

  // ─── Its own life, when nothing else is going on (useRoomLife) ───
  const lifeEnabled = !isEgg && !isSleeping && !decorator.editing && !care.busy && interactions.activity === null && drag.session === null && present && journeyPreview === null && !transitioning;
  const life = useRoomLife({
    enabled: lifeEnabled,
    canWalk: nav.canWalk && !reducedMotion,
    position: () => controlRef.current?.blobbiPosition() ?? null,
    walkTo: nav.walkTo,
    gesture,
  });
  const markActivity = life.markActivity;
  // Its eyes: the pointer's when it has one, else what it is attending to, else where its own thoughts wander;
  // a glance the way it goes while walking (the 2D drawing; the 3D model turns its whole body)
  const eyeOffset = pickGaze({ scripted: transitions.gaze ?? eatingView.gaze ?? (bathing ? bathGaze : null) ?? interactions.gaze, pointer: gaze.eyeOffset, attention, glance: life.glance, walking: motion === 'walking' ? { facing } : null });
  // The 3D model turns its whole body as it walks, so its eyes rest then
  const gaze3d = isEgg || isSleeping || motion === 'walking' ? null : eyeOffset ?? null;
  useEffect(() => {
    controlRef.current?.gaze(gaze3d);
    // The offset's numbers are what matter, not its identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlRef, gaze3d?.x, gaze3d?.y, actor3d.model]);

  // A tap on the Blobbi: the home's poke personality (glad, then grumpy if overdone; sleepy when tired)
  const pokes = useRef<number[]>([]);
  const stats = projected?.stats;
  const react = reactions.react;
  const onBlobbiTap = useCallback((id: string) => {
    if (id !== MAIN_BLOBBI || !present) return;
    markActivity();
    // An egg ready to hatch: a tap opens the theatre, where the taps crack the shell (nothing is written before the last)
    if (hatchReady) {
      play('poke');
      gesture('stir');
      inviteHatch();
      return;
    }
    const now = Date.now();
    pokes.current = [...pokes.current.filter((t) => now - t < POKE_PATIENCE.windowMs), now];
    const reaction = pokeReaction({ stage: blobbi.stage, state: blobbi.state, stats, recentPokes: pokes.current.length });
    if (reaction.mood === 'annoyed') pokes.current = [];
    if (reaction.expression) react(reaction.expression, reaction.durationMs);
    gesture(reaction.gesture);
    const sound = soundForPoke(reaction.mood);
    if (sound) play(sound);
  }, [markActivity, blobbi.stage, blobbi.state, stats, react, gesture, play, present, hatchReady, inviteHatch]);

  // Petting: a stroke across the Blobbi is a moment of contentment (nothing written, no stat changed)
  const petting = usePetting({
    enabled: present && !isEgg && !isSleeping && !care.busy && !transitioning && !decorator.editing && journeyPreview === null,
    reducedMotion,
    showFace,
    clearFace,
    gesture,
    play,
    markActivity,
    // A hand on it stops a walk: a scene on its way to something ends there, the item goes back
    stop: nav.stop,
  });
  const { notePetted } = journeyBook;
  useEffect(() => {
    if (petting.petting) notePetted();
  }, [petting.petting, notePetted]);

  // ─── Travel: the Blobbi says goodbye and dissolves (the teleport's own departure), then the page goes ───
  const departure = useWorldDeparture({ presence, canAct: present && !isEgg && !isSleeping, reducedMotion, showFace, clearFace, gesture, play });
  const travelBusy = care.busy || theater || lifecycle.pending !== null || decorator.editing || transitioning || bathing;
  const travel = useCallback(
    (world: Parameters<typeof departure.go>[0]) => {
      // A write still out finishes here first: leaving mid-signature could lose it
      if (travelBusy) {
        play('invalid');
        care.notify('One moment: something is still being saved.');
        return;
      }
      if (departure.go(world)) setWorldsOpen(false);
    },
    [travelBusy, departure, play, care],
  );
  const onJourneyAction = useCallback((action: ObjectiveAction) => {
    setJourneyOpen(false);
    if (action.kind === 'room') setChosenRoom(action.room);
    else if (action.kind === 'details') openSheet();
    else if (action.kind === 'adopt') setAdoptOpen(true);
  }, [openSheet]);

  // Where it comes to rest is remembered for this room (not mid-walk, mid-scene, away, asleep or decorating)
  const rememberPosition = memory.rememberPosition;
  useEffect(() => {
    if (motion !== 'idle' || transitioning || !present || isSleeping || decorator.editing) return;
    const remember = (now: boolean) => {
      const at = controlRef.current?.blobbiPosition();
      if (at) rememberPosition(roomId, at, now);
    };
    const timer = setTimeout(() => remember(false), 500);
    // A reload, a closed tab or a phone put away never unmounts the page: written as it goes
    const onHide = () => {
      if (document.visibilityState === 'hidden') remember(true);
    };
    const onPageHide = () => remember(true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [motion, transitioning, present, isSleeping, decorator.editing, roomId, rememberPosition, controlRef]);

  // Furniture: the bed rests or wakes; the fridge, the tub and the toy box open their items
  const bed = useMemo(() => {
    const p = placements.find((f) => f.at === 'floor' && resolveFurniture(f.id)?.interaction === 'bed');
    return p ? { x: p.x, z: p.y } : null;
  }, [placements]);
  const rest = care.rest;
  // Any piece tapped: a wooden knock, and the Blobbi looks over at it
  const onPieceTap = useCallback((index: number, lamp: boolean) => {
    markActivity();
    play(lamp ? 'select' : 'knock');
    const p = placements[index];
    const at = controlRef.current?.blobbiPosition();
    if (p && at && p.at === 'floor') {
      // Across the screen is x - z from the camera's corner; nearer the camera is lower
      const across = (p.x - p.y) - (at.x - at.z);
      setAttention({ x: Math.max(-0.8, Math.min(0.8, across * 0.25)), y: p.x + p.y > at.x + at.z ? 0.4 : -0.1 });
    }
  }, [markActivity, play, placements, controlRef]);
  // The fridge opens its door over the room (M14.1, `FridgeSheet`): the same entries a shelf would show, the same use
  const [fridgeOpen, setFridgeOpen] = useState(false);
  const fridgeEntries = useMemo(() => shelfEntries({ kind: 'furniture', label: FURNITURE_SHELVES.fridge.label, activities: FURNITURE_SHELVES.fridge.activities }, care.inventory), [care.inventory]);
  useEffect(() => setFridgeOpen(false), [roomId]);
  const onInteract = useCallback((interaction: FurnitureInteraction, index: number) => {
    if (interaction === 'bed') {
      const p = placements[index];
      rest(p ? { x: p.x, z: p.y } : null);
      return;
    }
    if (interaction === 'fridge') {
      markActivity();
      setFridgeOpen(true);
      return;
    }
    const opened = FURNITURE_SHELVES[interaction];
    const own = roomById(roomId).activities;
    const same = opened.activities.length === own.length && opened.activities.every((a) => own.includes(a));
    setFurnitureShelf(same ? null : { kind: 'furniture', label: opened.label, activities: opened.activities });
    setPulse(true);
  }, [placements, rest, roomId, markActivity]);

  // A change of room ends a bath first (the Blobbi is put back on the floor before the room's own scene begins)
  const changeRoom = useCallback((next: RoomId) => {
    cancelBath('room');
    setChosenRoom(next);
  }, [cancelBath]);
  const offer = care.offer;
  const offerGlyph = offer?.choice.entry.item.glyph ?? null;
  const offerPhysical = offer ? propKindFor(offer.choice.entry.item) !== null : false;
  const floorThings = useMemo(
    () => (offer && offer.place.roomId === roomId && offerGlyph && !bathing
      ? [{ key: `offer-${offer.key}`, x: offer.place.x, z: offer.place.z, node: <RoomFloorItem offer={offer} glyph={offerGlyph} onPutAway={care.putAway} physical={offerPhysical} /> }]
      : []),
    [offer, offerGlyph, offerPhysical, roomId, care.putAway, bathing],
  );
  // Its name, shown over its head on demand (hover, tap, keyboard focus), in 2D and 3D alike
  const nameTag = useMemo(() => ({ text: blobbi.name, color: toBlobbiVisual(blobbi).baseColor }), [blobbi]);
  // The carousel's focus moving: the smallest tick
  const focusItem = useCallback((key: string) => {
    selectItem(key);
    play('select');
  }, [selectItem, play]);
  // A use that failed: a short "nuh" as the reason appears
  const failed = offer?.phase === 'failed';
  useEffect(() => {
    if (failed) play('invalid');
  }, [failed, play]);
  // Decorating: a piece set down pops, a new piece too, and Save chimes
  const placeMove = useCallback((index: number, placement: FurniturePlacement) => {
    play('place');
    move(index, placement);
  }, [move, play]);
  const draftCount = draft?.length ?? null;
  const lastDraftCount = useRef(draftCount);
  useEffect(() => {
    if (draftCount !== null && lastDraftCount.current !== null && draftCount > lastDraftCount.current) play('place');
    lastDraftCount.current = draftCount;
  }, [draftCount, play]);
  const saveWithChime = useCallback(() => {
    play('save');
    save();
  }, [save, play]);
  const editor = useMemo((): RoomEditorBinding | undefined => {
    if (!decorator.editing || !draft || !layoutDraft) return undefined;
    return {
      selectedIndex,
      onSelect: select,
      onMove: placeMove,
      onInvalidChange: setInvalid,
      toolbar: selectedIndex !== null ? <RoomDecoratorToolbar draft={draft} onDraftChange={setDraft} selectedIndex={selectedIndex} onSelect={select} /> : undefined,
      overlay: (
        <RoomDecoratorOverlay
          roomId={roomId}
          draft={draft}
          onDraftChange={setDraft}
          layout={layoutDraft}
          onLayoutChange={setLayoutDraft}
          selectedIndex={selectedIndex}
          onSelect={select}
          invalid={invalid}
          controlRef={controlRef}
          onSave={saveWithChime}
          onCancel={cancel}
        />
      ),
    };
  }, [decorator.editing, draft, layoutDraft, selectedIndex, select, placeMove, setInvalid, setDraft, setLayoutDraft, invalid, controlRef, saveWithChime, cancel, roomId]);

  // A guest's room (M15): the same invitation to save as the 2D home's, by the shared rules, in a quiet moment of the
  // room (nothing in use or walking, no ceremony, nothing of the room's open, the Blobbi here and awake)
  const roomQuiet =
    present && !care.busy && care.offer === null && interactions.activity === null && !transitioning && !theater && !isSleeping && !decorator.editing && lifecycle.pending === null && !sheetOpen && !menuOpen && !itemsOpen && !introOpen && !fridgeOpen && !statusOpen && !worldsOpen && !journeyOpen && !adoptOpen && departure.phase === 'idle';
  const saveInvite = useSaveInvite({ hatched: blobbi.stage !== 'egg', quiet: roomQuiet });

  return (
    // Any touch of the player's holds the Blobbi's own life off for a while
    <div ref={shellRef} className="relative flex flex-1 min-h-0 flex-col" onPointerDownCapture={markActivity} onKeyDownCapture={markActivity}>
      <RoomShell
        roomId={roomId}
        onChangeRoom={changeRoom}
        headerRoomId={decorator.room ?? resolvedRoom}
        roomEntry={transitions.roomEntry}
        isSleeping={isSleeping}
        blobbiStage={blobbi.stage}
        blobbiWalkSpeed={walkSpeed}
        // Away somewhere else, or on the hatch theatre's stage: not in the room at all (no drawing, no shadow, nothing to tap)
        blobbiVisible={!absent && !theater}
        roomLayout={layout}
        furniturePlacements={placements}
        pointerHandlers={pointerHandlers}
        {...nav.shellProps}
        // Its life is the app's (useRoomLife): it ambles only when nothing else is going on
        blobbiWanders={false}
        onInteract={onInteract}
        onPieceTap={onPieceTap}
        onBlobbiTap={onBlobbiTap}
        floorThings={floorThings}
        props={interactions.props}
        onPropTap={interactions.onPropTap}
        onRoomBuilt={onRoomBuilt}
        onStatusChange={onSceneStatus}
        blobbiOverlay={
          <RoomBlobbiOverlay ref={gazeBoxRef} feedback={care.feedback} handed={null} heart={petting.heart}>
            {/* The bath on its body (M15): the surface the player rubs; the foam and the tools too, unless the 3D model draws them */}
            {bathView && (
              <BathTouchLayer view={bathView} input={bath.input} draw={!modelDrawn} reducedMotion={reducedMotion} name={blobbi.name} style={{ top: `${bathInset}%`, bottom: `${-bathInset}%` }} />
            )}
          </RoomBlobbiOverlay>
        }
        inputLocked={bathing}
        onBlobbiPet={petting.onPet}
        blobbiName={nameTag}
        header={
          <RoomHeader
            name={blobbi.name}
            stage={blobbi.stage}
            onOpenMenu={() => setMenuOpen(true)}
            // The guest's status by the name (M14.1); "Saved to Nostr" once a save landed on this visit
            leading={guestActive ? <GuestStatusPill onOpen={() => setStatusOpen(true)} /> : guestUi.saved ? <SavedPill /> : null}
            // A guest's world is on this device: the relays' health is not its business (M14)
            connection={guestActive ? undefined : connection}
            streak={streak}
          />
        }
        statusHud={!isEgg && <RoomStatusHud stage={blobbi.stage} stats={projected?.stats} onGuide={isSleeping ? undefined : setChosenRoom} />}
        middleSlot={
          <>
            {hatchReady && !theater && (
              <button type="button" className="hatch-invite" onClick={inviteHatch} data-testid="room-hatch-invite">
                <Sparkles className="h-4 w-4" aria-hidden /> Your egg is ready: tap it to hatch
              </button>
            )}
            <RoomCareCards offer={bathing ? null : offer} onRetry={interactions.retry} onPutAway={care.putAway} error={care.error} notice={care.notice ?? storeNotice} />
          </>
        }
        blobbiModel={actor3d.model}
        // The one switch between the two homes (M14.1), upper right under the header; the room's settings are the menu's
        hudEnd={<ModeToggle mode={modeSwitch.mode} onChoose={modeSwitch.choose} />}
        quality={quality.settings}
        // The camera speaks the scene's units; the player's 100% is the former 80% view (`room-zoom.ts`)
        zoom={zoom.scene}
        onZoom={zoom.setScene}
        notice={actor3d.failed ? actor3d.unavailable3d : null}
        onSlow={quality.onSlow}
        onGpu={quality.onGpu}
        editor={editor}
        stage={
          <RoomBlobbi
            ref={actorRef}
            blobbi={blobbi}
            facing={facing}
            motion={motion}
            eyeOffset={concentrating ? undefined : eyeOffset}
            expression={expression.face}
            gesture={gestureNow}
            journey={journey}
            absent={absent}
            journeyPreview={journeyPreview}
            moteDensity={quality.settings.moteDensity}
            accessories={accessories}
            effects={worn.effects}
          />
        }
      >
        <RoomBottomBar
          blobbi={blobbi}
          roomId={roomId}
          bath={bathView ? <BathToolBar view={bathView} onStop={() => cancelBath('stopped')} onRetry={bath.retry} reducedMotion={reducedMotion} variant="room" /> : null}
          carousel={hasStrip ? {
            entries,
            focusedKey: selectedKey,
            onFocus: focusItem,
            onUse,
            onBlocked: (entry) => {
              play('invalid');
              care.notify(entry.reason ?? 'Not right now.');
            },
            onDragStart,
            onClose: furnitureShelf ? () => setFurnitureShelf(null) : undefined,
            highlight: pulse,
          } : null}
          offer={offer}
          busy={care.busy || !present || transitioning}
          onRest={() => rest(bed)}
          restPending={care.restPending}
          // The dock's two controls (M14.1): the Blobbi on the left, the room on the right
          controls={{
            onOpenBlobbi: openSheet,
            onDecorate: decorator.open,
            guide: lookGuide === 'dock' && !theater && !sheetOpen ? { reducedMotion } : null,
            decorateDisabled: !sceneIs3d || care.busy || interactions.activity !== null || !present || transitioning,
            decorateUnavailable: sceneIs3d ? null : 'Decorating needs 3D graphics, which this browser has turned off',
          }}
        />
      </RoomShell>
      <FridgeSheet open={fridgeOpen} onClose={() => setFridgeOpen(false)} entries={fridgeEntries} onUse={onUse} busy={care.busy || !present || transitioning} blobbiName={blobbi.name} />
      {/* The first visit to the room on this device (M14.2): a word about it, over the room itself, once; the two looks of
          this Blobbi side by side (M14.3), and the one-time guide to where they are chosen follows its closing */}
      <RoomIntro
        open={introOpen && !theater}
        blobbi={blobbi}
        appearance={appearance}
        unavailable3d={actor3d.unavailable3d}
        reducedMotion={reducedMotion}
        onExplore={(dontShowAgain, look) => {
          if (dontShowAgain) writeRoomIntroSeen();
          // The card the player selected is the look from now on (this device's preference, as in the sheet)
          if (look && look !== appearance) setAppearance(look);
          setIntroOpen(false);
          const next = guideAfterIntro(readLookGuideShown());
          if (next) {
            writeLookGuideShown();
            setLookGuide(next);
          }
        }}
      />
      <RoomDragGhost ref={drag.ghostRef} glyph={drag.session?.lifted && dragged ? dragged.glyph : null} />
      {streakMoment?.milestone && <StreakMoment change={streakMoment} onDone={dismissStreakMoment} reducedMotion={reducedMotion} />}
      {saveInvite.open && guestActive && (
        <div className="guest-invite-room">
          <GuestInvite name={blobbi.name} onSave={saveInvite.save} onLater={saveInvite.later} onNever={saveInvite.never} reducedMotion={reducedMotion} />
        </div>
      )}
      {theater && (
        <HatchTheater
          blobbi={blobbi}
          perform={performHatch}
          error={hatchError ?? lifecycleError}
          reducedMotion={reducedMotion}
          play={play}
          onDone={endTheater}
          onRecover={refresh}
          savingNote={guestActive ? 'Keeping the hatch on this device' : undefined}
        />
      )}
      <GuestStatusSheet open={statusOpen && guestActive} onClose={() => setStatusOpen(false)} name={blobbi.name} onSave={guestUi.requestSave} storageOk={guest.storageOk} />
      <MenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        inRoom
        onOpenWorlds={() => setWorldsOpen(true)}
        roomSettings={
          <RoomSettings
            quality={{ preference: quality.preference, level: quality.level, onChange: quality.setPreference }}
            zoom={{ value: zoom.value, onIn: () => zoom.by(ZOOM_STEP), onOut: () => zoom.by(1 / ZOOM_STEP), onReset: zoom.reset }}
          />
        }
      />
      <WorldsSheet
        open={worldsOpen}
        onClose={() => setWorldsOpen(false)}
        blobbi={blobbi}
        onTravel={travel}
        guest={guestActive}
        onSave={() => {
          setWorldsOpen(false);
          guestUi.requestSave();
        }}
      />
      <JourneySheet
        open={journeyOpen}
        onClose={() => setJourneyOpen(false)}
        chapters={journeyBook.chapters}
        onAction={onJourneyAction}
        progress={{ xp: profile?.xp, level: journeyBook.level }}
        daily={daily}
        canAdoptMore={journeyBook.canAdoptMore}
      />
      {pubkey && !guestActive && (
        <GameOverlay open={adoptOpen} onClose={() => setAdoptOpen(false)} title="Another Blobbi" testId="room-adopt-sheet">
          {journeyBook.canAdoptMore ? (
            <AdoptionFlow pubkey={pubkey} updateCompanionEvent={updateCompanionEvent} refresh={refresh} additional />
          ) : (
            <p className="text-center text-sm text-muted-foreground" data-testid="room-adopt-locked">
              Your Blobbonaut level allows {journeyBook.maxBlobbis} Blobbi{journeyBook.maxBlobbis === 1 ? '' : 's'} for now. A second egg can join at level 5.
            </p>
          )}
        </GameOverlay>
      )}
      {departure.phase !== 'idle' && departure.world && <DepartureCard phase={departure.phase} world={departure.world} name={blobbi.name} onStay={departure.cancel} onRetry={() => departure.go({ ...departure.world!, open: true })} />}
      {journeyBook.celebrate && <ChapterToast chapter={journeyBook.chapters.find((c) => c.id === journeyBook.celebrate)!} onDone={journeyBook.dismissCelebration} play={play} reducedMotion={reducedMotion} />}
      <RoomBlobbiSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          endLookGuide();
        }}
        highlightAppearance={lookGuide === 'sheet'}
        onAppearanceSeen={endLookGuide}
        reducedMotion={reducedMotion}
        blobbi={blobbi}
        mood={mood}
        statItems={statItems}
        profile={profile}
        companions={companions}
        onSelect={(d) => {
          setSheetOpen(false);
          onSelect(d);
        }}
        lifecycle={lifecycle}
        ceremony={ceremonyView}
        onCeremony={(kind) => void startCeremony(kind)}
        firstBlobbi={firstBlobbi.qualifies}
        onOpenItems={() => {
          setSheetOpen(false);
          setItemsOpen(true);
        }}
        usableItemCount={usableItemCount}
        appearance={{ value: appearance, onChange: setAppearance, unavailable3d: actor3d.unavailable3d }}
        onOpenJourney={() => {
          setSheetOpen(false);
          setJourneyOpen(true);
        }}
        guest={guestActive}
      />
      <InventorySheet
        open={itemsOpen}
        onClose={() => setItemsOpen(false)}
        inventory={care.inventory}
        blobbiName={blobbi.name}
        onUse={(entry) => {
          setItemsOpen(false);
          const careEntry = ownedEntry(entry);
          // A cleaning item from the bag is a bath too (M15); in a room without a tub, where the Blobbi stands
          if (careEntry.action === 'clean') {
            offerBath(careEntry);
            return;
          }
          interactions.offer(careEntry, planUse(careEntry.action, controlRef.current?.blobbiPosition() ?? null), roomId);
        }}
        busy={care.busy || interactions.activity !== null || !present || transitioning}
        worn={worn.wornAddresses}
      />
      {DEV_TELEPORT && (
        <RoomDevTools
          transitions={transitions}
          roomId={roomId}
          onRoom={setChosenRoom}
          appearance={appearance}
          onAppearance={setAppearance}
          unavailable3d={actor3d.unavailable3d}
          quality={{ preference: quality.preference, level: quality.level, reason: quality.reason, onChange: quality.setPreference }}
          onFace={(name) => (name ? showFace('playground', name, { priority: PRIORITY.journey + 1 }) : clearFace('playground'))}
          onFeed={() => {
            const food = care.inventory.starters.find((s) => s.item.care?.action === 'feed');
            if (!food || care.busy) return;
            interactions.preview('feed', food.item);
          }}
          onBall={() => {
            const ball = care.inventory.starters.find((s) => propKindFor(s.item) === 'ball');
            if (!ball || care.busy) return;
            interactions.preview('ball', ball.item);
          }}
          onPet={() => {
            petting.onPet('start');
            [400, 800, 1200, 1600].forEach((t) => setTimeout(() => petting.onPet('stroke'), t));
            setTimeout(() => petting.onPet('end'), 1900);
          }}
          presence={presence}
          preview={journeyPreview}
          onPreview={setJourneyPreview}
          controlRef={controlRef}
          mode={actor3d.model ? '3D Blobbi' : '2D Blobbi'}
          perfOnOpen={perfRequested}
        />
      )}
    </div>
  );
}

/** How long a word about the stored rooms stays. */
const STORE_NOTICE_MS = 6_000;

/** One honest line when the stored rooms could not be read whole, or a save could not be kept. */
function useStoreNotice(persistence: { load: LoadStatus | null; save: SaveStatus | null }): string | null {
  const [notice, setNotice] = useState<string | null>(() => loadNotice(persistence.load));
  const save = persistence.save;
  useEffect(() => {
    if (save === 'full') setNotice('This browser is out of room, so your decorating is kept for this visit only.');
    else if (save === 'unavailable') setNotice('This browser would not keep your decorating, so it lasts for this visit only.');
    else if (save === 'newer') setNotice('A newer version of Blobbi saved these rooms here; they were left as they are.');
    else if (save === 'saved') setNotice(null);
  }, [save]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), STORE_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);
  return notice;
}

function loadNotice(load: LoadStatus | null): string | null {
  if (load === 'repaired') return 'Some saved furniture is no longer available and was left out.';
  if (load === 'corrupt') return 'Your saved rooms could not be read, so they show their defaults.';
  if (load === 'newer') return 'These rooms were saved by a newer version of Blobbi, so they show their defaults here.';
  return null;
}
