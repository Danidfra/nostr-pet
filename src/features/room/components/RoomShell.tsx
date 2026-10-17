/**
 * RoomShell — the 3D room screen.
 *
 * Layers, back to front: the 3D diorama canvas, DOM things standing in the
 * room (the Blobbi, guests, things on the floor) moved each frame to where
 * the scene projects them, a second canvas with furniture standing in front
 * of the Blobbi, then the chrome: an optional header, the room switcher HUD,
 * and the dock the caller hands in.
 *
 * The scene frames the room in the space between whatever is marked
 * `data-room-top` and `data-room-bottom` (HUD and dock, or a decorator's
 * bars while decorating). Without WebGL there is no room: the Blobbi stands
 * alone, a little larger, in the middle.
 *
 * Owns room navigation (switcher arrows + swipe), taps in the room (walk
 * there, or use the piece of furniture tapped), and, while decorating,
 * picking and dragging furniture.
 *
 * Ditto's `BlobbiRoomShell`, with its i18n, haptics, poop layer and
 * stat-guide pulses left out, over this app's room registry.
 */

import { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef, type CSSProperties, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Cross, Home, Moon, Refrigerator, Shirt, type LucideIcon } from 'lucide-react';
import type { BlobbiFacing } from '@blobbi-kit/renderer';
import type { WalkOutcome } from '@/features/home/scene/useBlobbiLocomotion';

import { ROOM_ORDER, neighbourRoom, roomById, type RoomId } from '@/features/home/rooms/rooms';
import { cx } from '../lib/cx';
import { ArcBackground } from './ArcBackground';
import { resolveFurniture, type FurnitureInteraction } from '../lib/furniture-3d';
import type { FurniturePlacement } from '../lib/room-furniture';
import type { ActorFrame, ActorGesture, ActorModel } from '../lib/blobbi3d/actor';
import type { ProceduralFace } from '@/features/expression/faces';
import type { ActorScript, RoomIntro } from '../lib/scene/RoomScene';
import type { QualitySettings } from '../lib/room-quality';
import type { JourneyKind } from '@/features/teleport/timeline';
import type { RoomLayout } from '../lib/room-layout';
import { ROOM_GRID, blobbiBoxTiles, blobbiReachTiles, MAIN_BLOBBI } from '../lib/room-geometry';
import { useFurnitureModels } from '../hooks/useFurnitureModels';
import { useRoomScene, type RoomSceneFailure, type RoomSceneStatus } from '../hooks/useRoomScene';
import type { PickResult, RoomScene, SceneGeometry, ScreenAnchor, SpotQuery } from '../lib/scene/RoomScene';
import type { BathAnchor, BathFrame } from '@/features/bath/bath-frame';
import type { RoomProp } from '../lib/room-props';
import { RoomFlatProp } from './RoomProps';

// ─── Types ────────────────────────────────────────────────────────────────────

/** What the Blobbi's presentation in the room is: which way it faces, whether it walks. */
export interface RoomActorState {
  facing: BlobbiFacing;
  motion: 'idle' | 'walking';
}

/** What the app can ask of the room while it is 3D (see `useRoomNavigation`). */
export interface RoomControl {
  /** A free spot for a new item, or null if the room is full. */
  findSpot: (query: SpotQuery) => Pick<FurniturePlacement, 'at' | 'x' | 'y'> | null;
  /** The floor point (tiles) under a screen point, or null off the floor. */
  floorAt: (clientX: number, clientY: number) => { x: number; z: number } | null;
  /** Walk the user's Blobbi to the free tile nearest a floor point; resolves how the walk ended. */
  walkTo: (x: number, z: number) => Promise<WalkOutcome>;
  /**
   * Walk the user's Blobbi up to something on the floor and stand by it; with `clear` (the thing's own size, tiles)
   * it stands its body's reach and that clear of it, the thing in front of it, never under it.
   */
  approach: (x: number, z: number, clear?: number) => Promise<WalkOutcome>;
  /** Stop the user's Blobbi where it stands; a walk in progress resolves `stopped`. */
  stop: () => void;
  /** What is under a screen point (a Blobbi, a piece, the floor), as a tap would find it. */
  pickAt: (clientX: number, clientY: number) => PickResult;
  /** Where the user's Blobbi stands (tiles). */
  blobbiPosition: () => { x: number; z: number } | null;
  /** A little hop of the user's Blobbi (a reaction), drawn either way it is drawn. */
  hop: () => void;
  /** One of the home's body gestures on the 3D model (the 2D drawing plays it itself). */
  gesture: (kind: ActorGesture) => void;
  /** Where the 3D model's eyes look (the 2D drawing takes the same offset as a prop). */
  gaze: (offset: { x: number; y: number } | null) => void;
  /** The face the 3D model wears (the kit's procedural face; the 2D drawing takes the expression as a prop). */
  face: (face: ProceduralFace | null) => void;
  /** A choreographed pose of the 3D body (the 2D drawing poses itself), or null. */
  pose: (pose: ActorFrame['pose']) => void;
  /** The GPU's name where the browser gives it (the performance report). */
  gpu?: () => string | undefined;
  /** Development measurements of the room's drawing (`RoomScene.stats`), or null without a scene. */
  stats: () => ReturnType<RoomScene['stats']> | null;
  /** Hold the room's fold-in at a moment (a scrubber), or let it run (null). */
  holdIntro: (ms: number | null) => void;
  /** Draw a frame now, not on the next animation frame (a held moment, in a tab that may be hidden). */
  render: () => void;
  /** Whether this room can stage a scene with the Blobbi (a real scene, not a stand-in). */
  canChoreograph: () => boolean;
  /** Choreograph the user's Blobbi (a room transition), or let it go (back on the floor, inside the room). */
  script: (script: ActorScript | null) => void;
  /** The back wall the Blobbi is behind (the 2D drawing is hidden inside its outline), or none. */
  wallsCover: (wall: 'left' | 'right' | null) => void;
  /** Whether the floor tile under a point is free of furniture, in the room on screen. */
  tileFree: (x: number, z: number) => boolean;
  /** How high (tiles above the floor) a point over (x, z) can go before it leaves the top of the view. */
  skyAt: (x: number, z: number) => number;
  /** Where the user's Blobbi would stand for a floor point: the free spot nearest it, in the room on screen. */
  standPointNear: (x: number, z: number) => { x: number; z: number };
  /** The journey under way (teleporting), for the scene to draw on the model and the shadow. */
  journey: (journey: { kind: JourneyKind; startedAt: number; reduced: boolean } | null) => void;
  /** Show a fixed moment of a journey and draw it at once (the development scrubber). */
  journeyPreview: (preview: { kind: JourneyKind; t: number; reduced: boolean } | null) => void;
  /** Kick a ball prop off in a direction (tiles) at a speed (tiles/s); false when there is no such ball. */
  kickProp: (id: string, dir: { x: number; z: number }, power: number) => boolean;
  /** Where a prop is now (a ball where it has rolled to), or null. */
  propPosition: (id: string) => { x: number; z: number } | null;
  /** Whether a prop is still (a ball at rest). */
  propResting: (id: string) => boolean;
  /** Resolves when a rolling prop comes to rest (at once when it is still, or gone). */
  whenPropRests: (id: string) => Promise<void>;
  /** The care ritual under way (M15), drawn by the scene from its frame on the main actor (in the tub `anchor` names, or in place), or none. */
  bath: (frame: BathFrame | null, anchor?: Extract<BathAnchor, { kind: 'world' }> | null) => void;
  /** A floor piece's footprint (tiles) as laid out now, or null. */
  itemFootprint: (index: number) => { x0: number; x1: number; z0: number; z1: number } | null;
  /** Whether the 3D model stands in the user's Blobbi's place on screen (the page's drawing has stepped aside). */
  modelDrawn: () => boolean;
}

/** What the simple room says about why it is simple. */
const FAILURE_TEXT: Record<Exclude<RoomSceneFailure, null>, string> = {
  unsupported: 'This browser has 3D graphics turned off, so the room is shown simply. Everything else works.',
  lost: '3D graphics stopped working on this device, so the room is shown simply for now. Everything else works.',
  slow: 'The 3D room took too long to start, so it is shown simply for this visit. Everything else works.',
};

/** How far a press must rub across the Blobbi before it is a stroke (px), and how far each further stroke is. */
const PET_START_PX = 28;
const PET_STROKE_PX = 70;

/** A clip that keeps everything but the walls' outlines (holes, even-odd), in the drawing's own coordinates (its feet at 0,0). */
function wallsClip(walls: { x: number; y: number }[][], at: { x: number; y: number }): string {
  const hole = (q: { x: number; y: number }[]) => `M ${q.map((p) => `${(p.x - at.x).toFixed(1)} ${(p.y - at.y).toFixed(1)}`).join(' L ')} Z`;
  return `path(evenodd, "M -9999 -9999 H 9999 V 9999 H -9999 Z ${walls.map(hole).join(' ')}")`;
}

/** Pointer events over the room, for a gaze policy (the home's `ScenePointerHandlers`). */
export interface RoomPointerHandlers {
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}

/** A visiting Blobbi standing in the room. */
export interface RoomGuest {
  id: string;
  /** Egg, baby or adult: sets its size in the room. */
  stage: string;
  /** Where it first appears, in tiles; beside the user's Blobbi when unset. */
  spawn?: { x: number; z: number };
  /** Its visual (a RoomBlobbi-like element). */
  node: ReactNode;
}

/** Something set down on the floor (a dropped item). */
export interface RoomFloorThing {
  key: string;
  x: number;
  z: number;
  node: ReactNode;
}

export interface RoomEditorBinding {
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  /** An item was dropped on a free spot. */
  onMove: (index: number, placement: FurniturePlacement) => void;
  onInvalidChange: (invalid: Set<number>) => void;
  /** Floating toolbar, anchored above the selected item. */
  toolbar?: ReactNode;
  /** Decorating bars (mark them data-room-top / data-room-bottom). Replace the HUD and dock. */
  overlay: ReactNode;
}

export interface RoomShellProps {
  /** The room on screen. */
  roomId: RoomId;
  /** The room the header names and steps from: the one asked for, before a transition has brought it on screen. */
  headerRoomId?: RoomId;
  /** One line the page wants said where the room's own fallback note goes (the 3D Blobbi fell back to 2D). */
  notice?: string | null;
  /** The rendering quality to draw the 3D room at, and the scene's reports for choosing it (`useRoomQuality`). */
  quality?: QualitySettings;
  /**
   * How close the room is looked at: a factor over the responsive framing (`useRoomZoom`), 1 by default. The
   * shell holds the scene to it, and reports a pinch (two fingers on the room) or a wheel over it through `onZoom`.
   */
  zoom?: number;
  onZoom?: (zoom: number) => void;
  onSlow?: () => void;
  onGpu?: (gpu: string | undefined) => void;
  /** How the next room shown arrives and where the Blobbi stands in it (`useRoomScene`'s `roomEntry`); unset, the full fold-in, the Blobbi hopping in. */
  roomEntry?: { intro: RoomIntro; spawn: { x: number; z: number } | null };
  onChangeRoom: (roomId: RoomId) => void;
  isSleeping: boolean;
  /** Egg, baby or adult: sets its size in the room. */
  blobbiStage: string;
  /** Its walking pace in tiles per second (`walkSpeedFor`); Ditto's one speed when unset. */
  blobbiWalkSpeed?: number;
  /** False while the Blobbi is away. */
  blobbiVisible: boolean;
  /** The Blobbi (RoomBlobbi), positioned in the room each frame. */
  stage?: ReactNode;
  /**
   * A 3D model standing in the Blobbi's place instead of `stage`: the scene
   * walks, turns and animates it (`blobbi3d/actor.ts`). Keep it stable
   * between renders; the caller owns and disposes it.
   */
  blobbiModel?: ActorModel | null;
  /**
   * What follows the user's Blobbi round the room whichever way it is drawn
   * (care feedback): placed at its feet each frame, with `--anchor-px` and
   * `--blobbi-tiles` set so it can rise to its head.
   */
  blobbiOverlay?: ReactNode;
  /**
   * Drawn where the user's Blobbi stands while it is not shown (world travel's "looking for it" and "calling it"
   * cues): placed at its feet each frame like the overlay, in a box its size.
   */
  blobbiCue?: ReactNode;
  /** The HUD's right-hand slot (opposite the decorate button). */
  hudEnd?: ReactNode;
  /**
   * The user's Blobbi's name, and its colour for the tag's dot: shown over its
   * head only on demand (a hover, a tap, keyboard focus), drawn either way,
   * and the accessible name of its keyboard stand-in.
   */
  blobbiName?: { text: string; color?: string };
  /** Whether the scene ambles the user's Blobbi about by itself (default yes); off when the app drives its life. */
  blobbiWanders?: boolean;
  /** Something over the room (an "away" card). */
  hero?: ReactNode;
  /** A bar above the room. */
  header?: ReactNode;
  /** Accepted for callers that still pass them; the dock draws the decorate button since M14.1 (`RoomBottomBar`). */
  onDecorate?: () => void;
  decorateDisabled?: boolean;
  /** Under the room switcher. */
  statusHud?: ReactNode;
  /** Hide the HUD (while a drawer is open). */
  hudVisible?: boolean;
  /** The dock. */
  children: ReactNode;
  /** Inline activity above the dock. */
  middleSlot?: ReactNode;
  roomLayout?: RoomLayout;
  furniturePlacements?: readonly FurniturePlacement[];
  /** Room-level overlay. */
  roomOverlay?: ReactNode;
  guests?: RoomGuest[];
  /** A visiting Blobbi walked up to the user's. */
  onMeet?: (id: string) => void;
  /** A Blobbi was tapped (MAIN_BLOBBI for the user's). */
  onBlobbiTap?: (id: string) => void;
  /**
   * The user's Blobbi stroked (a press that starts on it and rubs across it): `start` once the rub is clearly a
   * stroke, `stroke` as it goes on (every so far of rubbing), `end` when the press lifts. A stroke is never also a tap.
   */
  onBlobbiPet?: (phase: 'start' | 'stroke' | 'end') => void;
  /**
   * A Blobbi turned or set off or stopped: it faces where it walks and front
   * at rest, and walks or stands (MAIN_BLOBBI for the user's). Presentation
   * only; called when either changes, not per frame.
   */
  onActorChange?: (id: string, state: RoomActorState) => void;
  /** Pointer events over the room, for the gaze. */
  pointerHandlers?: RoomPointerHandlers;
  floorThings?: RoomFloorThing[];
  /**
   * Physical things in the room (`room-props.ts`): a dish of food, a ball. The 3D scene builds them among the
   * furniture (depth, shadows, a ball that rolls); the simple room draws them on the floor. Keep the array stable.
   */
  props?: readonly RoomProp[];
  /** A prop was tapped. */
  onPropTap?: (id: string) => void;
  /** The room's full fold-in (a first visit's build) played to its end in front of the player. */
  onRoomBuilt?: (roomId: RoomId) => void;
  /** Tapping a piece of furniture that does something. */
  onInteract?: (interaction: FurnitureInteraction, index: number) => void;
  /** Any piece tapped outside decorating (before `onInteract`), and whether it was a lamp switched. */
  onPieceTap?: (index: number, lamp: boolean) => void;
  /** Present while decorating. */
  editor?: RoomEditorBinding;
  /**
   * The room's own taps, strokes, drags and swipes are off (a bath under way takes the pointer on its own layer); the
   * two-finger zoom stays.
   */
  inputLocked?: boolean;
  controlRef?: MutableRefObject<RoomControl | null>;
  /** The scene's status, for callers that show something different without WebGL. */
  onStatusChange?: (status: RoomSceneStatus) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum horizontal swipe distance (px) to trigger room change */
/** A touch this soon after a press on the Blobbi or a grabbed piece belongs to that press (ms). */
const SWIPE_PRESS_MS = 400;
const SWIPE_THRESHOLD = 50;
/** Movement (px) under which a press is a tap rather than a drag. */
const TAP_SLOP = 8;
/** How long the name stays after the pointer leaves the Blobbi, and after a tap on it (ms). */
const NAME_HOVER_GRACE_MS = 180;
const NAME_TAP_MS = 2_500;
/** Room widths (px) below which the room is framed for a phone. */
const PHONE_WIDTH = 500;
/** A phone on its side: the HUD and the dock leave little height, so the room reaches up behind the HUD too. */
const SHORT_HEIGHT = 500;

const ROOM_ICON: Record<RoomId, LucideIcon> = { home: Home, kitchen: Refrigerator, care: Cross, rest: Moon, closet: Shirt };

// ─── Component ────────────────────────────────────────────────────────────────

export function RoomShell({
  roomId,
  headerRoomId,
  roomEntry,
  quality,
  zoom = 1,
  onZoom,
  onSlow,
  onGpu,
  notice = null,
  onChangeRoom,
  isSleeping,
  blobbiStage,
  blobbiWalkSpeed,
  blobbiVisible,
  blobbiModel = null,
  blobbiOverlay,
  blobbiCue,
  hudEnd,
  blobbiName,
  blobbiWanders = true,
  stage,
  hero,
  header,
  statusHud,
  hudVisible = true,
  children,
  middleSlot,
  roomLayout,
  furniturePlacements,
  roomOverlay,
  onInteract,
  onPieceTap,
  guests,
  onMeet,
  onBlobbiTap,
  onBlobbiPet,
  onActorChange,
  pointerHandlers,
  floorThings,
  props,
  onPropTap,
  onRoomBuilt,
  editor,
  inputLocked = false,
  controlRef,
  onStatusChange,
}: RoomShellProps) {
  const isEditing = !!editor;
  const inputLockedRef = useRef(inputLocked);
  inputLockedRef.current = inputLocked;

  const navRoom = headerRoomId ?? roomId;
  const [failureDismissed, setFailureDismissed] = useState(false);
  const goLeft = useCallback(() => onChangeRoom(neighbourRoom(navRoom, 'left')), [onChangeRoom, navRoom]);
  const goRight = useCallback(() => onChangeRoom(neighbourRoom(navRoom, 'right')), [onChangeRoom, navRoom]);
  const room = roomById(navRoom);
  const RoomIcon = ROOM_ICON[navRoom];

  // ─── Touch swipe between rooms ───
  /** The finger a swipe follows (one at a time: a second finger is not a swipe of its own). */
  const swipe = useRef<{ id: number; x: number } | null>(null);
  /** When the room's last press began on the Blobbi (a stroke) or grabbed a piece: not a swipe. Pointer events come first. */
  const notSwipeAt = useRef(-Infinity);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Two fingers are the camera's (a pinch), never a swipe
    if (e.touches.length > 1) {
      swipe.current = null;
      return;
    }
    if (swipe.current || inputLockedRef.current) return;
    // Drags that start on the dock must not switch rooms; nor do touches on chrome, nor stroking the Blobbi.
    if ((e.target as HTMLElement).closest?.('[data-room-drag], [data-room-header], [data-room-top], [data-room-bottom]')) return;
    if (e.timeStamp - notSwipeAt.current < SWIPE_PRESS_MS) return;
    const t = e.changedTouches[0] ?? e.touches[0];
    swipe.current = { id: t.identifier, x: t.clientX };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = swipe.current;
    const t = start && Array.from(e.changedTouches).find((c) => c.identifier === start.id);
    if (!start || !t) return;
    swipe.current = null;
    const dx = t.clientX - start.x;
    if (isEditing || Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (dx > 0) goLeft();
    else goRight();
  }, [isEditing, goLeft, goRight]);

  const onTouchCancel = useCallback(() => {
    swipe.current = null;
  }, []);

  // ─── Framing: the stage is the space between the top and bottom chrome ───
  const shellRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<SceneGeometry | null>(null);
  const behindTopRef = useRef(0);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const measure = () => {
      const box = shell.getBoundingClientRect();
      let top = 0;
      let bottom = box.height;
      shell.querySelectorAll<HTMLElement>('[data-room-top]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.height > 0) top = Math.max(top, r.bottom - box.top);
      });
      shell.querySelectorAll<HTMLElement>('[data-room-bottom]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.height > 0) bottom = Math.min(bottom, r.top - box.top);
      });
      // On phones the resting room may reach up behind most of the HUD, to be
      // shown bigger. Remembered while decorating, which has no HUD, so the
      // camera doesn't jump as it moves between the two views.
      const headerEl = shell.querySelector<HTMLElement>('[data-room-header]');
      if (headerEl) {
        const headerBottom = headerEl.getBoundingClientRect().bottom - box.top;
        behindTopRef.current = box.width < PHONE_WIDTH || box.height < SHORT_HEIGHT ? Math.round(Math.max(0, top - headerBottom) * 0.75) : 0;
      }
      const next: SceneGeometry = {
        width: Math.round(box.width),
        height: Math.round(box.height),
        stage: { left: 0, top: Math.round(top), width: Math.round(box.width), height: Math.max(80, Math.round(bottom - top)) },
        behindTop: behindTopRef.current,
      };
      setGeometry((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    measure();
    // jsdom has no ResizeObserver; the room is measured once there.
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(shell);
    shell.querySelectorAll('[data-room-top], [data-room-bottom]').forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [isEditing]);

  // ─── 3D diorama ───
  const sceneCanvasRef = useRef<HTMLCanvasElement>(null);
  const tapLayerRef = useRef<HTMLDivElement>(null);
  /** The zoom prop, readable from the stable callbacks. */
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const frontCanvasRef = useRef<HTMLCanvasElement>(null);
  const worldAnchorsRef = useRef<HTMLDivElement>(null);
  const uiAnchorsRef = useRef<HTMLDivElement>(null);
  const models = useFurnitureModels(furniturePlacements);
  const isEgg = blobbiStage === 'egg';
  const blobbiTiles = blobbiBoxTiles(blobbiStage);
  // How far its body reaches: it stands that far clear of the walls and the floor's edge, drawn either way
  const blobbi = useMemo(
    () => ({ visible: blobbiVisible, isEgg, tiles: blobbiTiles, sleeping: isSleeping, walkSpeed: blobbiWalkSpeed, reach: blobbiReachTiles(blobbiStage) }),
    [blobbiVisible, isEgg, blobbiTiles, isSleeping, blobbiWalkSpeed, blobbiStage],
  );
  const guestsKey = (guests ?? []).map((g) => `${g.id}:${g.stage}:${g.spawn?.x ?? ''},${g.spawn?.z ?? ''}`).join('|');
  const sceneGuests = useMemo(
    () => (guests ?? []).map(({ id, stage: s, spawn }) => ({ id, isEgg: s === 'egg', tiles: blobbiBoxTiles(s), spawn, reach: blobbiReachTiles(s) })),
    // Only the fields the scene uses
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guestsKey],
  );
  const statusRef = useRef<RoomSceneStatus>('loading');
  const sceneHandle = useRef<RoomScene | null>(null);
  /** The state last reported per Blobbi, so the callback fires on changes only. */
  const actorStatesRef = useRef(new Map<string, RoomActorState>());
  const onActorChangeRef = useRef(onActorChange);
  /** Who waits for a rolling prop to come to rest (`whenPropRests`). */
  const propRests = useRef(new Map<string, (() => void)[]>());
  const onRoomBuiltRef = useRef(onRoomBuilt);
  onRoomBuiltRef.current = onRoomBuilt;
  useEffect(() => {
    onActorChangeRef.current = onActorChange;
  });

  /** Move every anchored DOM element to where its room point is on screen. */
  const updateAnchors = useCallback(() => {
    const scene = sceneHandle.current;
    const status = statusRef.current;
    const flat = status === 'unavailable' && geometry ? flatProjector(geometry, blobbiTiles, zoomRef.current) : null;
    for (const root of [worldAnchorsRef.current, uiAnchorsRef.current]) {
      root?.querySelectorAll<HTMLElement>('[data-anchor]').forEach((el) => {
        let anchor: ScreenAnchor | null = null;
        const { anchor: kind, x, z, index, actor } = el.dataset;
        if (kind === 'blobbi') {
          anchor = scene ? scene.projectBlobbi(actor) : actor ? null : flat?.blobbi() ?? null;
          // The DOM drawing steps aside once the scene has drawn the 3D model in its place, never before
          const drawing = actor ? null : el.querySelector<HTMLElement>('[data-blobbi-2d]');
          if (drawing) {
            const hide = !!scene && scene.actorModelDrawn(MAIN_BLOBBI);
            drawing.style.display = hide ? 'none' : '';
            el.dataset.render = hide ? '3d' : '2d';
            // Behind a back wall (a transition's scene): the drawing shows only outside the walls' outlines
            const behind = !hide && scene ? scene.behindWalls?.() ?? null : null;
            const at = behind && scene ? scene.projectBlobbi() : null;
            drawing.style.clipPath = behind && at && scene ? wallsClip(scene.wallsOnScreen(behind), at) : '';
          }
          // Without the scene (flat room) nobody walks, so everyone stands facing front
          const id = actor ?? MAIN_BLOBBI;
          const facing: BlobbiFacing = scene ? scene.facingOf(id) : 'front';
          const motion = scene?.isWalking(id) ? 'walking' : 'idle';
          const last = actorStatesRef.current.get(id);
          if (last?.facing !== facing || last.motion !== motion) {
            const next: RoomActorState = { facing, motion };
            actorStatesRef.current.set(id, next);
            onActorChangeRef.current?.(id, next);
          }
        }
        else if (kind === 'floor') anchor = scene ? scene.projectFloor(Number(x), Number(z)) : flat?.floor(Number(x), Number(z)) ?? null;
        else if (kind === 'item') anchor = scene ? scene.projectItemTop(Number(index)) : null;
        if (!anchor) {
          el.style.visibility = 'hidden';
          return;
        }
        el.style.visibility = '';
        el.style.transform = `translate3d(${anchor.x}px, ${anchor.y}px, 0)`;
        // Nearer the viewer (lower on screen) draws over what's behind
        if (kind !== 'item') el.style.zIndex = String(Math.round(anchor.y));
        el.style.setProperty('--anchor-px', String(anchor.pxPerTile));
      });
    }
  }, [geometry, blobbiTiles]);

  const { status, sceneRef, failure } = useRoomScene({
    canvasRef: sceneCanvasRef,
    frontCanvasRef,
    geometry,
    layout: roomLayout,
    roomKey: roomId,
    roomEntry,
    quality,
    onSlow,
    onGpu,
    placements: furniturePlacements,
    models,
    blobbi,
    blobbiModel,
    guests: sceneGuests,
    onMeet,
    editing: isEditing,
    selected: editor?.selectedIndex ?? null,
    onFrame: updateAnchors,
    onInvalidChange: editor?.onInvalidChange,
    onRoomBuilt: (key) => onRoomBuiltRef.current?.(key as RoomId),
    onPropRest: (id) => {
      const waiting = propRests.current.get(id);
      propRests.current.delete(id);
      waiting?.forEach((resolve) => resolve());
    },
  });
  statusRef.current = status;
  sceneHandle.current = status === 'ready' ? sceneRef.current : null;
  const is3d = status === 'ready';
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);
  useEffect(() => {
    if (status === 'ready') sceneRef.current?.setMainWanders?.(blobbiWanders);
  }, [status, sceneRef, blobbiWanders]);
  // The zoom the page holds: eased in by the scene (a pinch sets it on the scene at once, then reports it up)
  useEffect(() => {
    if (status === 'ready') sceneRef.current?.setZoom?.(zoom);
    else if (status === 'unavailable') updateAnchors();
    // updateAnchors is a stable callback over refs; the flat room re-places on a zoom change only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, sceneRef, zoom]);

  // Anchored elements mount and unmount with React; place them right away
  useLayoutEffect(() => {
    updateAnchors();
  });

  useEffect(() => {
    if (!controlRef) return;
    controlRef.current = is3d ? {
      findSpot: (query) => sceneRef.current?.findSpot(query) ?? null,
      floorAt: (clientX, clientY) => {
        const box = shellRef.current?.getBoundingClientRect();
        return box ? sceneRef.current?.floorAt(clientX - box.left, clientY - box.top) ?? null : null;
      },
      walkTo: (x, z) => sceneRef.current?.requestWalk(MAIN_BLOBBI, x, z, 'to') ?? Promise.resolve('refused'),
      approach: (x, z, clear) => sceneRef.current?.requestWalk(MAIN_BLOBBI, x, z, 'approach', clear) ?? Promise.resolve('refused'),
      stop: () => sceneRef.current?.stopWalk(MAIN_BLOBBI),
      pickAt: (clientX, clientY) => {
        const box = shellRef.current?.getBoundingClientRect();
        return box ? sceneRef.current?.pick(clientX - box.left, clientY - box.top) ?? null : null;
      },
      blobbiPosition: () => sceneRef.current?.positionOf(MAIN_BLOBBI) ?? null,
      hop: () => sceneRef.current?.hop(MAIN_BLOBBI),
      gesture: (kind) => sceneRef.current?.playGesture?.(MAIN_BLOBBI, kind),
      gaze: (offset) => sceneRef.current?.setActorGaze?.(MAIN_BLOBBI, offset),
      face: (face) => sceneRef.current?.setActorFace?.(MAIN_BLOBBI, face),
      pose: (pose) => sceneRef.current?.setActorPose?.(MAIN_BLOBBI, pose),
      canChoreograph: () => typeof sceneRef.current?.setActorScript === 'function',
      render: () => sceneRef.current?.renderNow?.(),
      holdIntro: (ms) => sceneRef.current?.holdIntro?.(ms),
      stats: () => sceneRef.current?.stats?.() ?? null,
      gpu: () => sceneRef.current?.gpuName?.(),
      script: (script) => sceneRef.current?.setActorScript?.(MAIN_BLOBBI, script),
      wallsCover: (wall) => sceneRef.current?.setWallsCover?.(wall),
      tileFree: (x, z) => sceneRef.current?.tileFree?.(x, z) ?? true,
      skyAt: (x, z) => sceneRef.current?.skyAt?.(x, z) ?? 12,
      standPointNear: (x, z) => sceneRef.current?.standPointNear?.(x, z) ?? { x, z },
      journey: (journey) => sceneRef.current?.setActorJourney?.(MAIN_BLOBBI, journey),
      journeyPreview: (preview) => {
        sceneRef.current?.setActorJourneyPreview?.(MAIN_BLOBBI, preview);
        sceneRef.current?.renderNow?.();
      },
      kickProp: (id, dir, power) => sceneRef.current?.kickProp?.(id, dir, power) ?? false,
      propPosition: (id) => sceneRef.current?.propPosition?.(id) ?? null,
      propResting: (id) => sceneRef.current?.propResting?.(id) ?? true,
      whenPropRests: (id) => {
        const scene = sceneRef.current;
        if (!scene?.propResting || scene.propResting(id)) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const waiting = propRests.current.get(id) ?? [];
          waiting.push(resolve);
          propRests.current.set(id, waiting);
        });
      },
      bath: (frame, anchor) => sceneRef.current?.setBath?.(frame, anchor ?? null),
      itemFootprint: (index) => sceneRef.current?.itemFootprint?.(index) ?? null,
      modelDrawn: () => sceneRef.current?.actorModelDrawn?.(MAIN_BLOBBI) ?? false,
    } : null;
    return () => { controlRef.current = null; };
  }, [is3d, controlRef, sceneRef]);

  // The props, mirrored into the scene; gone with it. Whoever waits for one that is gone is let go.
  useEffect(() => {
    if (!is3d) return;
    sceneRef.current?.setProps?.(props ?? []);
    const ids = new Set((props ?? []).map((p) => p.id));
    for (const [id, waiting] of [...propRests.current]) {
      if (ids.has(id)) continue;
      propRests.current.delete(id);
      waiting.forEach((resolve) => resolve());
    }
  }, [is3d, props, sceneRef]);
  useEffect(() => () => {
    for (const waiting of propRests.current.values()) waiting.forEach((resolve) => resolve());
    propRests.current.clear();
  }, []);

  // ─── The name: shown while hovered, for a moment after a tap, while focused; never left up ───
  const [nameBy, setNameBy] = useState({ hover: false, tap: false, focus: false });
  const nameShown = !isEditing && (nameBy.hover || nameBy.tap || nameBy.focus);
  const hoverGrace = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setHover = useCallback((on: boolean) => {
    if (hoverGrace.current) clearTimeout(hoverGrace.current);
    hoverGrace.current = null;
    if (on) setNameBy((n) => (n.hover ? n : { ...n, hover: true }));
    // A short grace on leaving, so the name does not flicker at the body's edge
    else hoverGrace.current = setTimeout(() => setNameBy((n) => (n.hover ? { ...n, hover: false } : n)), NAME_HOVER_GRACE_MS);
  }, []);
  const showNameForTap = useCallback(() => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
    setNameBy((n) => (n.tap ? n : { ...n, tap: true }));
    tapTimer.current = setTimeout(() => setNameBy((n) => ({ ...n, tap: false })), NAME_TAP_MS);
  }, []);
  const hideNameForTap = useCallback(() => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = null;
    setNameBy((n) => (n.tap ? { ...n, tap: false } : n));
  }, []);
  useEffect(() => () => {
    if (hoverGrace.current) clearTimeout(hoverGrace.current);
    if (tapTimer.current) clearTimeout(tapTimer.current);
  }, []);

  // ─── Taps and drags in the room ───
  const press = useRef<{ id: number; x: number; y: number; t: number; item: number | null; dragging: boolean; onBlobbi: boolean; rubbed: number; last: { x: number; y: number }; petting: boolean; strokeAt: number } | null>(null);
  // ─── Two fingers on the room: the camera, nothing else ───
  /** Every pointer down on the room right now, where it is. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  /** A pinch under way: how far apart the fingers started and the zoom then. */
  const pinch = useRef<{ startDist: number; startZoom: number } | null>(null);
  const fingerDistance = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  /** Whatever one finger was doing ends: a stroke, a grabbed piece, a press; the fingers are the camera's now. */
  const dropPress = useCallback(() => {
    const p = press.current;
    if (!p) return;
    if (p.dragging) sceneRef.current?.cancelDrag?.();
    if (p.petting) onBlobbiPet?.('end');
    sceneRef.current?.pressItem?.(null);
    press.current = null;
  }, [sceneRef, onBlobbiPet]);
  const applyPinch = useCallback(() => {
    const pz = pinch.current;
    const scene = sceneRef.current;
    if (!pz || !scene || pz.startDist <= 0) return;
    const next = pz.startZoom * (fingerDistance() / pz.startDist);
    scene.setZoom?.(next, true);
    onZoom?.(scene.zoomLimits?.().value ?? next);
  }, [sceneRef, onZoom]);
  // The wheel (and a trackpad's pinch, which arrives as a wheel with ctrl): nearer or farther, the page not scrolled
  useEffect(() => {
    const layer = tapLayerRef.current;
    if (!layer) return;
    const onWheel = (e: WheelEvent) => {
      const scene = sceneRef.current;
      if (!scene?.setZoom || !scene.zoomLimits) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey || e.metaKey ? 0.01 : 0.0012));
      scene.setZoom(scene.zoomLimits().value * factor);
      onZoom?.(scene.zoomLimits().value);
    };
    layer.addEventListener('wheel', onWheel, { passive: false });
    return () => layer.removeEventListener('wheel', onWheel);
  }, [sceneRef, onZoom, is3d]);

  const localPoint = (e: React.PointerEvent) => {
    const box = shellRef.current!.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const at = localPoint(e);
    pointers.current.set(e.pointerId, at);
    if (pointers.current.size >= 2) {
      // A second finger: the camera, and only the camera, from here until both lift
      dropPress();
      swipe.current = null;
      notSwipeAt.current = e.timeStamp;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      if (!pinch.current) pinch.current = { startDist: fingerDistance(), startZoom: scene.zoomLimits?.().value ?? zoomRef.current };
      return;
    }
    if (!e.isPrimary || inputLockedRef.current) return;
    const { x, y } = at;
    const hit = scene.pick(x, y);
    const item = hit?.kind === 'item' ? hit.index : null;
    const onBlobbi = !editor && hit?.kind === 'actor' && hit.id === MAIN_BLOBBI && !!onBlobbiPet;
    press.current = { id: e.pointerId, x, y, t: performance.now(), item, dragging: false, onBlobbi, rubbed: 0, last: { x, y }, petting: false, strokeAt: 0 };
    notSwipeAt.current = onBlobbi || (editor && item !== null) ? e.timeStamp : -Infinity;
    // A piece pressed gives a little under the finger (touch feedback), until released
    if (!editor && item !== null) scene.pressItem?.(item);
    // A press on the Blobbi may become a stroke: keep its moves even if the finger slides off a little
    if (onBlobbi) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (editor && item !== null) {
      // Grab right away, like picking something up
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      if (editor.selectedIndex !== item) editor.onSelect(item);
    }
  }, [editor, sceneRef, onBlobbiPet, dropPress]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, localPoint(e));
    if (pinch.current) {
      if (pointers.current.size >= 2) applyPinch();
      return;
    }
    const p = press.current;
    const scene = sceneRef.current;
    // A hovering pointer: over the Blobbi it shows its name; over a piece the piece answers (a lift, a ring if it
    // does something) and the pointer says it can be tapped. Nothing pressed, not while decorating, never by touch.
    if (!editor && scene && e.pointerType !== 'touch' && e.buttons === 0 && !p) {
      const { x, y } = localPoint(e);
      if (blobbiName) setHover(scene.overActor(x, y, MAIN_BLOBBI));
      const kind = scene.hoverAt?.(x, y) ?? null;
      const layer = e.currentTarget as HTMLElement;
      if (layer.dataset.hover !== (kind ?? '')) layer.dataset.hover = kind ?? '';
    }
    // Petting: rubbing across the Blobbi (only the distance travelled over it counts)
    if (p && p.id === e.pointerId && scene && p.onBlobbi) {
      const { x, y } = localPoint(e);
      if (scene.overActor(x, y, MAIN_BLOBBI)) p.rubbed += Math.hypot(x - p.last.x, y - p.last.y);
      p.last = { x, y };
      if (!p.petting && p.rubbed >= PET_START_PX) {
        p.petting = true;
        p.strokeAt = p.rubbed;
        onBlobbiPet?.('start');
      } else if (p.petting && p.rubbed - p.strokeAt >= PET_STROKE_PX) {
        p.strokeAt = p.rubbed;
        onBlobbiPet?.('stroke');
      }
      return;
    }
    if (!p || p.id !== e.pointerId || !scene || !editor || p.item === null) return;
    const { x, y } = localPoint(e);
    if (!p.dragging) {
      if (Math.hypot(x - p.x, y - p.y) < TAP_SLOP) return;
      p.dragging = scene.beginDrag(p.item, p.x, p.y);
    }
    if (p.dragging) scene.dragTo(x, y);
  }, [editor, sceneRef, blobbiName, setHover, onBlobbiPet, applyPinch]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      // The pinch ends when a finger lifts; the one left is not a tap, a stroke or a walk
      if (pointers.current.size < 2) pinch.current = null;
      return;
    }
    const p = press.current;
    // Another finger lifting doesn't end this press
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    const scene = sceneRef.current;
    if (!scene) return;
    scene.pressItem?.(null);
    if (p.dragging) {
      const result = scene.endDrag();
      if (result?.valid) editor?.onMove(result.index, result.placement);
      return;
    }
    // A stroke ends; it was never a tap
    if (p.petting) {
      onBlobbiPet?.('end');
      return;
    }
    const { x, y } = localPoint(e);
    if (Math.hypot(x - p.x, y - p.y) >= TAP_SLOP || performance.now() - p.t > 600) return;
    if (editor) {
      if (p.item === null) editor.onSelect(null);
      return;
    }
    const hit = scene.pick(x, y);
    if (hit?.kind === 'actor') {
      // The app reacts to its own Blobbi (a face, a gesture, a sound); a visitor, or a Blobbi nobody listens for, hops
      if (hit.id !== MAIN_BLOBBI || !onBlobbiTap) scene.hop(hit.id);
      if (hit.id === MAIN_BLOBBI) showNameForTap();
      onBlobbiTap?.(hit.id);
      return;
    }
    // A tap anywhere else puts the name away
    hideNameForTap();
    if (hit?.kind === 'prop') {
      onPropTap?.(hit.id);
      return;
    }
    if (hit?.kind === 'item') {
      scene.poke(hit.index);
      const lamp = scene.toggleLamp(hit.index);
      onPieceTap?.(hit.index, lamp);
      const interaction = furniturePlacements?.[hit.index] && resolveFurniture(furniturePlacements[hit.index].id)?.interaction;
      if (interaction) onInteract?.(interaction, hit.index);
    } else if (hit?.kind === 'floor') {
      scene.walkTo(hit.x, hit.z);
    }
  }, [editor, sceneRef, furniturePlacements, onInteract, onPieceTap, onBlobbiTap, onBlobbiPet, onPropTap, showNameForTap, hideNameForTap]);

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pinch.current && pointers.current.size < 2) pinch.current = null;
    if (press.current?.id !== e.pointerId) return;
    // Taken away by the system (a call, a gesture of the OS): the piece goes back where it was
    if (press.current.dragging) sceneRef.current?.cancelDrag?.();
    if (press.current.petting) onBlobbiPet?.('end');
    sceneRef.current?.pressItem?.(null);
    press.current = null;
  }, [sceneRef, onBlobbiPet]);

  return (
    <div
      ref={shellRef}
      className="room-shell relative flex flex-col flex-1 min-h-0 overflow-hidden select-none"
      // The sky a teleport's motes leave through and come in from (TeleportFrame2D measures to its top edge)
      data-teleport-sky
      data-testid="room-shell"
      data-room={roomId}
      data-scene={status}
      data-blobbi-render={blobbiModel ? '3d' : '2d'}
      data-input-locked={inputLocked ? 'true' : undefined}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onPointerMove={pointerHandlers?.onPointerMove}
      onPointerLeave={pointerHandlers?.onPointerLeave}
      onPointerDown={pointerHandlers?.onPointerDown}
    >
      {/* Backdrop the diorama floats in */}
      <div className="absolute inset-0 room-backdrop" aria-hidden />
      {/* The 3D room could not be drawn: one honest line, then the simple room carries on (care, items, rooms) */}
      {(failure || notice) && !failureDismissed && (
        <div className="room-fallback-note" role="status" data-testid="room-fallback-note" data-reason={failure ?? 'blobbi-3d'}>
          <span>{failure ? FAILURE_TEXT[failure] : notice}</span>
          <button type="button" className="room-fallback-note__close touch-hit" onClick={() => setFailureDismissed(true)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
      {status !== 'unavailable' && (
        <canvas ref={sceneCanvasRef} className="absolute inset-0 size-full" aria-hidden data-testid="room-canvas-3d" />
      )}

      {/* Taps and drags in the room */}
      {is3d && (
        <div
          ref={tapLayerRef}
          className={cx('room-tap-layer absolute inset-0 z-[4] touch-none', isEditing && 'cursor-grab active:cursor-grabbing')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={(e) => {
            setHover(false);
            sceneRef.current?.hoverAt?.(-1, -1);
            (e.currentTarget as HTMLElement).dataset.hover = '';
          }}
          aria-hidden
          data-testid="room-tap-layer"
        />
      )}

      {/* Things standing in the room, placed by the scene each frame */}
      <div ref={worldAnchorsRef} className="absolute inset-0 z-[5] pointer-events-none" aria-hidden={!stage}>
        {blobbiCue && !blobbiVisible && !isEditing && (
          <div data-anchor="blobbi" data-testid="room-blobbi-cue" className={cx('absolute left-0 top-0', status === 'loading' && 'invisible')} style={{ '--blobbi-tiles': blobbiTiles } as CSSProperties}>
            <div className="room-blobbi-overlay">{blobbiCue}</div>
          </div>
        )}
        {(stage || blobbiOverlay || blobbiName) && blobbiVisible && (
          <div
            data-anchor="blobbi"
            data-testid="room-blobbi-anchor"
            data-render="2d"
            className={cx('absolute left-0 top-0 transition-opacity duration-300', isEditing && 'opacity-40', status === 'loading' && 'invisible')}
            style={{ '--blobbi-tiles': blobbiTiles } as CSSProperties}
          >
            {/* The drawing, while no 3D model is on screen in its place (updateAnchors hides it once one is). Re-keyed per room: it hops in once the room has folded together */}
            {stage && (
              <div data-blobbi-2d>
                <div key={is3d ? roomId : 'flat'} className={cx(is3d && !roomEntry && 'room-enter')}>
                  {stage}
                </div>
              </div>
            )}
            {blobbiOverlay && !isEditing && <div className="absolute left-0 top-0" data-testid="room-blobbi-overlay">{blobbiOverlay}</div>}
            {blobbiName && (
              <>
                {/* The name over its head, on demand only; the screen reader has it from the stand-in below */}
                <span className="room-name-tag room-blobbi-name" data-shown={nameShown} aria-hidden data-testid="room-blobbi-name">
                  <span className="room-name-tag__dot" style={{ background: blobbiName.color }} />
                  <span>{blobbiName.text}</span>
                </span>
                {/* The Blobbi for the keyboard: focus shows the name; Enter says hello (a hop). Never in the pointer's way. */}
                <button
                  type="button"
                  className="room-blobbi-focus"
                  aria-label={`${blobbiName.text}, your Blobbi`}
                  onFocus={() => setNameBy((n) => ({ ...n, focus: true }))}
                  onBlur={() => setNameBy((n) => ({ ...n, focus: false }))}
                  onClick={() => {
                    if (onBlobbiTap) onBlobbiTap(MAIN_BLOBBI);
                    else sceneRef.current?.hop(MAIN_BLOBBI);
                  }}
                  tabIndex={isEditing ? -1 : 0}
                  data-testid="room-blobbi-focus"
                />
              </>
            )}
          </div>
        )}
        {is3d && !isEditing && guests?.map((g) => (
          <div
            key={g.id}
            data-anchor="blobbi"
            data-actor={g.id}
            className="absolute left-0 top-0 room-enter room-enter--quick"
            style={{ '--blobbi-tiles': blobbiBoxTiles(g.stage) } as CSSProperties}
          >
            {g.node}
          </div>
        ))}
        {status !== 'loading' && floorThings?.map((t) => (
          <div key={t.key} data-anchor="floor" data-x={t.x} data-z={t.z} className="absolute left-0 top-0">
            {t.node}
          </div>
        ))}
        {/* Without the 3D room, the props are drawings on the floor (the scene draws them itself otherwise) */}
        {status === 'unavailable' && props?.map((p) => (
          <div key={p.id} data-anchor="floor" data-x={p.x} data-z={p.z} className="absolute left-0 top-0">
            <RoomFlatProp prop={p} onTap={onPropTap} />
          </div>
        ))}
      </div>

      {status !== 'unavailable' && (
        <canvas ref={frontCanvasRef} className="absolute inset-0 z-[6] size-full pointer-events-none" aria-hidden />
      )}

      {/* Sleep dims the room; in 3D the lights dim too, so the veil is lighter */}
      <div
        className={cx('absolute inset-0 z-[12] pointer-events-none transition-opacity duration-700', isSleeping ? 'opacity-100' : 'opacity-0')}
        style={{ background: `radial-gradient(ellipse at 50% 45%, rgba(10,12,40,${is3d ? 0.08 : 0.25}) 0%, rgba(10,12,40,${is3d ? 0.3 : 0.5}) 100%)` }}
        aria-hidden
      />

      {/* UI that follows the room (a decorator's item toolbar) */}
      <div ref={uiAnchorsRef} className="absolute inset-0 z-[45] pointer-events-none">
        {editor?.toolbar && editor.selectedIndex !== null && (
          <div data-anchor="item" data-index={editor.selectedIndex} className="absolute left-0 top-0">
            <div className="absolute bottom-3 left-0 -translate-x-1/2 pointer-events-auto">{editor.toolbar}</div>
          </div>
        )}
      </div>

      {!isEditing && header && (
        <div data-room-header className="relative z-[70] shrink-0">{header}</div>
      )}

      {/* HUD: an empty slot (left), the room switcher, the end slot (the home switch, M14.1), then the needs. Decorating
          moved to the dock's right, beside the carousel (`RoomBottomBar`); `onDecorate` is kept for the editor's binding. */}
      {!isEditing && (
        <div
          data-room-top
          aria-hidden={!hudVisible}
          className={cx('room-hud relative z-30 px-3 pt-[1.1em] pb-[0.6em] pointer-events-none transition-opacity duration-200', !hudVisible && 'opacity-0')}
        >
          <div className="room-hud__row flex items-start justify-between gap-2">
            <div className="size-[2.75em] shrink-0" aria-hidden />

            <div className={cx('room-switcher flex items-center gap-1 p-1 rounded-full', hudVisible && 'pointer-events-auto')} data-testid="room-switcher">
              <RoomNavButton direction="left" label={roomById(neighbourRoom(navRoom, 'left')).label} onClick={goLeft} />
              <div className="flex flex-col items-center gap-[0.25em] min-w-[6.5em] px-[0.25em]">
                <span className="flex items-center gap-[0.4em] whitespace-nowrap text-[1em] font-semibold text-foreground" data-testid="room-label">
                  <RoomIcon className="size-[1.1em] text-muted-foreground" aria-hidden />
                  {/* The name in its own element: the icon changes with the room and React inserts the new one before its next
                      sibling; a page translator (Chrome's) moves bare text into a <font>, and inserting before a text node that
                      is no longer here throws NotFoundError mid-commit (a white page without a boundary). An element stays. */}
                  <span>{room.label}</span>
                </span>
                <span className="flex items-center gap-1" aria-hidden>
                  {ROOM_ORDER.map((id) => (
                    <span
                      key={id}
                      className={cx('h-[0.25em] rounded-full transition-all duration-300', id === navRoom ? 'w-[0.8em] bg-primary' : 'w-[0.25em] bg-foreground/25')}
                    />
                  ))}
                </span>
              </div>
              <RoomNavButton direction="right" label={roomById(neighbourRoom(navRoom, 'right')).label} onClick={goRight} />
            </div>

            {/* The end slot, the size of the decorate button, so the switcher stays centred */}
            <div className={cx('size-[2.75em] shrink-0', hudVisible && 'pointer-events-auto')}>{hudEnd}</div>
          </div>

          {statusHud && (
            <div className={cx('room-hud__status mt-[1.25em] flex justify-center', hudVisible && 'pointer-events-auto')}>
              {statusHud}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0" />

      {/* Dock: inline activity, then the per-room bar on Ditto's arc */}
      {!isEditing && (
        <div data-room-bottom className="room-dock relative z-[15] shrink-0">
          {middleSlot}
          <div className="relative">
            <ArcBackground variant="up-subtle" />
            {children}
          </div>
        </div>
      )}

      {hero && (
        <div className="absolute inset-0 z-20 flex pointer-events-none">
          {hero}
        </div>
      )}

      {roomOverlay && (
        <div className="absolute inset-0 z-50">
          {roomOverlay}
        </div>
      )}

      {editor && (
        <div className="absolute inset-0 z-50 flex flex-col pointer-events-none">
          {editor.overlay}
        </div>
      )}

      {/* Screen-reader summary of the room */}
      <p className="sr-only" aria-live="polite">{room.label}</p>
    </div>
  );
}

// ─── Room nav button ──────────────────────────────────────────────────────────

function RoomNavButton({ direction, label, onClick }: { direction: 'left' | 'right'; label: string; onClick: () => void }) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'touch-hit size-[2.4em] shrink-0 rounded-full flex items-center justify-center',
        'text-foreground/70 hover:text-foreground hover:bg-foreground/10',
        'transition-colors duration-150 active:scale-90 motion-reduce:active:scale-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      aria-label={`Go to ${label}`}
      data-testid={`room-nav-${direction}`}
    >
      <Icon className="size-[1.3em]" strokeWidth={2.5} />
    </button>
  );
}

// ─── Without WebGL ────────────────────────────────────────────────────────────

/**
 * Stand-in projection with no room: the Blobbi in the middle of the stage, a
 * little larger than in the room, and floor spots spread around its feet.
 */
function flatProjector(g: SceneGeometry, tiles: number, zoom = 1) {
  const size = Math.min(g.stage.height * 0.62, g.width * 0.72) * zoom;
  const pxPerTile = size / tiles;
  const feet = { x: g.stage.left + g.stage.width / 2, y: g.stage.top + g.stage.height * 0.8 };
  const spread = (Math.min(g.width * 0.42, size * 0.9) / (ROOM_GRID / 2)) * zoom;
  return {
    blobbi: (): ScreenAnchor => ({ ...feet, pxPerTile }),
    floor: (x: number, z: number): ScreenAnchor => ({
      x: feet.x + (x - z) * spread * 0.5,
      y: feet.y + (x + z - ROOM_GRID * 1.1) * spread * 0.12,
      pxPerTile: pxPerTile * 0.6,
    }),
  };
}
