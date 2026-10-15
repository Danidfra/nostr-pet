/**
 * RoomScene — the Blobbi room as a three.js papercraft diorama.
 *
 * A square floor with two back walls meeting in a corner, seen from the open
 * corner (see room-geometry.ts for the coordinates). Paper textures, a warm
 * key light with soft shadows, and furniture built from Simple Nostr Objects,
 * placed on the tile grid.
 *
 * The Blobbi is a DOM element on top of the canvas; the scene owns where it
 * stands and walks, casts its shadow, and reports where it (and anything else
 * anchored to the room) lands on screen through `projectBlobbi` /
 * `projectFloor` / `projectItemTop` after each frame (`onFrame`). Furniture
 * standing in front of the Blobbi is drawn again into a second 2D canvas
 * layered over it.
 *
 * Editing (Animal Crossing–style): pick an item, drag it tile by tile on the
 * floor or along the walls, with green/red footprints for free/blocked spots.
 * The React side owns the placements; the scene snaps, stacks small items on
 * tables, and reports overlaps.
 *
 * Imported on demand with three.
 *
 * Ditto's engine, with three changes for the standalone: a walk is a
 * request that resolves how it ended (the home's `WalkOutcome` contract),
 * each Blobbi walks at the pace of its own gait (`room-pace.ts`) instead of
 * one constant, and the walker no longer hops: the renderer animates the
 * body (the V3 adult on its legs, a baby with its own hop), so the anchor
 * stays on the floor.
 */

import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { SnoNode } from './sno-object';
import { buildSnoObject } from './sno-three';
import { BathLayer } from './bath-scene';
import type { BathAnchor, BathFrame } from '@/features/bath/bath-frame';
import type { ActorFrame, ActorGesture, ActorModel } from '../blobbi3d/actor';
import { journeyDuration, journeyFrame, journeyShadow, type JourneyFrame, type JourneyKind } from '@/features/teleport/timeline';
import { moteLayers } from '@/features/teleport/particles';
import type { ProceduralFace } from '@/features/expression/faces';
import { QUALITY, createQualityMonitor, type QualitySettings } from '../room-quality';
import type { Teleport3DOptions } from '@/features/teleport/three/teleport3d';

import type { FurnitureInteraction, FurnitureMount } from '../furniture-3d';
import type { FurniturePlacement } from '../room-furniture';
import type { RoomLayout, RoomSurfaceLayout } from '../room-layout';
import {
  CAMERA_AZIMUTH,
  CAMERA_ELEVATION,
  MAIN_BLOBBI as MAIN,
  MODEL_UNITS_PER_TILE,
  ROOM_GRID as G,
  SNO_FIT_TILES,
  WALL_HEIGHT as H,
  clampToReach,
  clampToRoom,
  snapCenter,
  type BlobbiReach,
} from '../room-geometry';
import type { WalkOutcome } from '@/features/home/scene/useBlobbiLocomotion';
import type { BlobbiFacing } from '@blobbi-kit/renderer';
import { facingAlongPath, facingBasis, facingForHeading } from '../room-facing';
import type { ModelExtras } from './official-models';
import { latheSegments } from './sno-builder';
import { drawSurface, paperBump } from './paper-textures';
import { recordRuntimeError } from '../runtime-errors';
import { PROP_ENTER_MS, PROP_LEAVE_MS, glyphKey, type RoomProp } from '../room-props';
import { BALL, ballAt, ballResting, kickBall, stepBall, type BallState } from '../ball-physics';
import { biteFood, drawBallSkin, drawFood, loadFoodImage } from './prop-art';
import { buildFoodModel, disposeFoodModel, foodModelFor, type FoodModel } from './food-models';

// ─── Public types ─────────────────────────────────────────────────────────────

/** Canvas size, and the part of it the room should fill (between HUD and dock), in CSS px. */
export interface SceneGeometry {
  width: number;
  height: number;
  stage: { left: number; top: number; width: number; height: number };
  /**
   * How far above the stage, in CSS px, the room may reach while not being
   * decorated: behind the HUD, whose buttons can sit over the tops of the
   * walls. Lets short screens show the room bigger.
   */
  behindTop?: number;
}

/** One piece of furniture to show. */
export interface SceneItem {
  /** Index in the room's placement array. */
  index: number;
  /** Stable while the item's model is unchanged. */
  key: string;
  node: SnoNode;
  extras?: ModelExtras;
  /** Official models are sized from their centimetre units; network objects are fitted. */
  official: boolean;
  mount: FurnitureMount;
  small?: boolean;
  surface?: boolean;
  interaction?: FurnitureInteraction;
  placement: FurniturePlacement;
}

/** A point in the room on screen, in canvas CSS px, with the room's scale there. */
export interface ScreenAnchor {
  x: number;
  y: number;
  /** Screen px per tile at that point. */
  pxPerTile: number;
}

export type PickResult =
  | { kind: 'actor'; id: string }
  | { kind: 'item'; index: number }
  | { kind: 'prop'; id: string }
  | { kind: 'floor'; x: number; z: number }
  | null;

/** What `findSpot` needs to know about an item that isn't in the room yet. */
export interface SpotQuery {
  node: SnoNode;
  official: boolean;
  mount: FurnitureMount;
  scale?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FOV = (26 * Math.PI) / 180;
/** Camera direction: from the open corner, looking into the room (room-geometry.ts). */
const AZIMUTH = CAMERA_AZIMUTH;
const ELEVATION = CAMERA_ELEVATION;
/** Higher view while decorating, like Animal Crossing's editing camera. */
const EDIT_ELEVATION = (52 * Math.PI) / 180;
/**
 * The room may overflow the stage sideways by this much to fill tall screens:
 * more at rest, for a closer view, and less while decorating, so the ends of
 * the walls can be reached. These are the most it may on a wide stage; a
 * narrow one (a phone upright) allows less, see `sideOverflow`.
 */
const SIDE_OVERFLOW = { rest: 1.5, edit: 1.3 };
/** On a stage this narrow (width over height) the room may spill only `NARROW_OVERFLOW` past the sides. */
const NARROW_ASPECT = 0.72;
/** A wide stage (width at least its height) keeps the full overflow; between, it eases. */
const WIDE_ASPECT = 1;
const NARROW_OVERFLOW = 1.1;
/** The user's zoom: no farther than this (a small object) and no nearer than the camera staying outside the room. */
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 2.2;
/**
 * The camera keeps at least this far from the room's centre, in tiles: the open corner is G/√2 ≈ 0.71 G away along
 * the floor and the camera sits above it, so at 0.9 G it is still outside the room and in front of everything.
 */
const ZOOM_KEEP_OUT = 0.9;
/** How fast the view eases to a new zoom (buttons, a restored preference); a pinch follows the fingers at once. */
const ZOOM_EASE = 9;

/**
 * How far past the stage's sides the room may spill, for this stage's
 * shape: all of `most` on a wide stage, where the height decides the
 * framing anyway; only a little on a narrow one (a phone upright), where
 * the width decides it and the old allowance cut a quarter of the room off
 * each side. Between the two it eases, so turning a phone does not jump.
 */
export function sideOverflow(stageWidth: number, frameHeight: number, most: number): number {
  const aspect = stageWidth / Math.max(frameHeight, 1);
  const least = Math.min(most, NARROW_OVERFLOW);
  if (aspect <= NARROW_ASPECT) return least;
  if (aspect >= WIDE_ASPECT) return most;
  const t = (aspect - NARROW_ASPECT) / (WIDE_ASPECT - NARROW_ASPECT);
  return least + (most - least) * t;
}
/** Pointer parallax, radians. */
const PARALLAX = { az: 0.06, el: 0.035 };
/** How fast the camera follows the pointer, and the room dims for sleep: the fraction of the way left per second is e^-rate. */
const PARALLAX_EASE = 7.7;
const SLEEP_EASE = 3.7;
/** How fast a switched lamp fades. */
const LAMP_EASE = 24;
/** How strongly a bulb's halo tints the wall behind it when its lamp is on. */
const HALO_OPACITY = 0.3;
/** How brightly a lampshade glows over its own colour when its lamp is on. */
const SHADE_GLOW = 0.75;

/** The viewer's axes in room coordinates, for a walker's facing. The parallax wobble is too small to matter. */
const FACING_BASIS = facingBasis(AZIMUTH);
/** The fraction of the way to a target to move in `dt` seconds, easing at `rate`, whatever the frame rate. */
function easeBy(dt: number, rate: number): number {
  return 1 - Math.exp(-rate * dt);
}
/** Pattern texels per tile; the tile floor pattern lines up with the grid. */
const PATTERN_PX_PER_TILE = 44;
/** Wall and floor slab thickness, in tiles. */
const THICK = 0.25;
const BASE = 0.45;
/** Shells sit this far behind the painted faces, so the two never share a plane. */
const GAP = 0.03;
/** Furniture stands this far off the floor and walls, so flat bases and backs never share their plane. */
const FLOOR_OFFSET = 0.008;
const WALL_OFFSET = 0.04;
const MAX_DPR = 1.5;
/** Lamps that can light the room at once; a fixed pool, so adding a lamp never recompiles shaders. */
const LAMP_POOL = 3;
/** Painted surfaces kept across room switches (5 rooms × 3 surfaces, plus slack). */
const SURFACE_CACHE = 20;
/** Fold-in timings (ms): floor unrolls, then the walls hinge up, then furniture pops. */
const INTRO = { floor: [0, 420], left: [200, 760], right: [300, 860], furniture: 700, stagger: 70, pop: 650 } as const;
/**
 * A room seen before comes back quickly: the same fold, brisk, its pieces up together. About 400 ms in all, so an
 * ordinary change of room stays quick (the full fold-in is for a room's first visit).
 */
/** The convex hull of points (Andrew's monotone chain), clockwise on screen. */
function convexHull(points: { x: number; y: number }[]): { x: number; y: number }[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: { x: number; y: number }[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: { x: number; y: number }[] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Idle life alone (a 3D model breathing and blinking) is drawn this often: ~30 frames a second, not every vsync. */
const IDLE_FRAME_MS = 1000 / 30;

const QUICK_INTRO = { floor: [0, 170], left: [30, 240], right: [60, 270], furniture: 110, stagger: 16, pop: 280 } as const;

/** How a room comes on screen: folding together for the first time, briskly when seen before, or simply there. */
export type RoomIntro = 'build' | 'quick' | 'none';

/** A choreographed place for a Blobbi (a transition's): where it is, how high, which way, and whether it walks. */
export interface ActorScript {
  x: number;
  z: number;
  /** Height of its feet above the floor (tiles); below zero, it has fallen off the floor. */
  elev: number;
  /** Yaw about +y (0 faces +z); the 2D drawing's facing follows. */
  heading?: number;
  walking?: boolean;
}
/** Faces meeting at more than this angle keep a hard edge. */
const CREASE_ANGLE = (40 * Math.PI) / 180;
const POKE_DURATION = 420;
/** Walking speed, tiles per second, for a Blobbi given none (Ditto's one speed); and the idle wander interval (ms). */
const DEFAULT_WALK_SPEED = 2.2;
const WANDER_MS = [4500, 9000] as const;
/** Network objects are capped at this height, in tiles, at scale 1. */
const SNO_MAX_HEIGHT = 3;
/** Half a Blobbi's body width as a fraction of its art box: the clearance it keeps from furniture. */
const BODY_HALF_WIDTH = 0.3;
/** A Blobbi's reach when the caller gives none: the adult's fraction of its box, every way (`blobbiReachTiles` gives the measured one). */
function defaultReach(tiles: number): BlobbiReach {
  return { back: tiles * 0.38, front: tiles * 0.38 };
}

function sameReach(a: BlobbiReach, b: BlobbiReach): boolean {
  return a.back === b.back && a.front === b.front;
}

/** How far a piece must come nearer the camera than a Blobbi's feet (in x + z) to be drawn over it. */
const BODY_DEPTH = 0.5;
/** Network objects no taller than this fraction of their footprint lie on the floor like rugs. */
const FLAT_RATIO = 0.12;
/** Lift a selected item off the floor while editing. */
const SELECT_LIFT = 0.12;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Free an object's geometry, materials and textures. Shared ones are skipped;
 * pooled materials go to `release` instead of being disposed, so their shader
 * program survives for the next room (three frees a program with its last
 * material, and recompiling is the slowest thing a room switch can do).
 */
function disposeObject(root: THREE.Object3D, release?: (material: THREE.Material) => void) {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.Line) {
      if (!child.geometry.userData.shared) child.geometry.dispose();
      const materials: THREE.Material[] = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (material.userData.shared) continue;
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture && !value.userData.shared) value.dispose();
        }
        if (material.userData.pool && release) release(material);
        else material.dispose();
      }
    }
  });
}

/**
 * Everything stays on layer 0, which the main pass draws and so casts shadows
 * from; front pieces are also on layer 1, which the overlay pass draws.
 */
function setFront(root: THREE.Object3D, front: boolean) {
  root.traverse((child) => {
    child.layers.set(0);
    if (front) child.layers.enable(1);
  });
}

/** Spring-ish ease with a little overshoot, 0→1. */
function easeOutBack(t: number): number {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function shared<T extends { userData: Record<string, unknown> }>(value: T): T {
  value.userData.shared = true;
  return value;
}

function disposeSurface(material: THREE.MeshStandardMaterial) {
  material.map?.dispose();
  material.dispose();
}

function hexColor(hex: string): THREE.Color {
  return new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);
}

/** 0 at night, 1 in the day, easing through dawn and dusk. */
function daylight(date = new Date()): number {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h < 5.5 || h >= 21) return 0;
  if (h < 8) return (h - 5.5) / 2.5;
  if (h >= 18.5) return 1 - (h - 18.5) / 2.5;
  return 1;
}

/** Soft round shadow texture for the Blobbi's contact shadow. */
function contactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.38)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.16)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(canvas);
}

/** A soft white disc, tinted per bulb for the glow it throws on the wall behind it. */
function haloTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.28)');
    g.addColorStop(0.65, 'rgba(255,255,255,0.08)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(canvas);
}

interface Rect { x0: number; x1: number; z0: number; z1: number }

function overlaps(a: Rect, b: Rect): boolean {
  const e = 1e-3;
  return a.x0 < b.x1 - e && b.x0 < a.x1 - e && a.z0 < b.z1 - e && b.z0 < a.z1 - e;
}

function contains(r: Rect, x: number, z: number): boolean {
  return x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
}

function midX(r: Rect): number {
  return (r.x0 + r.x1) / 2;
}

function midZ(r: Rect): number {
  return (r.z0 + r.z1) / 2;
}

/** A rect `w` by `d` centered on (x, z). */
function rectAt(x: number, z: number, w: number, d: number): Rect {
  return { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 };
}

/** Where a wall item of `size` hangs: half-tile steps, kept on the wall. Rect x = along, z = height. */
function wallRect(along: number, height: number, size: THREE.Vector3): Rect {
  const a = clampToRoom(Math.round(along * 2) / 2, Math.min(G, size.x));
  const h = clampToRoom(Math.round(height * 2) / 2, Math.min(H, size.y), H);
  return rectAt(a, h, size.x, size.y);
}

/**
 * Put an object flat against its surface at `rect`: lying on the floor at
 * height `y`, or `off` in front of the left or right wall.
 */
function poseOnSurface(obj: THREE.Object3D, at: FurniturePlacement['at'], rect: Rect, y: number, off: number) {
  if (at === 'floor') obj.position.set(midX(rect), y, midZ(rect));
  else if (at === 'left') obj.position.set(off, midZ(rect), midX(rect));
  else obj.position.set(midX(rect), midZ(rect), off);
}

/** Whole tiles an item `size` tiles across takes up. */
function tilesFor(size: number): number {
  return Math.max(1, Math.ceil(size - 0.2));
}

/**
 * Whether a floor footprint stands between a Blobbi at (x, z) and the camera,
 * which looks in from the open corner along x + z. Taken along a line of
 * sight through the part of the footprint beside the Blobbi's body
 * (`halfWidth` tiles either side), so a piece off to one side, however near
 * the open corner, never counts as in front of it.
 */
function inFrontOf(r: Rect, b: { x: number; z: number }, halfWidth: number): boolean {
  // Across the view is x - z, along it x + z
  const w = halfWidth * Math.SQRT2;
  const across = b.x - b.z;
  const lo = Math.max(r.x0 - r.z1, across - w);
  const hi = Math.min(r.x1 - r.z0, across + w);
  if (lo > hi) return false;
  const s = (lo + hi) / 2;
  // Where the line of sight x - z = s crosses the footprint, and the middle of that, along the view
  const xa = Math.max(r.x0, r.z0 + s);
  const xb = Math.min(r.x1, r.z1 + s);
  // The Blobbi has depth too: a piece level with it (a nightstand beside the
  // bed it's sitting on) isn't in front, nor flickers in and out of it
  return xa + xb - s > b.x + b.z + BODY_DEPTH;
}

/**
 * Whether floor footprint `q` stands nearer the open corner than `p`: wholly
 * past it along x or z (and not wholly behind it along the other), or else,
 * when that doesn't settle it, by their middles.
 */
function nearerThan(q: Rect, p: Rect): boolean {
  const ahead = q.x0 >= p.x1 - 1e-6 || q.z0 >= p.z1 - 1e-6;
  const behind = q.x1 <= p.x0 + 1e-6 || q.z1 <= p.z0 + 1e-6;
  if (ahead !== behind) return ahead;
  return midX(q) + midZ(q) > midX(p) + midZ(p);
}

/**
 * How an item meets the room, given its model's size: a flat network object
 * (a mat, a poster lying down) is a rug, so furniture can stand on it and
 * the Blobbi walk over it, rather than a block that collides with everything.
 */
function mountFor(item: Pick<SceneItem, 'mount' | 'official'>, raw: THREE.Vector3): FurnitureMount {
  if (item.official || item.mount !== 'floor') return item.mount;
  return raw.y <= FLAT_RATIO * Math.max(raw.x, raw.z) ? 'rug' : 'floor';
}

// ─── Scene ────────────────────────────────────────────────────────────────────

interface Built {
  item: SceneItem;
  /** Positioned and rotated in the room; scale animates for the pop-up. */
  root: THREE.Group;
  /** Normalizes the model: offset to its anchor point, scaled to tiles. */
  holder: THREE.Group;
  /** The model's size in its own units, and its offset to the anchor point. */
  raw: THREE.Vector3;
  offset: THREE.Vector3;
  /** Size in tiles before rotation, at the placement's scale. */
  size: THREE.Vector3;
  /** Floor footprint (floor and rugs) or wall rect (x = along, z = height), resolved each layout. */
  rect: Rect;
  /** Height the item stands at (on top of a table, for small items). */
  elev: number;
  stackedOn?: number;
  /** World-space box at rest. */
  box: THREE.Box3;
  /** Drawn in front of the Blobbi this frame. */
  front: boolean;
  clock?: { hour: THREE.Object3D; minute: THREE.Object3D } | { texture: THREE.CanvasTexture; canvas: HTMLCanvasElement; ink: string; paper: string };
  /**
   * Lamp position in the model's own units, in the room (set by `layoutItems`),
   * and its strength. Tapping switches it; `level` fades toward `on`.
   */
  lamp?: { at: THREE.Vector3; world: THREE.Vector3; color: THREE.Color; intensity: number; on: boolean; level: number };
  /** Self-lit bulbs, each with a halo of its colour on the wall behind it, dimmed with the lamp's level. */
  bulbs?: { mesh: THREE.Mesh; halo: THREE.Mesh; color: THREE.Color }[];
  /** A lampshade's lit-from-inside glow, faded with the lamp's level. */
  shade?: THREE.Mesh;
  popStart?: number;
  pokeStart?: number;
  /** Under the pointer (0..1, eased): it lifts a little, and if it does something a soft ring shows under it. */
  hover?: number;
  /** Pressed: it gives a little under the finger until released. */
  pressed?: boolean;
}

interface Actor {
  id: string;
  x: number;
  z: number;
  elev: number;
  hop: number;
  visible: boolean;
  isEgg: boolean;
  /** Art box size in tiles. */
  tiles: number;
  /** Walking speed, tiles per second: the pace of its gait (room-pace.ts). */
  speed: number;
  path: { x: number; z: number }[];
  walked: number;
  /** Which way it faces: where it is heading while walking, front at rest (`room-facing.ts`). */
  facing: BlobbiFacing;
  /** The same, continuously: yaw about +y in the room (0 faces +z), toward the camera at rest. */
  heading: number;
  /** How far its body reaches from where it stands (tiles): it keeps that clear of the walls and the floor's edge. */
  reach: BlobbiReach;
  /** A 3D model standing in for the DOM drawing, driven each frame (`blobbi3d/actor.ts`). */
  model: ActorModel | null;
  /** The model has been on a drawn frame (its shaders compiled): the DOM drawing may step aside. */
  modelDrawn: boolean;
  /** A choreographed place (a room transition's), over its walk and its bounds, while set. */
  script?: ActorScript | null;
  /** The face it wears in 3D (the kit's procedural face for an expression), or null for the neutral face. */
  face?: ProceduralFace | null;
  /** A choreographed pose of its 3D body (a crouch, a landing, a lean): see `ActorFrame.pose`. */
  pose?: ActorFrame['pose'];
  /** Whether its model's meshes cast their shadows now (a reduced-motion fade turns them off as it crosses half). */
  modelShadow?: boolean;
  /** Where its 3D eyes look, the kit's offset (-1..1 each way), when the app says (a glance, the pointer); null to rest. */
  gaze: { x: number; y: number } | null;
  /** A journey under way (teleporting), from its presence controller. */
  journey: { kind: JourneyKind; startedAt: number; reduced: boolean } | null;
  /** A scrubbed moment of a journey to show instead (development). */
  journeyPreview: { kind: JourneyKind; t: number; reduced: boolean } | null;
  /** The journey it turned back from, whose motes finish their way for a moment (`moteLayers`). */
  journeyBefore?: { kind: JourneyKind; startedAt: number; endedAt: number } | null;
  /** The top of the view above where it stands, as a world height (measured when a journey starts). */
  skyY?: number;
  caster: THREE.Mesh;
  contact: THREE.Mesh;
  /** Has said hello to the user's Blobbi since it last walked over. */
  met: boolean;
}

/** A prop (`room-props.ts`) as the scene has built it. */
interface BuiltProp {
  prop: RoomProp;
  root: THREE.Group;
  /** When it was set down, for the drop-in; when it began leaving, for the fade. */
  enteredAt: number;
  leavingAt?: number;
  /** Drawn over the page's Blobbi this frame (nearer the camera than it). */
  front: boolean;
  /**
   * A dish: the food. A modelled food (`food-models.ts`) is eaten by clipping planes, one per bite, kept from the
   * start and moved into place as the bites are taken (no shader recompiles), with crumbs on the plate; any other
   * food is its picture on a plane standing on the plate, bitten in the picture.
   */
  dish?: {
    food: THREE.Object3D;
    model: FoodModel | null;
    planes: THREE.Plane[];
    crumbs: THREE.Mesh[];
    texture?: THREE.CanvasTexture;
    whole: HTMLCanvasElement | null;
    glyph: string;
    bites: number;
    image?: 'loading' | 'done';
    /** When the last bite was taken, for the little jolt. */
    biteAt?: number;
  };
  /** A ball: its motion, the mesh that rolls, and the soft shadow under it. */
  ball?: { state: BallState; mesh: THREE.Mesh; contact: THREE.Mesh; resting: boolean };
}

/** The size of a dish and its food, tiles. */
const DISH_RADIUS = 0.62;
const DISH_HEIGHT = 0.07;
const FOOD_SIZE = 1.3;

interface Fit {
  distance: number;
  /** Vertical center of the frame the room is fitted in, CSS px. */
  sy: number;
  /** Room bounds center in view-space tan units. */
  cx: number;
  cy: number;
  /** Tan units per CSS px. */
  k: number;
}

interface Drag {
  index: number;
  /** Item center minus the grab point, on the floor or the item's wall. */
  offset: { a: number; b: number };
  placement: FurniturePlacement;
  /** Where it was picked up from. */
  origin: FurniturePlacement;
}

export class RoomScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera();
  /** The user's zoom over the framing (1 = recommended), and what is shown now (eased toward it). */
  private zoom = 1;
  private zoomShown = 1;
  private raycaster = new THREE.Raycaster();
  private hemi = new THREE.HemisphereLight('#ffffff', '#eadfcd', 2.1);
  private key = new THREE.DirectionalLight('#fff4e2', 1.5);
  private room = new THREE.Group();
  private furniture = new THREE.Group();
  private overlay = new THREE.Group();
  private furnitureMaterial: THREE.MeshStandardMaterial;
  private bump: THREE.CanvasTexture | null;

  private fgCanvas: HTMLCanvasElement;
  private fgContext: CanvasRenderingContext2D | null;

  private geometry?: SceneGeometry;
  private layout?: RoomLayout;
  private built = new Map<string, Built>();
  private byIndex = new Map<number, Built>();
  private invalid = new Set<number>();
  private sleeping = 0;
  private sleepTarget = 0;
  private parallax = { x: 0, y: 0 };
  private parallaxTarget = { x: 0, y: 0 };
  private fits?: { rest: Fit; edit: Fit };
  private editT = 0;
  private editing = false;
  private selected: number | null = null;
  private drag: Drag | null = null;
  private frame = 0;
  private lastFrame = 0;
  private clockTimer: ReturnType<typeof setInterval> | undefined;
  private wanderTimer: ReturnType<typeof setTimeout> | undefined;
  /** Whether the scene sends the user's Blobbi ambling on its own (Ditto's way); an app that drives its life itself turns it off. */
  private mainWanders = true;
  private disposed = false;
  private motionQuery = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
  private reducedMotion = this.motionQuery?.matches ?? false;
  private onMotionChange = (e: MediaQueryListEvent) => {
    this.reducedMotion = e.matches;
    if (e.matches) {
      this.parallax = { x: 0, y: 0 };
      this.parallaxTarget = { x: 0, y: 0 };
    }
    this.requestRender();
  };
  private textureLoader = new THREE.TextureLoader();
  private lamps: THREE.PointLight[] = [];
  private templates = new Map<SnoNode, THREE.Object3D>();
  private surfaces = new Map<string, THREE.MeshStandardMaterial>();
  /** Room trim materials, recolored per room rather than recreated. */
  private trimMaterial = shared(new THREE.MeshStandardMaterial({ roughness: 0.85 }));
  private shellMaterial = shared(new THREE.MeshStandardMaterial({ roughness: 0.9 }));
  private edgeMaterial = shared(new THREE.MeshStandardMaterial({ roughness: 0.8 }));
  private handMaterials = new Map<string, THREE.MeshStandardMaterial>();
  private pools: Record<'screen' | 'picture', THREE.Material[]> = { screen: [], picture: [] };
  private releaseMaterial = (material: THREE.Material) => {
    material.userData.load = undefined;
    this.pools[material.userData.pool as 'screen' | 'picture'].push(material);
  };
  private needsCompile = true;
  private compiling = false;
  private shadowsDirty = true;
  private introStart: number | null = null;
  /** The fold-in hasn't been drawn yet; it waits for the next shader compile. */
  private introPending = false;
  private introTiming: { floor: readonly [number, number]; left: readonly [number, number]; right: readonly [number, number]; furniture: number; stagger: number; pop: number } = INTRO;
  /** The back walls drawn over the 2D Blobbi too (it is behind one: a transition's). */
  /** The back wall the 2D Blobbi is behind now (a transition's scene), or null. */
  private wallsCover: 'left' | 'right' | null = null;
  /** The piece under the pointer (never while decorating), and the ring that marks one that does something. */
  private hovered: number | null = null;
  private hoverRing?: THREE.Mesh;
  /** How much it spends drawing (`room-quality.ts`): the device's level, high until told otherwise. */
  private quality: QualitySettings = QUALITY.high;
  /** Watches real frame intervals for sustained slowness; `onSlow` hears when quality should go down. */
  private monitor = createQualityMonitor(typeof performance !== 'undefined' ? performance.now() : 0);
  onSlow?: () => void;
  /** Only idle life (a 3D model breathing, blinking) wants another frame: drawn at `IDLE_FRAME_MS`, not every vsync. */
  private idleAnimating = false;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  /** Development measurements (`stats()`): frames drawn, idle ones among them, and each frame's main-thread cost. */
  private perf = { frames: 0, idleFrames: 0, cpuMs: 0, cpuSamples: [] as number[] };
  private lastFrameAt = 0;
  private onVisibility = () => {
    if (document.hidden) {
      // A build under way is not being watched: it is played again from the start when the page is back
      if (this.introStart !== null && this.introMode === 'build' && this.introHeld === null) this.introInterrupted = true;
      return;
    }
    if (this.introInterrupted) {
      // The build plays again whole: the fold from its start, every piece popping up after it
      this.introInterrupted = false;
      const now = performance.now();
      this.introStart = now;
      let order = 0;
      for (const built of this.built.values()) built.popStart = now + this.introTiming.furniture + order++ * this.introTiming.stagger;
      this.shadowsDirty = true;
    }
    this.requestRender();
  };
  /** The fold-in held at this many ms (a development scrubber), or null to let it run. */
  private introHeld: number | null = null;
  private folds?: { floor: THREE.Group; left: THREE.Group; right: THREE.Group };

  // Editing overlays
  private grid: THREE.LineSegments;
  private quad = shared(new THREE.PlaneGeometry(1, 1));
  private okMaterial = shared(new THREE.MeshBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.38, depthWrite: false }));
  private badMaterial = shared(new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.42, depthWrite: false }));

  // Blobbis: the user's (MAIN) and any visiting friends
  private actors = new Map<string, Actor>();
  /** The walk request in progress per Blobbi, settled with how it ended. */
  private pendingWalks = new Map<string, (outcome: WalkOutcome) => void>();
  private contactTexture = shared(contactShadowTexture());
  private halo = shared(haloTexture());
  private casterGeometry = shared(new THREE.SphereGeometry(0.5, 16, 12));
  private casterMaterial = shared(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));

  // Props: a dish of food, a ball (`room-props.ts`); the ball's motion is the scene's (`ball-physics.ts`)
  private props = new Map<string, BuiltProp>();
  /** The bath under way (M15): the hollow tub standing in for a tub item, the water, the foam, the tools. */
  private bath: { layer: BathLayer; built: Built | null; frame: BathFrame } | null = null;
  private propGroup = new THREE.Group();
  private ballSkin?: THREE.CanvasTexture | null;
  private ballGeometry = shared(new THREE.SphereGeometry(BALL.radius, 24, 18));
  private dishGeometry = shared(new THREE.CylinderGeometry(DISH_RADIUS, DISH_RADIUS * 0.86, DISH_HEIGHT, 28));
  private dishMaterial = shared(new THREE.MeshStandardMaterial({ color: '#f7f2ea', roughness: 0.6 }));
  private dishRimMaterial = shared(new THREE.MeshStandardMaterial({ color: '#d9ccb8', roughness: 0.7 }));
  /** Called when a rolling ball comes to rest. */
  onPropRest?: (id: string) => void;
  /** Called when the room's full fold-in (a first visit's build) has played to its end in front of the player. */
  onIntroDone?: () => void;
  /** How the room on screen came in; what `onIntroDone` reports on. */
  private introMode: RoomIntro = 'none';
  /** The fold-in was under way when the page was hidden: it plays again from the start when the page is back. */
  private introInterrupted = false;

  /** Called when a visiting Blobbi walks up to the user's Blobbi. */
  onMeet?: (id: string) => void;

  /** Called after every rendered frame, so DOM anchors can follow the room. */
  onFrame?: () => void;
  /** Called when the set of overlapping (blocked) items changes while editing. */
  onInvalidChange?: (invalid: Set<number>) => void;

  constructor(canvas: HTMLCanvasElement, fgCanvas: HTMLCanvasElement) {
    // Back from a hidden tab: the idle life resumes (it stops while hidden)
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibility);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    // A teleporting Blobbi's model is cut by a plane (teleport3d.ts); nothing else uses clipping, which costs nothing unset
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.enabled = true;
    // PCF: three 0.186 removed PCFSoftShadowMap (it fell back to PCF with a warning)
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Shadows re-render only when something that casts them moves
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    this.textureLoader.setCrossOrigin('anonymous');

    this.fgCanvas = fgCanvas;
    this.fgContext = fgCanvas.getContext('2d');

    // No crumple map where the browser gives the canvas no context: the furniture is smooth, the room stands
    const bump = paperBump();
    this.bump = bump ? shared(new THREE.CanvasTexture(bump)) : null;
    if (this.bump) this.bump.wrapS = this.bump.wrapT = THREE.RepeatWrapping;

    this.furnitureMaterial = shared(new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.62,
      metalness: 0,
      side: THREE.DoubleSide,
      bumpMap: this.bump ?? undefined,
      bumpScale: 0.25,
    }));

    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.bias = -0.0012;
    this.key.shadow.normalBias = 0.05;
    for (const light of [this.hemi, this.key]) light.layers.enableAll();
    this.key.shadow.camera.layers.enableAll();
    this.scene.add(this.hemi, this.key, this.key.target, this.room, this.furniture, this.overlay, this.propGroup);
    for (let i = 0; i < LAMP_POOL; i++) {
      const lamp = new THREE.PointLight('#ffd9a0', 0, G * 0.9, 1.6);
      lamp.layers.enableAll();
      this.lamps.push(lamp);
      this.scene.add(lamp);
    }

    // Floor grid, shown while decorating
    const lines: number[] = [];
    for (let i = 0; i <= G; i++) {
      lines.push(i, 0, 0, i, 0, G, 0, 0, i, G, 0, i);
    }
    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    this.grid = new THREE.LineSegments(gridGeometry, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }));
    this.grid.position.y = 0.015;
    this.grid.visible = false;
    this.grid.renderOrder = 1;
    this.scene.add(this.grid);

    this.addActor(MAIN, false);
    this.scheduleWander();
    this.motionQuery?.addEventListener('change', this.onMotionChange);
  }

  // ─── Inputs ────────────────────────────────────────────────────────────────

  setGeometry(geometry: SceneGeometry) {
    this.geometry = geometry;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR, this.quality.maxPixelRatio);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(geometry.width, geometry.height, false);
    this.fgCanvas.width = Math.round(geometry.width * dpr);
    this.fgCanvas.height = Math.round(geometry.height * dpr);
    this.fits = {
      rest: this.computeFit(ELEVATION, SIDE_OVERFLOW.rest, geometry.behindTop ?? 0),
      edit: this.computeFit(EDIT_ELEVATION, SIDE_OVERFLOW.edit, 0),
    };
    // A new shape (the phone turned) keeps the user's zoom where it is still allowed
    this.zoom = this.clampZoom(this.zoom);
    this.zoomShown = this.clampZoom(this.zoomShown);
    this.updateCamera();
    this.requestRender();
  }

  /** The nearest the user may go here: the camera stays outside the room, whatever the stage. */
  private maxZoom(): number {
    return this.fits ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.fits.rest.distance / (G * ZOOM_KEEP_OUT))) : ZOOM_MAX;
  }

  private clampZoom(value: number): number {
    return Math.min(this.maxZoom(), Math.max(ZOOM_MIN, Number.isFinite(value) ? value : 1));
  }

  /** The user's zoom and its limits for this stage. */
  zoomLimits(): { min: number; max: number; value: number } {
    return { min: ZOOM_MIN, max: this.maxZoom(), value: this.zoom };
  }

  /**
   * Look nearer or farther: a factor over the framing, 1 for the recommended
   * view. Eased in, unless `immediate` (a pinch follows the fingers). Held
   * within this stage's limits; the room is always framed around its centre.
   */
  setZoom(value: number, immediate = false) {
    const next = this.clampZoom(value);
    if (next === this.zoom && (!immediate || this.zoomShown === next)) return;
    this.zoom = next;
    if (immediate || this.reducedMotion) this.zoomShown = next;
    this.updateCamera();
    this.requestRender();
  }

  setLayout(layout: RoomLayout) {
    if (this.layout === layout) return;
    this.layout = layout;
    this.buildRoom();
    this.shadowsDirty = true;
    this.requestRender();
  }

  /**
   * Replace the furniture. Items whose key and model are unchanged keep their
   * meshes and just move. `intro` says how the room comes on screen (its
   * full fold-in, a quick one, or none); `spawn` where the user's Blobbi
   * stands in it (its nearest free spot to that point; on the bed asleep),
   * or null to leave it where it is.
   */
  setItems(items: SceneItem[], intro: RoomIntro | boolean = 'none', spawn: { x: number; z: number } | null = null) {
    // The furniture may be other furniture now: a bath standing on a tub ends with it (the page ends it first)
    if (this.bath) this.setBath(null);
    const mode: RoomIntro = intro === true ? 'build' : intro === false ? 'none' : intro;
    // The pieces may be others now: nothing is hovered until the pointer says so again
    if (mode !== 'none') this.hovered = null;
    const timing = mode === 'quick' ? QUICK_INTRO : INTRO;
    const next = new Map(items.map((item) => [item.key, item]));
    for (const [key, built] of this.built) {
      const item = next.get(key);
      if (!item || item.node !== built.item.node || item.placement.content?.imageUrl !== built.item.placement.content?.imageUrl) {
        this.furniture.remove(built.root);
        disposeObject(built.root, this.releaseMaterial);
        this.built.delete(key);
      }
    }
    // A newly shown room folds together first, then its furniture pops up
    const animating = mode !== 'none' && !this.reducedMotion;
    this.introMode = animating ? mode : 'none';
    this.introInterrupted = false;
    if (animating) {
      this.introStart = performance.now();
      this.introPending = true;
      this.introTiming = timing;
      // Set up while the page is hidden (a room change the player did not see end): the fold-in waits to be watched
      if (typeof document !== 'undefined' && document.hidden && mode === 'build') this.introInterrupted = true;
    }
    let order = 0;
    for (const item of items) {
      const existing = this.built.get(item.key);
      if (existing) {
        // The item being dragged stays where the pointer has it
        const placement = this.drag?.index === item.index ? { ...this.drag.placement } : item.placement;
        existing.item = { ...item, placement, mount: mountFor(item, existing.raw) };
        this.rescale(existing);
        // Pieces the next room shares pop up with the rest
        if (animating) existing.popStart = this.introStart! + timing.furniture + order++ * timing.stagger;
        continue;
      }
      const built = this.buildItem(item);
      this.needsCompile = true;
      if (animating) built.popStart = this.introStart! + timing.furniture + order++ * timing.stagger;
      this.built.set(item.key, built);
    }
    this.byIndex = new Map([...this.built.values()].map((b) => [b.item.index, b]));
    this.evictTemplates();
    this.layoutItems();
    if (spawn || (intro === true)) this.spawnBlobbi(spawn ?? undefined);
    this.syncClockTimer();
    this.requestRender();
  }

  setBlobbi(blobbi: { visible: boolean; isEgg: boolean; tiles: number; sleeping: boolean; walkSpeed?: number; reach?: BlobbiReach }) {
    const main = this.actors.get(MAIN)!;
    const sleepChanged = (this.sleepTarget === 1) !== blobbi.sleeping;
    if (main.visible && !blobbi.visible) {
      main.path = [];
      this.settleWalk(MAIN, 'stopped');
    }
    main.visible = blobbi.visible;
    main.isEgg = blobbi.isEgg;
    main.tiles = blobbi.tiles;
    main.speed = blobbi.walkSpeed ?? DEFAULT_WALK_SPEED;
    const reachChanged = !sameReach(main.reach, blobbi.reach ?? defaultReach(blobbi.tiles));
    main.reach = blobbi.reach ?? defaultReach(blobbi.tiles);
    // A bigger body (a stage reached) steps clear of a wall it now reaches into
    if (reachChanged && !main.path.length) this.keepClear(main);
    this.sleepTarget = blobbi.sleeping ? 1 : 0;
    if (this.reducedMotion) this.sleeping = this.sleepTarget;
    if (sleepChanged) this.spawnBlobbi();
    this.shadowsDirty = true;
    this.requestRender();
  }

  /**
   * Visiting Blobbis. New ones appear at `spawn` (or beside the user's
   * Blobbi); ones no longer listed leave.
   */
  setGuests(guests: { id: string; isEgg: boolean; tiles: number; spawn?: { x: number; z: number }; walkSpeed?: number; reach?: BlobbiReach }[]) {
    const ids = new Set(guests.map((g) => g.id));
    for (const id of [...this.actors.keys()]) {
      if (id !== MAIN && !ids.has(id)) this.removeActor(id);
    }
    for (const g of guests) {
      let actor = this.actors.get(g.id);
      if (!actor) {
        actor = this.addActor(g.id, g.isEgg);
        actor.tiles = g.tiles;
        actor.reach = g.reach ?? defaultReach(g.tiles);
        const main = this.actors.get(MAIN)!;
        this.standNear(actor, g.spawn?.x ?? main.x + 1, g.spawn?.z ?? main.z + 1);
        actor.hop = 0.6;
      }
      actor.isEgg = g.isEgg;
      actor.tiles = g.tiles;
      actor.reach = g.reach ?? defaultReach(g.tiles);
      actor.speed = g.walkSpeed ?? DEFAULT_WALK_SPEED;
    }
    this.shadowsDirty = true;
    this.requestRender();
  }

  /** Pointer position over the room, -1..1 on each axis; 0,0 to rest. */
  setParallax(x: number, y: number) {
    if (this.reducedMotion || this.editing) return;
    this.parallaxTarget = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    this.requestRender();
  }

  setEditing(editing: boolean, selected: number | null) {
    if (editing !== this.editing) {
      this.editing = editing;
      this.parallaxTarget = { x: 0, y: 0 };
      for (const a of this.actors.values()) {
        a.path = [];
        this.settleWalk(a.id, 'stopped');
      }
      if (this.reducedMotion) this.editT = editing ? 1 : 0;
    }
    this.selected = editing ? selected : null;
    this.layoutItems();
    this.requestRender();
  }

  dispose() {
    this.disposed = true;
    // Walks end without arriving
    for (const id of [...this.pendingWalks.keys()]) this.settleWalk(id, 'stopped');
    this.motionQuery?.removeEventListener('change', this.onMotionChange);
    cancelAnimationFrame(this.frame);
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.wanderTimer) clearTimeout(this.wanderTimer);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility);
    // The models are the caller's: out of the scene before it is torn down
    for (const actor of this.actors.values()) if (actor.model) this.scene.remove(actor.model.object);
    for (const id of [...this.props.keys()]) this.removeProp(id);
    this.setBath(null);
    disposeObject(this.scene);
    for (const value of [
      this.trimMaterial, this.shellMaterial, this.edgeMaterial, this.okMaterial, this.badMaterial, this.quad,
      ...this.handMaterials.values(), ...this.pools.screen, ...this.pools.picture, this.furnitureMaterial,
      this.contactTexture, this.halo, this.casterGeometry, this.casterMaterial,
      this.ballGeometry, this.dishGeometry, this.dishMaterial, this.dishRimMaterial,
    ]) value.dispose();
    this.ballSkin?.dispose();
    this.bump?.dispose();
    for (const material of this.surfaces.values()) disposeSurface(material);
    for (const template of this.templates.values()) this.disposeTemplate(template);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  // ─── Camera ────────────────────────────────────────────────────────────────

  private viewDir(az: number, el: number): THREE.Vector3 {
    return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  }

  private get target(): THREE.Vector3 {
    return new THREE.Vector3(G / 2, H * 0.3, G / 2);
  }

  /** Points on the room's outline: the floor slab and the tops of the walls. */
  private silhouette(): THREE.Vector3[] {
    const t = THICK;
    const pts: THREE.Vector3[] = [];
    for (const x of [-t, G]) for (const z of [-t, G]) for (const y of [-BASE, 0]) pts.push(new THREE.Vector3(x, y, z));
    pts.push(new THREE.Vector3(-t, H, -t), new THREE.Vector3(-t, H, G), new THREE.Vector3(G, H, -t));
    return pts;
  }

  /**
   * Frame the room in the stage rect: the nearest camera distance at which
   * the room fits (allowing a little sideways overflow), and the projection
   * offset that centers it there.
   */
  /** The room's silhouette as seen from `distance` along `dir`, in the camera's tangent units: its extent and middle. */
  private silhouetteBounds(dir: THREE.Vector3, distance: number): { x0: number; x1: number; y0: number; y1: number } {
    const pts = this.silhouette();
    const cam = this.target.add(dir.clone().multiplyScalar(distance));
    const f = dir.clone().negate();
    const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
    const u = new THREE.Vector3().crossVectors(r, f);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) {
      const v = p.clone().sub(cam);
      const z = v.dot(f);
      const tx = v.dot(r) / z;
      const ty = v.dot(u) / z;
      x0 = Math.min(x0, tx); x1 = Math.max(x1, tx);
      y0 = Math.min(y0, ty); y1 = Math.max(y1, ty);
    }
    return { x0, x1, y0, y1 };
  }

  private computeFit(el: number, mostOverflow: number, behindTop: number): Fit {
    const g = this.geometry!;
    const k = (2 * Math.tan(FOV / 2)) / Math.max(g.height, 1);
    const frameHeight = g.stage.height + behindTop;
    const overflow = sideOverflow(g.stage.width, frameHeight, mostOverflow);
    const availW = g.stage.width * overflow * k;
    const availH = frameHeight * 0.94 * k;
    const dir = this.viewDir(AZIMUTH, el);
    const bounds = (d: number) => this.silhouetteBounds(dir, d);
    let lo = G * 0.8;
    let hi = G * 40;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      const b = bounds(mid);
      if (b.x1 - b.x0 <= availW && b.y1 - b.y0 <= availH) hi = mid;
      else lo = mid;
    }
    const b = bounds(hi);
    return { distance: hi, sy: g.stage.top - behindTop + frameHeight / 2, cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, k };
  }

  private updateCamera() {
    if (!this.geometry || !this.fits) return;
    const g = this.geometry;
    const e = easeInOut(this.editT);
    const lerp = (a: number, b: number) => a + (b - a) * e;
    const { rest, edit } = this.fits;
    // The user's zoom brings the camera nearer along its line of sight; the room stays framed around its centre
    const zoom = this.zoomShown;
    const distance = lerp(rest.distance, edit.distance) / zoom;
    let cx = lerp(rest.cx, edit.cx);
    let cy = lerp(rest.cy, edit.cy);
    if (zoom !== 1) {
      const b = this.silhouetteBounds(this.viewDir(AZIMUTH, lerp(ELEVATION, EDIT_ELEVATION)), distance);
      cx = (b.x0 + b.x1) / 2;
      cy = (b.y0 + b.y1) / 2;
    }
    const k = rest.k;
    const el = lerp(ELEVATION, EDIT_ELEVATION) + this.parallax.y * PARALLAX.el;
    const az = AZIMUTH - this.parallax.x * PARALLAX.az;
    const target = this.target;
    this.camera.position.copy(target).add(this.viewDir(az, el).multiplyScalar(distance));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld(true);
    // Near plane as far out as the room allows: depth precision is what keeps
    // walls, rugs and wall pieces from flickering into each other
    const near = Math.max(0.5, distance - G * 1.6);
    const far = distance * 4;
    const sx = g.stage.left + g.stage.width / 2;
    const sy = lerp(rest.sy, edit.sy);
    this.camera.near = near;
    this.camera.far = far;
    this.camera.projectionMatrix.makePerspective(
      (cx - sx * k) * near,
      (cx + (g.width - sx) * k) * near,
      (cy + sy * k) * near,
      (cy - (g.height - sy) * k) * near,
      near,
      far,
    );
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  }

  // ─── Projection (for DOM anchors) ──────────────────────────────────────────

  private toScreen(p: THREE.Vector3): { x: number; y: number } {
    const g = this.geometry!;
    const v = p.clone().project(this.camera);
    return { x: ((v.x + 1) / 2) * g.width, y: ((1 - v.y) / 2) * g.height };
  }

  /** A room point on screen, with the room's scale there. */
  private projectPoint(x: number, y: number, z: number): ScreenAnchor | null {
    if (!this.geometry) return null;
    const base = this.toScreen(new THREE.Vector3(x, y, z));
    const up = this.toScreen(new THREE.Vector3(x, y + 1, z));
    return { x: base.x, y: base.y, pxPerTile: Math.hypot(up.x - base.x, up.y - base.y) };
  }

  projectFloor(x: number, z: number): ScreenAnchor | null {
    return this.projectPoint(x, 0, z);
  }

  /** Which way a Blobbi faces (the user's by default): where it is walking to, or front at rest. */
  facingOf(id = MAIN): BlobbiFacing {
    return this.actors.get(id)?.facing ?? 'front';
  }

  /** A Blobbi's feet on screen (the user's by default). */
  projectBlobbi(id = MAIN): ScreenAnchor | null {
    const b = this.actors.get(id);
    if (!b) return null;
    return this.projectPoint(b.x, b.elev + b.hop, b.z);
  }

  /** The floor point under a canvas point, or null off the floor. */
  floorAt(sx: number, sy: number): { x: number; z: number } | null {
    if (!this.geometry) return null;
    const p = this.hitFloor(this.ray(sx, sy));
    return p ? { x: p.x, z: p.z } : null;
  }

  /** Top center of an item, for a floating toolbar. */
  projectItemTop(index: number): ScreenAnchor | null {
    const built = this.byIndex.get(index);
    if (!built) return null;
    const c = built.box.getCenter(new THREE.Vector3());
    return this.projectPoint(c.x, built.box.max.y, c.z);
  }

  // ─── Picking ───────────────────────────────────────────────────────────────

  private ray(sx: number, sy: number): THREE.Ray {
    const g = this.geometry!;
    this.raycaster.setFromCamera(new THREE.Vector2((sx / g.width) * 2 - 1, 1 - (sy / g.height) * 2), this.camera);
    return this.raycaster.ray;
  }

  /** The item or floor spot under a canvas point. */
  pick(sx: number, sy: number): PickResult {
    if (!this.geometry) return null;
    // Blobbis stand in front of what they're near: test them first, nearest first
    const actors = [...this.actors.values()].filter((a) => a.visible).sort((a, b) => (b.x + b.z) - (a.x + a.z));
    for (const a of actors) {
      const box = this.actorScreenBox(a, 0.3, 0.8);
      if (box && sx > box.x0 && sx < box.x1 && sy > box.y0 && sy < box.y1) return { kind: 'actor', id: a.id };
    }
    const ray = this.ray(sx, sy);
    // A prop (a ball, a dish) is small: a finger's worth round it counts, nearest the camera first
    const props = [...this.props.values()].filter((p) => !p.prop.leaving).sort((a, b) => this.propAt(b).x + this.propAt(b).z - (this.propAt(a).x + this.propAt(a).z));
    for (const p of props) {
      const at = this.propAt(p);
      const r = p.prop.kind === 'ball' ? BALL.radius * 1.9 : DISH_RADIUS * 1.15;
      if (ray.intersectsSphere(new THREE.Sphere(new THREE.Vector3(at.x, at.elev + r * 0.6, at.z), r))) return { kind: 'prop', id: p.prop.id };
    }
    let best: { index: number; d: number; flat: boolean } | null = null;
    const hit = new THREE.Vector3();
    for (const built of this.built.values()) {
      if (!ray.intersectBox(built.box, hit)) continue;
      const d = hit.distanceTo(ray.origin);
      const flat = built.item.mount === 'rug';
      // Anything standing beats a rug under it
      if (!best || (best.flat && !flat) || (best.flat === flat && d < best.d)) best = { index: built.item.index, d, flat };
    }
    if (best) return { kind: 'item', index: best.index };
    const floor = this.hitFloor(ray);
    return floor ? { kind: 'floor', x: floor.x, z: floor.z } : null;
  }

  /**
   * Whether a canvas point is over a Blobbi or just above its head, where its
   * name shows: a little taller than the tap target (`pick`), so moving from
   * the body to the name never counts as leaving it.
   */
  overActor(sx: number, sy: number, id = MAIN): boolean {
    const actor = this.actors.get(id);
    if (!actor?.visible) return false;
    const box = this.actorScreenBox(actor, 0.3, 1.1);
    return !!box && sx > box.x0 && sx < box.x1 && sy > box.y0 && sy < box.y1;
  }

  /** A Blobbi's body on screen: `halfWidth` and `height` are fractions of its art box. */
  private actorScreenBox(a: Actor, halfWidth: number, height: number) {
    const anchor = this.projectBlobbi(a.id);
    if (!anchor) return null;
    const unit = anchor.pxPerTile * a.tiles;
    return { x0: anchor.x - unit * halfWidth, x1: anchor.x + unit * halfWidth, y0: anchor.y - unit * height, y1: anchor.y };
  }

  private hitFloor(ray: THREE.Ray, y = 0): THREE.Vector3 | null {
    const p = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), new THREE.Vector3());
    if (!p || p.x < 0 || p.x > G || p.z < 0 || p.z > G) return null;
    return p;
  }

  /** Where a ray meets a back wall: along-wall and height coordinates. */
  private hitWall(ray: THREE.Ray): { wall: 'left' | 'right'; along: number; height: number } | null {
    const onWall = (along: number) => along >= -0.5 && along <= G + 0.5;
    let left = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), new THREE.Vector3());
    let right = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Vector3());
    if (left && !onWall(left.z)) left = null;
    if (right && !onWall(right.x)) right = null;
    // The wall actually in view is the nearer one in front of the floor
    if (left && (!right || left.distanceTo(ray.origin) <= right.distanceTo(ray.origin))) return { wall: 'left', along: left.z, height: left.y };
    return right ? { wall: 'right', along: right.x, height: right.y } : null;
  }

  // ─── Editing ───────────────────────────────────────────────────────────────

  /** Start dragging an item from a canvas point. Returns false if there's nothing to drag. */
  beginDrag(index: number, sx: number, sy: number): boolean {
    const built = this.byIndex.get(index);
    if (!built || !this.geometry) return false;
    const p = built.item.placement;
    const ray = this.ray(sx, sy);
    let offset = { a: 0, b: 0 };
    if (p.at === 'floor') {
      // On the floor plane, as `dragTo` follows it, even for an item up on a
      // table; and past the floor's edge, for a tall item grabbed up high
      const hit = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
      if (hit) offset = { a: midX(built.rect) - hit.x, b: midZ(built.rect) - hit.z };
    } else {
      const hit = this.hitWall(ray);
      if (hit && hit.wall === p.at) offset = { a: midX(built.rect) - hit.along, b: midZ(built.rect) - hit.height };
    }
    this.drag = { index, offset, placement: { ...p }, origin: p };
    return true;
  }

  /** Move the dragged item to follow a canvas point. */
  dragTo(sx: number, sy: number) {
    const drag = this.drag;
    const built = drag && this.byIndex.get(drag.index);
    if (!drag || !built) return;
    const ray = this.ray(sx, sy);
    const p = drag.placement;
    if (p.at === 'floor') {
      // The floor plane carries on past the walls: the pointer over the back
      // row of a counter against a wall meets it behind the wall, and the
      // grab offset brings the item back to where the pointer is
      const hit = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
      if (!hit) return;
      p.x = Math.max(0, Math.min(G, hit.x + drag.offset.a));
      p.y = Math.max(0, Math.min(G, hit.z + drag.offset.b));
    } else {
      const hit = this.hitWall(ray);
      if (!hit) return;
      if (hit.wall !== p.at) drag.offset = { a: 0, b: drag.offset.b };
      p.at = hit.wall;
      p.x = Math.max(0, Math.min(G, hit.along + drag.offset.a));
      p.y = Math.max(0, Math.min(H, hit.height + drag.offset.b));
    }
    built.item = { ...built.item, placement: { ...p } };
    this.layoutItems();
    this.requestRender();
  }

  /**
   * Finish a drag: the snapped placement and whether the spot is free. An
   * item dropped on a blocked spot goes back where it was picked up.
   */
  endDrag(): { index: number; placement: FurniturePlacement; valid: boolean } | null {
    const drag = this.drag;
    this.drag = null;
    const built = drag && this.byIndex.get(drag.index);
    if (!drag || !built) return null;
    const result = {
      index: drag.index,
      placement: { ...built.item.placement, x: midX(built.rect), y: midZ(built.rect) },
      valid: !this.invalid.has(drag.index),
    };
    if (!result.valid) {
      built.item = { ...built.item, placement: drag.origin };
      this.layoutItems();
      this.requestRender();
    }
    return result;
  }

  /** Abandon a drag (the system took the pointer away): the piece goes back where it was picked up. */
  cancelDrag() {
    const drag = this.drag;
    this.drag = null;
    const built = drag && this.byIndex.get(drag.index);
    if (!drag || !built) return;
    built.item = { ...built.item, placement: drag.origin };
    this.layoutItems();
    this.requestRender();
  }

  /**
   * A free spot for a new item, nearest the middle of the floor (or of the
   * walls, for wall items). Null when the room has no room left.
   */
  findSpot(query: SpotQuery): Pick<FurniturePlacement, 'at' | 'x' | 'y'> | null {
    const raw = (this.modelTemplate(query.node).userData.box as THREE.Box3).getSize(new THREE.Vector3());
    const size = raw.clone().multiplyScalar(this.scaleFor(raw, query.official, query.scale));
    const mount = mountFor(query, raw);
    const others = [...this.built.values()];
    if (mount === 'wall') {
      for (const height of [3, 2, 4, 1.5]) {
        for (const along of [4, 3, 5, 2, 6, 1, 7]) {
          for (const wall of ['left', 'right'] as const) {
            const rect = wallRect(along, height, size);
            if (!others.some((o) => o.item.placement.at === wall && overlaps(o.rect, rect))) return { at: wall, x: midX(rect), y: midZ(rect) };
          }
        }
      }
      return null;
    }
    const fw = tilesFor(size.x);
    const fd = tilesFor(size.z);
    const spots: { x: number; z: number; d: number }[] = [];
    for (let i = 0; i <= G - fw; i++) {
      for (let j = 0; j <= G - fd; j++) {
        const x = i + fw / 2;
        const z = j + fd / 2;
        spots.push({ x, z, d: Math.hypot(x - G * 0.6, z - G * 0.6) });
      }
    }
    spots.sort((a, b) => a.d - b.d);
    const rug = mount === 'rug';
    for (const s of spots) {
      const rect = rectAt(s.x, s.z, fw, fd);
      const blocked = others.some((o) => o.item.placement.at === 'floor'
        && (o.item.mount === 'rug') === rug && o.stackedOn === undefined && overlaps(o.rect, rect));
      if (!blocked) return { at: 'floor', x: s.x, y: s.z };
    }
    return null;
  }

  // ─── Props: a dish of food, a ball ────────────────────────────────────────

  /**
   * The props in the room (`room-props.ts`), by id: new ones are built and
   * drop in where they were set down, ones no longer listed go, and a dish's
   * bites redraw its food. A ball keeps its own place once it rolls; its
   * `x`/`z` in the prop is only where it was set down.
   */
  setProps(props: readonly RoomProp[]) {
    const now = performance.now();
    const ids = new Set(props.map((p) => p.id));
    for (const id of [...this.props.keys()]) if (!ids.has(id)) this.removeProp(id);
    for (const prop of props) {
      const existing = this.props.get(prop.id);
      if (!existing) {
        this.buildProp(prop, now);
        continue;
      }
      if (existing.prop.kind !== prop.kind) {
        this.removeProp(prop.id);
        this.buildProp(prop, now);
        continue;
      }
      if (prop.leaving && existing.leavingAt === undefined) existing.leavingAt = now;
      if (!prop.leaving) existing.leavingAt = undefined;
      existing.prop = prop;
      if (existing.dish) this.updateDish(existing);
    }
    this.shadowsDirty = true;
    this.requestRender();
  }

  private buildProp(prop: RoomProp, now: number) {
    const root = new THREE.Group();
    root.position.set(prop.x, 0, prop.z);
    const built: BuiltProp = { prop, root, enteredAt: now, front: false };
    if (prop.kind === 'ball') {
      if (this.ballSkin === undefined) {
        const skin = drawBallSkin();
        this.ballSkin = skin ? shared(new THREE.CanvasTexture(skin)) : null;
        if (this.ballSkin) this.ballSkin.colorSpace = THREE.SRGBColorSpace;
      }
      const material = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, ...(this.ballSkin ? { map: this.ballSkin } : { color: '#f0d9c0' }) });
      const mesh = new THREE.Mesh(this.ballGeometry, material);
      mesh.castShadow = true;
      mesh.position.y = BALL.radius;
      const contact = new THREE.Mesh(this.quad, new THREE.MeshBasicMaterial({ map: this.contactTexture, transparent: true, depthWrite: false, opacity: 0.9 }));
      contact.rotation.x = -Math.PI / 2;
      contact.renderOrder = 1;
      contact.position.y = 0.012;
      contact.scale.set(BALL.radius * 2.6, BALL.radius * 2.3, 1);
      root.add(mesh, contact);
      // Set down from a hand's height: it drops and bounces once
      built.ball = { state: ballAt(prop.x, prop.z, this.reducedMotion ? 0 : 0.7), mesh, contact, resting: this.reducedMotion };
    } else {
      const kind = prop.itemId ? foodModelFor(prop.itemId) : null;
      const model = kind ? buildFoodModel(kind) : null;
      const onPlate = model ? model.plate : true;
      if (onPlate) {
        const plate = new THREE.Mesh(this.dishGeometry, this.dishMaterial);
        plate.position.y = DISH_HEIGHT / 2;
        plate.castShadow = true;
        plate.receiveShadow = true;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(DISH_RADIUS * 0.96, DISH_HEIGHT * 0.35, 8, 36), this.dishRimMaterial);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = DISH_HEIGHT;
        root.add(plate, rim);
      }
      // Crumbs, a few, hidden until the bites bring them out
      const crumbs: THREE.Mesh[] = [];
      const crumbMaterial = new THREE.MeshStandardMaterial({ color: model?.crumb ?? new THREE.Color('#e2c79a'), roughness: 0.8 });
      for (let i = 0; i < 6; i++) {
        const crumb = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.02, 7), crumbMaterial);
        crumb.visible = false;
        crumb.position.set(Math.cos(i * 2.1 + 0.4) * DISH_RADIUS * (0.55 + 0.2 * ((i * 7) % 3) / 2), (onPlate ? DISH_HEIGHT : 0) + 0.01, Math.sin(i * 2.1 + 0.4) * DISH_RADIUS * (0.55 + 0.2 * ((i * 5) % 3) / 2));
        crumb.rotation.y = i;
        root.add(crumb);
        crumbs.push(crumb);
      }
      if (model) {
        model.root.position.y = onPlate ? DISH_HEIGHT : 0;
        // One clipping plane per possible bite, out of the way until its bite is taken (a plane count that never
        // changes means no shader recompile mid-meal); a food that shrinks instead has none
        const planes = model.bites.map(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e3));
        for (const material of model.materials) material.clippingPlanes = planes;
        root.add(model.root);
        built.dish = { food: model.root, model, planes, crumbs, whole: null, glyph: '', bites: -1 };
        this.needsCompile = true;
      } else {
        const texture = new THREE.CanvasTexture(document.createElement('canvas'));
        texture.colorSpace = THREE.SRGBColorSpace;
        const food = new THREE.Mesh(new THREE.PlaneGeometry(FOOD_SIZE, FOOD_SIZE), new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.08, depthWrite: true, side: THREE.DoubleSide }));
        // Standing on the plate, facing the camera, leaning back a touch so it reads as sitting on it
        food.position.y = DISH_HEIGHT + FOOD_SIZE * 0.42;
        food.rotation.y = CAMERA_AZIMUTH;
        food.rotateX(-0.22);
        root.add(food);
        built.dish = { food, model: null, planes: [], crumbs, texture, whole: null, glyph: '', bites: -1 };
      }
      this.updateDish(built);
    }
    this.propGroup.add(root);
    this.props.set(prop.id, built);
    this.needsCompile = true;
  }

  /**
   * A dish's food as eaten so far: a modelled food has its bites cut out (the planes moved into place, from the
   * directions the camera sees) or shrinks sip by sip, crumbs coming out on the plate; a pictured food is redrawn
   * with bites out of the picture (a vetted image replaces the emoji when it arrives). Gone with the last bite.
   */
  private updateDish(built: BuiltProp) {
    const dish = built.dish;
    if (!dish) return;
    const taken = built.prop.bites?.taken ?? 0;
    const of = built.prop.bites?.of ?? 4;
    if (dish.model) {
      if (dish.bites === taken) return;
      if (taken > Math.max(0, dish.bites)) dish.biteAt = performance.now();
      dish.bites = taken;
      const model = dish.model;
      const centre = (model.root.userData.centre as THREE.Vector3 | undefined) ?? new THREE.Vector3();
      const world = model.root.getWorldPosition(new THREE.Vector3()).add(centre);
      if (model.bites.length > 0) {
        // Bites are spread over the cuts: fewer bites than cuts take them in order, more than cuts finish early
        const cuts = Math.min(model.bites.length, Math.round((taken / Math.max(1, of)) * model.bites.length));
        model.bites.forEach((cut, i) => {
          const plane = dish.planes[i];
          if (i < cuts) {
            plane.normal.copy(cut.u).negate();
            plane.constant = cut.u.dot(world) + cut.reach - cut.depth;
          } else {
            plane.normal.set(0, 1, 0);
            plane.constant = 1e3;
          }
        });
      } else {
        // A drink: smaller with each sip
        const left = Math.max(0.3, 1 - (taken / Math.max(1, of)) * 0.75);
        model.root.scale.setScalar(model.scale * left);
      }
      dish.crumbs.forEach((crumb, i) => { crumb.visible = i < Math.min(dish.crumbs.length, taken * 2) && taken < of; });
      model.root.visible = taken < of;
      this.shadowsDirty = true;
      return;
    }
    const glyph = built.prop.food ?? {};
    const key = glyphKey(glyph);
    if (dish.glyph !== key || !dish.whole) {
      dish.glyph = key;
      dish.whole = drawFood(glyph);
      dish.bites = -1;
      if (glyph.url && dish.image === undefined) {
        dish.image = 'loading';
        void loadFoodImage(glyph.url).then((img) => {
          if (this.disposed || !this.props.has(built.prop.id) || dish.glyph !== key) return;
          dish.image = 'done';
          if (!img) return;
          dish.whole = drawFood(glyph, img);
          dish.bites = -1;
          this.updateDish(built);
          this.requestRender();
        });
      }
    }
    if (dish.bites === taken) return;
    if (taken > Math.max(0, dish.bites)) dish.biteAt = performance.now();
    dish.bites = taken;
    const picture = dish.whole ? (taken > 0 ? biteFood(dish.whole, taken, of) : dish.whole) : null;
    if (picture && dish.texture) {
      dish.texture.image = picture;
      dish.texture.needsUpdate = true;
      dish.food.visible = taken < of;
    } else {
      // No 2D canvas here: nothing to draw the food with
      dish.food.visible = false;
    }
    dish.crumbs.forEach((crumb, i) => { crumb.visible = i < Math.min(dish.crumbs.length, taken * 2) && taken < of; });
  }

  private removeProp(id: string) {
    const built = this.props.get(id);
    if (!built) return;
    this.propGroup.remove(built.root);
    if (built.dish?.model) {
      built.root.remove(built.dish.model.root);
      disposeFoodModel(built.dish.model);
    }
    // Shared geometries and textures stay; the plane, torus, their materials and the food texture go
    built.root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (!mesh.geometry.userData.shared) mesh.geometry.dispose();
      const materials: THREE.Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (material.userData.shared) continue;
        const map = (material as THREE.MeshBasicMaterial).map;
        if (map && !map.userData.shared) map.dispose();
        material.dispose();
      }
    });
    this.props.delete(id);
    this.shadowsDirty = true;
  }

  /** Where a prop is now (a ball where it has rolled to), tiles, and its height off the floor. */
  private propAt(built: BuiltProp): { x: number; z: number; elev: number } {
    if (built.ball) return { x: built.ball.state.x, z: built.ball.state.z, elev: built.ball.state.elev };
    return { x: built.prop.x, z: built.prop.z, elev: 0 };
  }

  /** Where a prop is (tiles), or null when there is none by that id. */
  propPosition(id: string): { x: number; z: number } | null {
    const built = this.props.get(id);
    if (!built) return null;
    const at = this.propAt(built);
    return { x: at.x, z: at.z };
  }

  /** Whether a prop is still (a ball that has stopped rolling; a dish always). */
  propResting(id: string): boolean {
    const built = this.props.get(id);
    return !built || !built.ball || built.ball.resting;
  }

  /** Kick a ball: off in `dir` at `power` tiles/s with a little hop. False for anything that is not a ball. */
  kickProp(id: string, dir: { x: number; z: number }, power: number): boolean {
    const built = this.props.get(id);
    if (!built?.ball || built.prop.leaving) return false;
    if (this.reducedMotion) {
      // No roll to watch: it is simply over there, a short way off
      const len = Math.hypot(dir.x, dir.z) || 1;
      const to = stepBall({ ...built.ball.state, vx: (dir.x / len) * power, vz: (dir.z / len) * power }, 0.5, (x, z) => this.tileFree(x, z)).state;
      built.ball.state = { ...to, vx: 0, vz: 0, vy: 0, elev: 0 };
      built.ball.resting = true;
      this.placeBall(built);
      this.shadowsDirty = true;
      this.requestRender();
      return true;
    }
    built.ball.state = kickBall(built.ball.state, dir, power);
    built.ball.resting = false;
    this.requestRender();
    return true;
  }

  /** The props' motion this frame: a set-down dropping in, a leaving one shrinking away, a ball rolling. True while any moves. */
  private stepProps(dt: number, now: number): boolean {
    let animating = false;
    for (const built of this.props.values()) {
      const entering = this.reducedMotion ? 1 : Math.min(1, (now - built.enteredAt) / PROP_ENTER_MS);
      let scale = entering < 1 ? easeOutBack(entering) : 1;
      if (entering < 1) animating = true;
      let lift = 0;
      if (built.leavingAt !== undefined) {
        const k = this.reducedMotion ? 1 : Math.min(1, (now - built.leavingAt) / PROP_LEAVE_MS);
        scale *= 1 - easeInOut(k);
        // Picked up: it goes up as it goes
        if (built.prop.lifted) lift = easeOut(k) * 0.9;
        if (k < 1) animating = true;
      }
      built.root.scale.setScalar(Math.max(0.001, scale));
      built.root.visible = scale > 0.01;
      // A bite: the food jolts a little and settles
      const dish = built.dish;
      if (dish?.biteAt !== undefined) {
        const k = (now - dish.biteAt) / 260;
        if (k < 1 && !this.reducedMotion) {
          const j = Math.sin(k * Math.PI) * (1 - k);
          dish.food.rotation.z = j * 0.14;
          dish.food.position.x = j * 0.05;
          animating = true;
        } else {
          dish.food.rotation.z = 0;
          dish.food.position.x = 0;
          dish.biteAt = undefined;
        }
      }
      if (built.ball) {
        void lift;
      } else if (entering < 1) {
        // A dish set down comes from a little above the floor
        built.root.position.y = (1 - entering) * 0.35 + lift;
        this.shadowsDirty = true;
      } else built.root.position.y = lift;
      if (built.ball) {
        const ball = built.ball;
        if (!ball.resting) {
          const step = stepBall(ball.state, dt, (x, z) => this.tileFree(x, z));
          ball.state = step.state;
          if (ballResting(step.state)) {
            ball.resting = true;
            ball.state = { ...step.state, vx: 0, vz: 0, vy: 0, elev: 0 };
            this.onPropRest?.(built.prop.id);
          } else animating = true;
          this.shadowsDirty = true;
        }
        this.placeBall(built, lift);
      }
    }
    return animating;
  }

  /** Put a ball's mesh where its state says, rolled by how far it has gone, its shadow under it. */
  private placeBall(built: BuiltProp, lift = 0) {
    const ball = built.ball;
    if (!ball) return;
    const s = ball.state;
    built.root.position.set(s.x, lift, s.z);
    ball.mesh.position.y = BALL.radius + s.elev;
    // Rolling: turned about the axis across its travel by the distance over its radius
    const speed = Math.hypot(s.vx, s.vz);
    if (speed > 1e-6) {
      const axis = new THREE.Vector3(s.vz / speed, 0, -s.vx / speed);
      const target = new THREE.Quaternion().setFromAxisAngle(axis, s.rolled / BALL.radius);
      ball.mesh.quaternion.copy(target);
    }
    // Off the floor, the shadow stays under it and shrinks
    const hop = Math.min(1, s.elev / 0.8);
    ball.contact.scale.set(BALL.radius * 2.6 * (1 - hop * 0.4), BALL.radius * 2.3 * (1 - hop * 0.4), 1);
    (ball.contact.material as THREE.MeshBasicMaterial).opacity = 0.9 - hop * 0.5;
  }

  /** Props nearer the camera than a Blobbi drawn by the page go on the overlay pass, so they are drawn over it. */
  private classifyPropsFront(domDrawn: boolean): boolean {
    let any = false;
    const actors = domDrawn ? [...this.actors.values()].filter((a) => a.visible && !(a.model && a.modelDrawn)) : [];
    for (const built of this.props.values()) {
      const at = this.propAt(built);
      const front = actors.some((b) => at.x + at.z > b.x + b.z + BODY_DEPTH * 0.6);
      if (front !== built.front) {
        built.front = front;
        setFront(built.root, front);
      }
      any ||= front;
    }
    return any;
  }

  // ─── The bath (M15) ───────────────────────────────────────────────────────

  /**
   * The care ritual under way, or none (M15). Anchored to the main actor, followed as it moves; in a tub (`tubIndex`)
   * the tub item's model steps aside and the hollow tub stands on its footprint with the water (`bath-scene.ts`), in
   * place (`tubIndex` null) only what the ritual lays on the body. Redrawn from the frame each time it is given; the
   * frame decides everything drawn (`bath-frame.ts`). Null puts the tub back. A tub index that is not a piece here is
   * a ritual in place.
   */
  setBath(frame: BathFrame | null, anchor: Extract<BathAnchor, { kind: 'world' }> | null = null) {
    if (!frame) {
      if (!this.bath) return;
      this.scene.remove(this.bath.layer.root);
      this.bath.layer.dispose();
      if (this.bath.built) this.bath.built.holder.visible = true;
      this.bath = null;
      this.shadowsDirty = true;
      this.requestRender();
      return;
    }
    const built = anchor?.tubIndex != null ? this.byIndex.get(anchor.tubIndex) ?? null : null;
    if (this.bath && this.bath.built !== built) this.setBath(null);
    if (!this.bath) {
      if (built) built.holder.visible = false;
      const layer = new BathLayer(built ? built.rect : null, () => this.reducedMotion);
      this.scene.add(layer.root);
      this.bath = { layer, built, frame };
      this.needsCompile = true;
    }
    this.bath.frame = frame;
    this.updateBathAnchor();
    this.shadowsDirty = true;
    this.requestRender();
  }

  /** The ritual follows the main actor: its place now, as it walks, jumps or stands in the tub. */
  private updateBathAnchor() {
    if (!this.bath) return;
    const main = this.actors.get(MAIN);
    if (main) this.bath.layer.update(this.bath.frame, { x: main.x, z: main.z, elev: main.elev, tiles: main.tiles });
  }

  /** A piece's footprint on the floor (tiles), as laid out now, or null for no such piece (or one on a wall). */
  itemFootprint(index: number): { x0: number; x1: number; z0: number; z1: number } | null {
    const built = this.byIndex.get(index);
    if (!built || built.item.placement.at !== 'floor') return null;
    return { ...built.rect };
  }

  // ─── Blobbis ──────────────────────────────────────────────────────────────

  private addActor(id: string, isEgg: boolean): Actor {
    const caster = new THREE.Mesh(this.casterGeometry, this.casterMaterial);
    caster.castShadow = true;
    const contact = new THREE.Mesh(this.quad, new THREE.MeshBasicMaterial({ map: this.contactTexture, transparent: true, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2;
    contact.renderOrder = 1;
    this.scene.add(caster, contact);
    const actor: Actor = { id, x: 5.5, z: 5.5, elev: 0, hop: 0, visible: true, isEgg, tiles: 2.5, speed: DEFAULT_WALK_SPEED, path: [], walked: 0, facing: 'front', heading: AZIMUTH, reach: { back: 0.5, front: 0.5 }, model: null, modelDrawn: false, gaze: null, journey: null, journeyPreview: null, caster, contact, met: false };
    this.actors.set(id, actor);
    return actor;
  }

  private removeActor(id: string) {
    const actor = this.actors.get(id);
    if (!actor) return;
    if (actor.model) this.scene.remove(actor.model.object);
    this.scene.remove(actor.caster, actor.contact);
    (actor.contact.material as THREE.Material).dispose();
    this.actors.delete(id);
    this.settleWalk(id, 'stopped');
  }

  /** Eggs don't walk, nor a sleeping Blobbi, nor anyone while decorating. */
  private canWalk(actor: Actor): boolean {
    const asleep = actor.id === MAIN && this.sleepTarget === 1;
    return actor.visible && !actor.isEgg && !asleep && !this.editing;
  }

  /**
   * Let the scene amble the user's Blobbi about on its own, or not. Off, it
   * stands where it was left until the app sends it somewhere: the app then
   * decides when it may wander (never mid-care, never while the player is
   * busy). Visitors amble regardless.
   */
  setMainWanders(on: boolean) {
    this.mainWanders = on;
  }

  private canWander(actor: Actor): boolean {
    if (actor.id === MAIN && !this.mainWanders) return false;
    if (actor.script) return false;
    return this.canWalk(actor) && !this.reducedMotion && !this.pendingWalks.has(actor.id);
  }

  private scheduleWander() {
    if (this.wanderTimer) clearTimeout(this.wanderTimer);
    const [lo, hi] = WANDER_MS;
    this.wanderTimer = setTimeout(() => {
      if (this.disposed) return;
      if (!document.hidden) {
        const main = this.actors.get(MAIN)!;
        for (const a of this.actors.values()) {
          if (!this.canWander(a) || a.path.length) continue;
          // Friends mostly wander over to the user's Blobbi; everyone else ambles
          if (a.id !== MAIN && main.visible && Math.random() < 0.6) {
            a.met = false;
            this.walkActor(a.id, main.x + (Math.random() < 0.5 ? 1 : 0), main.z + (Math.random() < 0.5 ? 0 : 1));
            continue;
          }
          if (Math.random() < 0.5) continue;
          const free = this.freeTiles(a.id).filter(([i, j]) => {
            const d = Math.hypot(i + 0.5 - a.x, j + 0.5 - a.z);
            return d >= 1.5 && d <= 3.5;
          });
          const pick = free[Math.floor(Math.random() * free.length)];
          if (pick) this.walkToTile(a, pick[0], pick[1]);
        }
      }
      this.scheduleWander();
    }, lo + Math.random() * (hi - lo));
  }

  /** Tiles nothing stands on (furniture or another Blobbi), as [column, row]. */
  private freeTiles(except?: string, margin = 0): [number, number][] {
    const blocked = this.blockedTiles(margin);
    for (const a of this.actors.values()) {
      if (a.id !== except && a.visible) blocked.add(Math.floor(a.x) * G + Math.floor(a.z));
    }
    const tiles: [number, number][] = [];
    for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) if (!blocked.has(i * G + j)) tiles.push([i, j]);
    return tiles;
  }

  /** Stand an actor on the free tile nearest (x, z). */
  private standNear(actor: Actor, x: number, z: number) {
    const [i, j] = this.nearestFreeTile(x, z, actor.id);
    actor.x = clampToReach(i + 0.5, actor.reach);
    actor.z = clampToReach(j + 0.5, actor.reach);
  }

  /** Step a standing Blobbi clear of the walls and the floor's edge, if its body reaches past them. */
  private keepClear(actor: Actor) {
    const x = clampToReach(actor.x, actor.reach);
    const z = clampToReach(actor.z, actor.reach);
    if (x === actor.x && z === actor.z) return;
    actor.x = x;
    actor.z = z;
    this.shadowsDirty = true;
    this.requestRender();
  }

  /** Where a Blobbi stands for a tile: its centre, kept its reach clear of the walls and the floor's edge. */
  private standPoint(actor: Actor, i: number, j: number): { x: number; z: number } {
    return { x: clampToReach(i + 0.5, actor.reach), z: clampToReach(j + 0.5, actor.reach) };
  }

  private nearestFreeTile(x: number, z: number, except?: string): [number, number] {
    // A Blobbi's body is wider than its tile: it stands clear of furniture by
    // half its width, so it doesn't look to be standing in a table beside it
    const actor = except ? this.actors.get(except) : undefined;
    let free = this.freeTiles(except, actor ? actor.tiles * BODY_HALF_WIDTH : 0);
    if (!free.length) free = this.freeTiles(except);
    if (!free.length) return [Math.floor(G / 2), Math.floor(G / 2)];
    return free.reduce((best, t) => (
      Math.hypot(t[0] + 0.5 - x, t[1] + 0.5 - z) < Math.hypot(best[0] + 0.5 - x, best[1] + 0.5 - z) ? t : best
    ));
  }

  /** Tiles under standing furniture, and with `margin`, tiles whose centre comes within it of any. */
  private blockedTiles(margin = 0): Set<number> {
    const blocked = new Set<number>();
    for (const built of this.built.values()) {
      if (built.item.placement.at !== 'floor' || built.item.mount === 'rug' || built.stackedOn !== undefined) continue;
      const r = built.rect;
      for (let i = Math.floor(r.x0 - margin + 1e-3); i < Math.ceil(r.x1 + margin - 1e-3); i++) {
        for (let j = Math.floor(r.z0 - margin + 1e-3); j < Math.ceil(r.z1 + margin - 1e-3); j++) {
          if (i < 0 || j < 0 || i >= G || j >= G) continue;
          const dx = Math.max(r.x0 - (i + 0.5), 0, i + 0.5 - r.x1);
          const dz = Math.max(r.z0 - (j + 0.5), 0, j + 0.5 - r.z1);
          if (Math.hypot(dx, dz) < margin + 1e-3) blocked.add(i * G + j);
        }
      }
    }
    return blocked;
  }

  /** Whether a Blobbi is on its way somewhere (the user's by default). */
  isWalking(id = MAIN): boolean {
    const actor = this.actors.get(id);
    if (actor?.script) return !!actor.script.walking;
    return (actor?.path.length ?? 0) > 0;
  }

  /** Whether a Blobbi may be sent walking right now: not an egg, not asleep, not while decorating. */
  canWalkNow(id = MAIN): boolean {
    const actor = this.actors.get(id);
    return !!actor && this.canWalk(actor);
  }

  /**
   * Send a Blobbi to a floor point: the free tile nearest it (`'to'`), or
   * the free tile just behind it on the open side, to stand by something
   * and stay in view (`'approach'`). Resolves with how the walk ended, the
   * home's contract (`WalkOutcome`): `arrived` is the only outcome after
   * which an action waiting for the walk may run; a newer request settles
   * the older one `replaced`; a stop, a room change, decorating, going away
   * or disposal settle it `stopped`; a walk that cannot start (an egg,
   * asleep, decorating, nowhere to stand) is `refused`. Under reduced motion
   * the Blobbi is taken straight there and the walk has arrived. Never
   * rejects, and never stays pending once the walk is over.
   */
  requestWalk(id: string, x: number, z: number, how: 'to' | 'approach' = 'to', clear?: number): Promise<WalkOutcome> {
    const actor = this.actors.get(id);
    if (!actor || !this.canWalk(actor)) return Promise.resolve('refused');
    // Coming to a thing with a size (a dish, a ball): stand its reach and the thing's clear of it, on the far side
    // from the camera when that is free, so the thing is in front of it and never under it
    const spot = how === 'approach' && clear !== undefined ? this.standClearOf(actor, x, z, clear + actor.reach.front) : null;
    const [i, j] = spot ? spot.tile : how === 'approach' ? this.nearestFreeTile(x - 0.6, z - 0.6, id) : this.nearestFreeTile(x, z, id);
    // Whatever walk was requested before is being replaced, whether or not this one starts
    this.settleWalk(id, 'replaced');
    if (!this.walkToTile(actor, i, j, spot?.at)) return Promise.resolve('refused');
    if (!actor.path.length) {
      // Already standing there, or taken straight there under reduced motion
      this.arrive(actor);
      return Promise.resolve('arrived');
    }
    return new Promise((resolve) => {
      this.pendingWalks.set(id, resolve);
    });
  }

  /** Walk the user's Blobbi to the free tile nearest a floor point (a tap on the floor). */
  walkTo(x: number, z: number) {
    void this.requestWalk(MAIN, x, z, 'to');
  }

  /** Stop a Blobbi where it stands; its pending walk resolves `stopped`. */
  stopWalk(id = MAIN) {
    const actor = this.actors.get(id);
    if (!actor) return;
    const walking = actor.path.length > 0;
    actor.path = [];
    this.settleWalk(id, 'stopped');
    if (walking) {
      actor.facing = 'front';
      this.shadowsDirty = true;
      this.requestRender();
    }
  }

  private walkActor(id: string, x: number, z: number) {
    const actor = this.actors.get(id);
    if (!actor || !this.canWalk(actor)) return;
    const [i, j] = this.nearestFreeTile(x, z, id);
    this.walkToTile(actor, i, j);
  }

  /**
   * Where a Blobbi stands to be `distance` from a thing at (x, z): behind it (away from the camera, so the thing
   * is in front of it), else toward where the Blobbi is now, else round the sides; the first of these on a free
   * tile that is not the thing's own, kept clear of the walls. Null when none is (the plain approach then).
   */
  private standClearOf(actor: Actor, x: number, z: number, distance: number): { at: { x: number; z: number }; tile: [number, number] } | null {
    const toward = { x: actor.x - x, z: actor.z - z };
    const len = Math.hypot(toward.x, toward.z);
    const back = { x: -Math.SQRT1_2, z: -Math.SQRT1_2 };
    const candidates = [back, ...(len > 0.3 ? [{ x: toward.x / len, z: toward.z / len }] : []), { x: -1, z: 0 }, { x: 0, z: -1 }, { x: Math.SQRT1_2, z: -Math.SQRT1_2 }, { x: -Math.SQRT1_2, z: Math.SQRT1_2 }, { x: Math.SQRT1_2, z: Math.SQRT1_2 }];
    const blocked = this.blockedTiles(actor.tiles * BODY_HALF_WIDTH * 0.5);
    const own = Math.floor(x) * G + Math.floor(z);
    for (const d of candidates) {
      const at = { x: clampToReach(x + d.x * distance, actor.reach), z: clampToReach(z + d.z * distance, actor.reach) };
      const ti = Math.floor(at.x);
      const tj = Math.floor(at.z);
      if (ti < 0 || tj < 0 || ti >= G || tj >= G) continue;
      const key = ti * G + tj;
      if (key === own || blocked.has(key)) continue;
      // Clamped into a wall it may have come too near: not this way
      if (Math.hypot(at.x - x, at.z - z) < distance * 0.8) continue;
      // Another Blobbi standing there
      if ([...this.actors.values()].some((o) => o.id !== actor.id && o.visible && Math.floor(o.x) === ti && Math.floor(o.z) === tj)) continue;
      return { at, tile: [ti, tj] };
    }
    return null;
  }

  private walkToTile(b: Actor, ti: number, tj: number, exact?: { x: number; z: number }): boolean {
    const start = [Math.min(G - 1, Math.max(0, Math.floor(b.x))), Math.min(G - 1, Math.max(0, Math.floor(b.z)))];
    const key = (i: number, j: number) => i * G + j;
    const search = (blocked: Set<number>) => {
      const prev = new Map<number, number>([[key(start[0], start[1]), -1]]);
      const queue = [start];
      while (queue.length) {
        const [i, j] = queue.shift()!;
        if (i === ti && j === tj) break;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = i + di, nj = j + dj;
          const k = key(ni, nj);
          if (ni < 0 || nj < 0 || ni >= G || nj >= G || prev.has(k) || blocked.has(k)) continue;
          prev.set(k, key(i, j));
          queue.push([ni, nj]);
        }
      }
      return prev;
    };
    // Keep the body clear of furniture on the way too; squeeze past only when there's no other way
    let prev = search(this.blockedTiles(b.tiles * BODY_HALF_WIDTH));
    if (!prev.has(key(ti, tj))) prev = search(this.blockedTiles());
    if (!prev.has(key(ti, tj))) return false;
    const path: { x: number; z: number }[] = [];
    for (let k = key(ti, tj); k !== -1 && k !== key(start[0], start[1]); k = prev.get(k)!) {
      // Each step clear of the walls by the body's reach: beside a wall it walks along it, not into it
      const step = this.standPoint(b, Math.floor(k / G), k % G);
      if (!path.length || step.x !== path[0].x || step.z !== path[0].z) path.unshift(step);
    }
    b.elev = 0;
    this.shadowsDirty = true;
    this.requestRender();
    const end = exact ?? this.standPoint(b, ti, tj);
    // Going to an exact spot on the tile: the last step is that spot, not the tile's centre
    if (exact && path.length) path[path.length - 1] = { ...end };
    // Two tiles clamped to one point make one step
    while (path.length > 1 && path[path.length - 1].x === path[path.length - 2].x && path[path.length - 1].z === path[path.length - 2].z) path.pop();
    if (path.length && Math.abs(path[0].x - b.x) < 1e-6 && Math.abs(path[0].z - b.z) < 1e-6) path.shift();
    if (this.reducedMotion) {
      // Go straight there
      b.x = end.x;
      b.z = end.z;
      b.path = [];
      return true;
    }
    // Finish on the tile's standing point even when already on the tile
    if (!path.length && (Math.abs(b.x - end.x) > 0.05 || Math.abs(b.z - end.z) > 0.05)) path.push(end);
    b.path = path;
    return true;
  }

  /** Settle a Blobbi's pending walk request, if any, with how it ended. */
  private settleWalk(id: string, outcome: WalkOutcome) {
    const pending = this.pendingWalks.get(id);
    if (!pending) return;
    this.pendingWalks.delete(id);
    pending(outcome);
  }

  private arrive(actor: Actor) {
    this.settleWalk(actor.id, 'arrived');
    const main = this.actors.get(MAIN)!;
    if (actor.id !== MAIN && !actor.met && Math.hypot(actor.x - main.x, actor.z - main.z) < 1.6) {
      actor.met = true;
      this.onMeet?.(actor.id);
    }
  }

  /** Put the Blobbi where it belongs on room entry: on the bed when asleep, else at `at` (its nearest free spot), else near the middle. */
  private spawnBlobbi(at?: { x: number; z: number }) {
    const b = this.actors.get(MAIN)!;
    // A scene has it (a room transition): the scene puts it down where it belongs when it ends
    if (b.script) return;
    b.path = [];
    b.hop = 0;
    const bed = this.sleepTarget === 1
      ? [...this.built.values()].find((x) => x.item.interaction === 'bed')
      : undefined;
    if (bed) {
      // On the bed, and still clear of the wall it stands against
      b.x = clampToReach(midX(bed.rect), b.reach);
      b.z = clampToReach(midZ(bed.rect), b.reach);
      b.elev = bed.size.y * 0.55;
    } else {
      this.standNear(b, at?.x ?? 4.5, at?.z ?? 4.5);
      b.elev = 0;
    }
    // Coming into a room (or into bed) ends whatever walk was under way
    this.settleWalk(MAIN, 'stopped');
    this.shadowsDirty = true;
  }

  /** Squash an item as if tapped, and send the Blobbi over to it. */
  poke(index: number) {
    const built = this.byIndex.get(index);
    if (!built) return;
    if (!this.reducedMotion) built.pokeStart = performance.now();
    const r = built.rect;
    // Approach from the open side of the room
    this.walkTo(Math.min(G - 0.5, r.x1 + 0.5 > G ? midX(r) : r.x1 + 0.5), Math.min(G - 0.5, r.z1 + 0.5 > G ? midZ(r) : r.z1 + 0.5));
    this.requestRender();
  }

  /** Switch a lamp on or off. False if the item isn't a lamp. */
  toggleLamp(index: number): boolean {
    const lamp = this.byIndex.get(index)?.lamp;
    if (!lamp) return false;
    lamp.on = !lamp.on;
    if (this.reducedMotion) lamp.level = lamp.on ? 1 : 0;
    this.requestRender();
    return true;
  }

  /**
   * Choreograph a Blobbi (a room transition): it stands, walks or flies
   * where the script says, past the floor's edge or above the room if need
   * be, its walk and its bounds set aside meanwhile. Cleared, it is put back
   * on the floor at the free spot nearest where the script left it, inside
   * the room's bounds, so a transition never leaves it anywhere invalid.
   */
  setActorScript(id: string, script: ActorScript | null) {
    const actor = this.actors.get(id);
    if (!actor) return;
    if (script) {
      if (!actor.script) {
        actor.path = [];
        this.settleWalk(id, 'stopped');
      }
      actor.script = script;
      actor.x = script.x;
      actor.z = script.z;
      actor.elev = script.elev;
      if (script.heading !== undefined) {
        actor.heading = script.heading;
        actor.facing = facingForHeading(Math.sin(script.heading), Math.cos(script.heading), FACING_BASIS, actor.facing);
      }
    } else if (actor.script) {
      actor.script = null;
      actor.elev = 0;
      actor.facing = 'front';
      actor.heading = AZIMUTH;
      this.standNear(actor, Math.min(G, Math.max(0, actor.x)), Math.min(G, Math.max(0, actor.z)));
    }
    this.shadowsDirty = true;
    this.requestRender();
  }

  /** Where a Blobbi would stand for a floor point (the free spot nearest it, clear of the walls and the furniture there now). */
  standPointNear(x: number, z: number, id = MAIN): { x: number; z: number } {
    const actor = this.actors.get(id);
    if (!actor) return { x, z };
    const [i, j] = this.nearestFreeTile(Math.min(G - 0.01, Math.max(0.01, x)), Math.min(G - 0.01, Math.max(0.01, z)), id);
    return this.standPoint(actor, i, j);
  }

  /**
   * What is under a pointer that is only hovering (a mouse, a pen), for the room's affordances: a piece lifts a
   * little (and one that does something shows a soft ring under it), and the pointer says it can be tapped.
   * Returns what is there. Never while decorating, where the editor has its own selection.
   */
  hoverAt(sx: number, sy: number): 'item' | 'actor' | 'floor' | null {
    const hit = sx < 0 || this.editing ? null : this.pick(sx, sy);
    const index = hit?.kind === 'item' ? hit.index : null;
    if (index !== this.hovered) {
      this.hovered = index;
      this.requestRender();
    }
    // A prop can be tapped like a piece: the pointer says so the same way
    return hit?.kind === 'prop' ? 'item' : hit?.kind ?? null;
  }

  /** A piece pressed (a finger or button down on it), or none: it gives a little until released. */
  pressItem(index: number | null) {
    for (const built of this.built.values()) {
      const pressed = built.item.index === index && !this.editing;
      if (!!built.pressed !== pressed) {
        built.pressed = pressed;
        this.requestRender();
      }
    }
  }

  /** The soft ring under a hovered piece that does something (a bed, the fridge, the toy box, a lamp). */
  private placeHoverRing() {
    const built = this.hovered !== null ? this.byIndex.get(this.hovered) : undefined;
    const meaningful = !!built && built.item.placement.at === 'floor' && (!!built.item.interaction || !!built.lamp);
    const level = meaningful ? built!.hover ?? 0 : 0;
    if (!this.hoverRing) {
      if (level <= 0) return;
      this.hoverRing = new THREE.Mesh(this.quad, new THREE.MeshBasicMaterial({ map: this.contactTexture, color: new THREE.Color(1, 0.96, 0.82), transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending }));
      this.hoverRing.rotation.x = -Math.PI / 2;
      this.hoverRing.renderOrder = 1;
      this.scene.add(this.hoverRing);
    }
    const ring = this.hoverRing;
    ring.visible = level > 0.01;
    if (!ring.visible || !built) return;
    const r = built.rect;
    const w = (r.x1 - r.x0) * 1.35;
    const d = (r.z1 - r.z0) * 1.35;
    ring.position.set((r.x0 + r.x1) / 2, 0.03, (r.z0 + r.z1) / 2);
    ring.scale.set(w, d, 1);
    (ring.material as THREE.MeshBasicMaterial).opacity = 0.5 * level;
  }

  /**
   * Draw at a quality level (`room-quality.ts`): the pixel ratio, the key light's shadow (its map's size, or none),
   * how many lamps' light is drawn, the journey motes' density and the idle frame rate. The Blobbi, the furniture
   * and the room are the same at every level; only how they are drawn changes.
   */
  setQuality(quality: QualitySettings) {
    const before = this.quality;
    this.quality = quality;
    if (before.shadows !== quality.shadows || before.shadowMapSize !== quality.shadowMapSize) {
      this.key.castShadow = quality.shadows !== 'off';
      if (this.key.shadow.mapSize.x !== quality.shadowMapSize) {
        this.key.shadow.map?.dispose();
        this.key.shadow.map = null;
        this.key.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
      }
      this.shadowsDirty = true;
    }
    // Lights not drawn are left out of the shaders altogether (one recompile, then nothing per pixel)
    this.lamps.forEach((lamp, i) => {
      lamp.visible = i < quality.lamps;
    });
    if (this.geometry && before.maxPixelRatio !== quality.maxPixelRatio) this.setGeometry(this.geometry);
    this.monitor.reset(performance.now());
    this.requestRender();
  }

  /** The quality it draws at now. */
  qualityNow(): QualitySettings {
    return this.quality;
  }

  /** The GPU's name, where the browser gives it (for the first guess at quality and the performance report). */
  gpuName(): string | undefined {
    try {
      const gl = this.renderer.getContext();
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : undefined;
    } catch {
      return undefined;
    }
  }

  /** Hold the room's fold-in at `ms` after it began (a development scrubber), or let it run again (null). */
  holdIntro(ms: number | null) {
    this.introHeld = ms;
    if (ms !== null && this.introStart === null) this.introStart = performance.now() - ms;
    this.requestRender();
  }

  /**
   * The Blobbi is behind a back wall (a transition's scene): the 3D model is hidden by the wall as anything is, and
   * the 2D drawing, which is drawn over the canvas, is clipped to everything outside the walls' outlines on screen
   * (`wallsOnScreen`), so the wall hides it exactly as far as it is behind it.
   */
  setWallsCover(wall: 'left' | 'right' | null | boolean) {
    const next = wall === true ? 'left' : wall === false ? null : wall;
    if (this.wallsCover === next) return;
    this.wallsCover = next;
    this.requestRender();
  }

  /** Which back wall the 2D Blobbi is behind now (`setWallsCover`), or null. */
  behindWalls(): 'left' | 'right' | null {
    return this.wallsCover;
  }

  /**
   * A back wall's outline on the canvas: the outline of its whole slab (its face, its thickness, its top and its
   * end), as the convex hull of the slab's corners projected. A drawing behind the wall is hidden exactly inside it.
   */
  wallsOnScreen(wall: 'left' | 'right' = this.wallsCover ?? 'left'): { x: number; y: number }[][] {
    const t = THICK;
    const top = H + 0.1;
    const box = wall === 'left'
      ? { x: [-t, 0], z: [-t, G + 0.1] }
      : { x: [-t, G + 0.1], z: [-t, 0] };
    const points: { x: number; y: number }[] = [];
    for (const x of box.x) for (const y of [-BASE, top]) for (const z of box.z) {
      const p = this.projectPoint(x, y, z);
      if (p) points.push({ x: p.x, y: p.y });
    }
    return [convexHull(points)];
  }

  /**
   * Whether the floor tile under a point is free of furniture (a scene's path checks it is not walking through a
   * piece). The tile itself is asked, not the nearest free one: a point on a tile boundary (the path's samples land
   * on them) has two nearest tiles at the same distance, and the Blobbi's own tile is not furniture. Both used to
   * read as blocked, and from the middle of the room every edge did, so the floor gag quietly became the quick change.
   */
  tileFree(x: number, z: number): boolean {
    if (x < 0 || z < 0 || x >= G || z >= G) return true;
    return !this.blockedTiles().has(Math.floor(x) * G + Math.floor(z));
  }

  /** The face a Blobbi's 3D model wears (the 2D drawing takes the same expression as a prop); null for the neutral face. */
  setActorFace(id: string, face: ProceduralFace | null) {
    const actor = this.actors.get(id);
    if (!actor || actor.face === face) return;
    actor.face = face;
    this.requestRender();
  }

  /** A choreographed pose of a Blobbi's 3D body, or null to let it stand as it does. Drawn on the next frame. */
  setActorPose(id: string, pose: ActorFrame['pose']) {
    const actor = this.actors.get(id);
    if (!actor) return;
    actor.pose = pose ?? null;
    this.requestRender();
  }

  /** Where a Blobbi's 3D eyes look (the 2D drawing takes the same offset as a prop); null for its resting gaze. */
  setActorGaze(id: string, gaze: { x: number; y: number } | null) {
    const actor = this.actors.get(id);
    if (!actor) return;
    const same = actor.gaze === gaze || (!!actor.gaze && !!gaze && actor.gaze.x === gaze.x && actor.gaze.y === gaze.y);
    if (same) return;
    actor.gaze = gaze;
    if (actor.model) this.requestRender();
  }

  /** Play one of the home's body gestures on a Blobbi's 3D model (the 2D drawing plays it on its own box). */
  playGesture(id: string, kind: ActorGesture) {
    const model = this.actors.get(id)?.model;
    if (!model) return;
    model.gesture(kind);
    this.requestRender();
  }

  /** Make a Blobbi hop, as if tapped. */
  hop(id: string) {
    const actor = this.actors.get(id);
    if (!actor || this.reducedMotion) return;
    actor.hop = 0.6;
    this.requestRender();
  }

  private stepActors(dt: number): boolean {
    let moving = false;
    for (const b of this.actors.values()) {
      // A choreographed Blobbi is where its script puts it (`setActorScript`)
      if (b.script) {
        moving = true;
        continue;
      }
      // Face where the walk is heading (a few waypoints ahead, so a staircase
      // path around furniture reads as one direction), front with no path.
      b.facing = facingAlongPath(b.x, b.z, b.path, b.facing, FACING_BASIS);
      // Settle a tap's hop, standing or walking
      if (b.hop > 0) {
        b.hop = Math.max(0, b.hop - dt * 2.4);
        moving = true;
      }
      if (!b.path.length) continue;
      // A 3D model walks at its own pace (its feet keep step with it)
      let step = b.speed * (b.model?.pace ?? 1) * dt;
      while (step > 0 && b.path.length) {
        const next = b.path[0];
        const dx = next.x - b.x;
        const dz = next.z - b.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 1e-6) b.heading = Math.atan2(dx, dz);
        if (dist <= step) {
          b.x = next.x;
          b.z = next.z;
          b.path.shift();
          step -= dist;
          b.walked += dist;
        } else {
          b.x += (dx / dist) * step;
          b.z += (dz / dist) * step;
          b.walked += step;
          step = 0;
        }
      }
      // No bob of the anchor while walking: the renderer animates the body
      // (legs or a hop of its own), and the feet must stay on the floor
      if (!b.path.length) {
        b.facing = 'front';
        b.heading = AZIMUTH;
        this.arrive(b);
      }
      moving = true;
    }
    if (moving) this.shadowsDirty = true;
    return moving;
  }

  /** Place each Blobbi's shadow caster and contact shadow, and drive its 3D model if it has one. True while a model animates. */
  private placeActorProxies(dt: number): boolean {
    let animating = false;
    const now = performance.now();
    for (const b of this.actors.values()) {
      const tiles = b.tiles;
      const width = tiles * 0.55;
      const height = tiles * 0.7;
      // A journey under way (or a scrubbed moment of one): its frame, which the shadow and the model both follow
      const travel = this.journeyFrameOf(b, now);
      if (travel) {
        animating = true;
        // Its cast shadow goes with it: the shadow map is redrawn while it travels
        this.shadowsDirty = true;
      }
      // The shadow goes with what is left of the body: the same share of it that is materialized (its height cut
      // from the top, as the body dissolves and forms; its fade under reduced motion), eased, and gone with it
      const solid = travel ? travel.frame.cut * travel.frame.opacity : 1;
      const shade = journeyShadow(travel?.frame ?? null);
      const castHeight = height * Math.max(0, solid);
      b.caster.visible = b.visible && solid > 0.02 && b.x > -0.5 && b.x < G + 0.5 && b.z > -0.5 && b.z < G + 0.5;
      b.caster.scale.set(width, Math.max(1e-3, castHeight), width * 0.8);
      b.caster.position.set(b.x, b.elev + b.hop + castHeight / 2, b.z);
      // Off the floor (a scene has it stepping past the edge, or falling): no shadow on the floor it is not over
      const overFloor = b.x > -0.05 && b.x < G + 0.05 && b.z > -0.05 && b.z < G + 0.05 && b.elev > -0.2;
      b.contact.visible = b.visible && shade > 0.01 && overFloor;
      (b.contact.material as THREE.MeshBasicMaterial).opacity = shade;
      const contact = width * Math.max(0.4, 1.15 - b.hop * 1.5) * (0.7 + 0.3 * shade);
      b.contact.scale.set(contact, contact * 0.85, 1);
      b.contact.position.set(b.x, b.elev + 0.06, b.z);
      // A model casts its own shadow, cut with its body (teleport3d's clipping plane clips the shadow pass too); only
      // a fade with no cut (reduced motion) needs it switched off, and only once, as it crosses half
      if (b.model) this.modelCastsShadow(b, solid > 0.5 || (travel !== null && travel.frame.cut < 1 && solid > 0.02));
      if (b.model) {
        const o = b.model.object;
        o.visible = b.visible;
        o.position.set(b.x, b.elev + b.hop, b.z);
        o.scale.setScalar(tiles / b.model.box);
        const sleeping = b.id === MAIN && this.sleepTarget === 1;
        const motion = b.script ? (b.script.walking ? 'walking' : 'idle') : b.path.length ? 'walking' : b.isEgg || sleeping ? 'still' : 'idle';
        // Seen from the open corner: it leans back from the camera by its stage's lean (`ROOM_LEAN`)
        if (b.model.update({ dt, motion, heading: b.heading, sleeping, viewAzimuth: AZIMUTH, gaze: b.gaze ?? undefined, journey: travel, face: b.face ?? null, pose: b.pose ?? null })) {
          // Breathing and blinking alone are drawn at a gentler rate (`IDLE_FRAME_MS`); anything moving at full rate
          if (b.model.busy?.() === false && !travel) this.idleAnimating = true;
          else animating = true;
        }
      }
    }
    return animating;
  }

  /** Whether a Blobbi's model casts its shadow; flipped only when it changes. */
  private modelCastsShadow(b: Actor, on: boolean) {
    if (!b.model || b.modelShadow === on) return;
    b.modelShadow = on;
    b.model.object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.userData.castsShadow !== false) {
        if (mesh.userData.castsShadow === undefined) mesh.userData.castsShadow = mesh.castShadow;
        if (mesh.userData.castsShadow) mesh.castShadow = on;
      }
    });
    this.shadowsDirty = true;
  }

  /** A Blobbi's journey frame now (or the scrubbed one), or null when it is not travelling. */
  private journeyFrameOf(b: Actor, now: number): { frame: JourneyFrame; kind: JourneyKind; t: number; options: Teleport3DOptions } | null {
    if (b.journeyPreview) {
      const { kind, t, reduced } = b.journeyPreview;
      const frame = journeyFrame(kind, t, reduced);
      return { frame, kind, t, options: { skyY: this.skyAbove(b), layers: frame.motes ? [{ kind, t, fade: 1 }] : [], density: this.quality.moteDensity } };
    }
    if (!b.journey) return null;
    const t = now - b.journey.startedAt;
    // A little past its end, so the last frame (whole, or gone) is drawn before the model rests
    if (t > journeyDuration(b.journey.kind, b.journey.reduced) + 120) {
      b.journey = null;
      b.journeyBefore = null;
      return null;
    }
    const frame = journeyFrame(b.journey.kind, t, b.journey.reduced);
    const layers = moteLayers(frame.motes ? { kind: b.journey.kind, t } : null, b.journeyBefore ?? null, now);
    return { frame, kind: b.journey.kind, t, options: { skyY: b.skyY ?? this.skyAbove(b), layers, density: this.quality.moteDensity } };
  }

  /**
   * The top of the view above a Blobbi, as a world height: how high a point
   * straight above where it stands can go before it leaves the top of the
   * canvas (a little past it). The motes rise out through it and come in
   * from it, whatever the room's size, camera or where the Blobbi stands.
   */
  /** The same for any floor point (tiles above the floor): how high a transition may send the Blobbi before it is out of view. */
  skyAt(x: number, z: number): number {
    return this.skyAbove({ x, z, elev: 0 } as Actor);
  }

  private skyAbove(b: Pick<Actor, 'x' | 'z' | 'elev'>): number {
    const p = new THREE.Vector3();
    const above = (y: number) => p.set(b.x, b.elev + y, b.z).project(this.camera).y;
    let lo = 0;
    let hi = 4;
    while (above(hi) < 1.04 && hi < 512) hi *= 2;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (above(mid) < 1.04) lo = mid;
      else hi = mid;
    }
    return b.elev + hi;
  }

  /**
   * A Blobbi's journey (its presence controller's; `teleport/presence.ts`):
   * the scene draws its frames on the 3D model and fades its shadow with it.
   * The 2D drawing draws its own (`TeleportFrame2D`) from the same timeline.
   */
  setActorJourney(id: string, journey: { kind: JourneyKind; startedAt: number; reduced: boolean } | null) {
    const actor = this.actors.get(id);
    if (!actor) return;
    // Turned back mid-way: the motes already on their way finish it (`moteLayers`); ended or cancelled: none linger
    actor.journeyBefore = actor.journey && journey && actor.journey.kind !== journey.kind ? { kind: actor.journey.kind, startedAt: actor.journey.startedAt, endedAt: performance.now() } : null;
    actor.journey = journey;
    // Leaving or arriving, it stands where it is, under the sky it is measured against
    if (journey) {
      this.stopWalk(id);
      actor.skyY = this.skyAbove(actor);
    }
    this.requestRender();
  }

  /** Show one fixed moment of a journey (a development scrubber), or stop showing one. */
  setActorJourneyPreview(id: string, preview: { kind: JourneyKind; t: number; reduced: boolean } | null) {
    const actor = this.actors.get(id);
    if (!actor) return;
    actor.journeyPreview = preview;
    this.requestRender();
  }

  /**
   * Draw a frame now, not on the next animation frame: a development scrubber's moment, in a tab that may be
   * hidden. Called from inside React's commit (an effect), where a throw would unmount the whole page; a frame that
   * fails is reported (console, and the dev tools' error list) and left undrawn instead. The animation-frame path is
   * untouched: an error there is uncaught as before.
   */
  renderNow() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    try {
      this.renderFrame();
    } catch (error) {
      console.error('[room-scene] a held frame could not be drawn:', error);
      recordRuntimeError('error', error);
    }
  }

  /**
   * Stand a 3D model in a Blobbi's place: the DOM drawing's stand-in, moved,
   * turned and scaled with the Blobbi each frame and told how it moves. The
   * model casts the shadow instead of the proxy. The caller owns the model.
   */
  setActorModel(id: string, model: ActorModel | null) {
    const actor = this.actors.get(id);
    if (!actor || actor.model === model) return;
    if (actor.model) this.scene.remove(actor.model.object);
    actor.model = model;
    actor.modelDrawn = false;
    actor.modelShadow = undefined;
    actor.caster.castShadow = !model;
    if (model) {
      this.scene.add(model.object);
      this.needsCompile = true;
    }
    this.shadowsDirty = true;
    this.requestRender();
  }

  /**
   * Whether a Blobbi's 3D model is on screen yet: set, and drawn on a frame
   * since (a new model's shaders compile first). Until then its DOM drawing
   * stays, so switching to the model never leaves a frame with no Blobbi.
   */
  actorModelDrawn(id = MAIN): boolean {
    const actor = this.actors.get(id);
    return !!actor?.model && actor.modelDrawn;
  }

  /** Where a Blobbi stands on the floor (tiles), or null if it is not in the room. */
  positionOf(id = MAIN): { x: number; z: number } | null {
    const actor = this.actors.get(id);
    return actor ? { x: actor.x, z: actor.z } : null;
  }

  /** The way a Blobbi is heading, for tests and for whoever draws it: yaw about +y, 0 facing +z. */
  headingOf(id = MAIN): number | undefined {
    return this.actors.get(id)?.heading;
  }

  // ─── Room ──────────────────────────────────────────────────────────────────

  /**
   * Painted wall/floor material, cached across rooms and rebuilds: painting
   * wood planks or tile is the slowest thing the room does.
   */
  private surfaceMaterial(surface: RoomSurfaceLayout, kind: 'wall' | 'floor', width: number, height: number, seed: number) {
    const key = `${kind}|${seed}|${width}x${height}|${surface.style}|${surface.palette.join(',')}|${surface.variant ?? ''}|${surface.angle ?? ''}`;
    const cached = this.surfaces.get(key);
    if (cached) {
      // Refresh recency
      this.surfaces.delete(key);
      this.surfaces.set(key, cached);
      return cached;
    }
    const w = width * PATTERN_PX_PER_TILE;
    const h = height * PATTERN_PX_PER_TILE;
    const pxPerUnit = Math.min(2, 1024 / Math.max(w, h));
    const painted = drawSurface(surface, w, h, pxPerUnit, seed);
    let material: THREE.MeshStandardMaterial;
    if (painted) {
      const texture = new THREE.CanvasTexture(painted);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      // No bump map: the paper grain is painted in, and a bump map on these big,
      // far-off planes shimmers as it minifies
      material = shared(new THREE.MeshStandardMaterial({ map: texture, roughness: kind === 'floor' ? 0.55 : 0.95, metalness: 0 }));
    } else {
      // The browser gave the texture's canvas no context (its canvas budget is spent): the surface in its first
      // colour, flat, rather than no room at all. Not cached, so a later visit tries to paint again.
      return shared(new THREE.MeshStandardMaterial({ color: new THREE.Color(surface.palette[0] ?? '#d9d4c7'), roughness: kind === 'floor' ? 0.55 : 0.95, metalness: 0 }));
    }
    this.surfaces.set(key, material);
    while (this.surfaces.size > SURFACE_CACHE) {
      const [oldKey, old] = this.surfaces.entries().next().value as [string, THREE.MeshStandardMaterial];
      this.surfaces.delete(oldKey);
      disposeSurface(old);
    }
    return material;
  }

  /** A box mesh in `parent` that receives shadows. */
  private slab(parent: THREE.Object3D, size: [number, number, number], at: [number, number, number], material: THREE.Material, castShadow = false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...at);
    mesh.receiveShadow = true;
    mesh.castShadow = castShadow;
    parent.add(mesh);
  }

  /**
   * The room as three hinged pieces, like a pop-up book: the floor (unrolling
   * from the back corner) and each back wall (hinged along its base, folding
   * up from lying flat outside the room). `applyIntro` folds them up.
   */
  private buildRoom() {
    if (!this.layout) return;
    for (const child of [...this.room.children]) {
      this.room.remove(child);
      disposeObject(child, this.releaseMaterial);
    }
    const { wall, floor } = this.layout;
    const t = THICK;
    const e = 0.04;
    const boardH = 0.22;
    const boardD = 0.06;

    const board = this.trimMaterial;
    // Palettes always have at least one color (see room-layout-schema.ts)
    board.color.copy(hexColor(wall.palette[0]).lerp(new THREE.Color(1, 1, 1), 0.55));
    const shell = this.shellMaterial;
    shell.color.copy(hexColor(wall.palette[1] ?? wall.palette[0]).multiplyScalar(0.82));
    const floorEdge = this.edgeMaterial;
    floorEdge.color.copy(hexColor(floor.palette[1] ?? floor.palette[0]).multiplyScalar(0.7));

    // Floor, from the back corner
    const floorGroup = new THREE.Group();
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(G, G), this.surfaceMaterial(floor, 'floor', G, G, 2));
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(G / 2, 0, G / 2);
    floorMesh.receiveShadow = true;
    floorGroup.add(floorMesh);
    this.slab(floorGroup, [G + t, BASE, G + t], [(G - t) / 2, -BASE / 2 - GAP, (G - t) / 2], floorEdge);
    this.slab(floorGroup, [G + t + 0.1, 0.07, G + t + 0.1], [(G - t) / 2, -BASE - 0.035, (G - t) / 2], board);

    // Left wall (x = 0, runs along z), hinged at its outer base edge
    const left = new THREE.Group();
    left.position.set(-t, 0, 0);
    const leftFace = new THREE.Mesh(new THREE.PlaneGeometry(G, H), this.surfaceMaterial(wall, 'wall', G, H, 3));
    leftFace.rotation.y = Math.PI / 2;
    leftFace.position.set(t, H / 2, G / 2);
    leftFace.receiveShadow = true;
    left.add(leftFace);
    this.slab(left, [t - GAP, H, G + t], [(t - GAP) / 2, H / 2, (G - t) / 2], shell);
    this.slab(left, [t + e, e, G + t + e], [t / 2, H + e / 2, (G - t) / 2], board);
    this.slab(left, [t + e, H, e], [t / 2, H / 2, G + e / 2], board);
    this.slab(left, [boardD, boardH, G], [t + boardD / 2, boardH / 2, G / 2], board, true);

    // Right wall (z = 0, runs along x)
    const right = new THREE.Group();
    right.position.set(0, 0, -t);
    const rightFace = new THREE.Mesh(new THREE.PlaneGeometry(G, H), this.surfaceMaterial(wall, 'wall', G, H, 4));
    rightFace.position.set(G / 2, H / 2, t);
    rightFace.receiveShadow = true;
    right.add(rightFace);
    this.slab(right, [G, H, t - GAP], [G / 2, H / 2, (t - GAP) / 2], shell);
    this.slab(right, [G + e, e, t + e], [G / 2, H + e / 2, t / 2], board);
    this.slab(right, [e, H, t + e], [G + e / 2, H / 2, t / 2], board);
    this.slab(right, [G, boardH, boardD], [G / 2, boardH / 2, t + boardD / 2], board, true);

    this.room.add(floorGroup, left, right);
    this.folds = { floor: floorGroup, left, right };

    // Key light from the open front-right, above; shadows fall toward the walls
    this.key.position.set(G * 1.35, H * 2.4, G * 0.75);
    this.key.target.position.set(G / 2, 0, G / 2);
    const cam = this.key.shadow.camera;
    const span = G * 0.95;
    cam.left = -span;
    cam.right = span;
    cam.top = span;
    cam.bottom = -span;
    cam.near = 0.5;
    cam.far = G * 6;
    cam.updateProjectionMatrix();

    this.needsCompile = true;
  }

  // ─── Furniture ─────────────────────────────────────────────────────────────

  /**
   * A model built once per SNO tree and cloned per placement: clones share
   * geometry, so switching rooms or placing the same object twice costs no
   * rebuild. Geometry gets creased normals (smooth curves, hard box edges).
   */
  private modelTemplate(node: SnoNode): THREE.Object3D {
    let template = this.templates.get(node);
    if (template) return template;
    template = buildSnoObject(node);
    const creased = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
    template.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        (child.material as THREE.Material).dispose();
        let smooth = creased.get(child.geometry);
        if (!smooth) {
          smooth = shared(toCreasedNormals(child.geometry, CREASE_ANGLE));
          creased.set(child.geometry, smooth);
        }
        child.geometry = smooth;
        child.material = this.furnitureMaterial;
        child.castShadow = true;
        child.receiveShadow = true;
      } else if (child instanceof THREE.Points || child instanceof THREE.Line) {
        shared(child.geometry);
        shared(child.material as THREE.Material);
      }
    });
    for (const original of creased.keys()) original.dispose();
    template.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(template);
    // An object with nothing in it, or with coordinates past what floats hold, still needs a size to be placed and picked
    const finite = [box.min, box.max].every((v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z));
    if (box.isEmpty() || !finite) box.set(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
    template.userData.box = box;
    this.templates.set(node, template);
    return template;
  }

  /** Free the GPU buffers of network objects no longer in the room. */
  private evictTemplates() {
    const inUse = new Set([...this.built.values()].map((b) => b.item.node));
    for (const [node, template] of this.templates) {
      if (template.userData.official || inUse.has(node)) continue;
      this.templates.delete(node);
      this.disposeTemplate(template);
    }
  }

  /** Templates' geometry is shared with their clones, so it's freed here rather than with each item. */
  private disposeTemplate(template: THREE.Object3D) {
    template.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.Line) {
        child.geometry.dispose();
        if (child.material !== this.furnitureMaterial) (child.material as THREE.Material).dispose();
      }
    });
  }

  /**
   * Tiles per model unit, times the placement's scale: real size for
   * official models, fitted for network objects.
   */
  private scaleFor(raw: THREE.Vector3, official: boolean, scale = 1): number {
    const unit = official
      ? 1 / MODEL_UNITS_PER_TILE
      : Math.min(SNO_FIT_TILES / Math.max(raw.x, raw.z, 1e-6), SNO_MAX_HEIGHT / Math.max(raw.y, 1e-6));
    return unit * scale;
  }

  /**
   * Size an item to its placement's scale. Floor pieces a little bigger than
   * the tiles they take up shrink to fit them, so neighbours never overlap.
   */
  private rescale(built: Built) {
    let k = this.scaleFor(built.raw, built.item.official, built.item.placement.scale);
    if (built.item.mount !== 'wall') {
      const fit = Math.min(...[built.raw.x * k, built.raw.z * k].map((side) => Math.min(1, Math.min(G, tilesFor(side)) / side)));
      k *= fit;
    }
    built.size.copy(built.raw).multiplyScalar(k);
    built.holder.scale.setScalar(k);
  }

  private buildItem(item: SceneItem): Built {
    const template = this.modelTemplate(item.node);
    // Official models stay cached across rooms; network objects are dropped once unused
    template.userData.official ||= item.official;
    const model = template.clone();
    const box = (template.userData.box as THREE.Box3).clone();
    const raw = box.getSize(new THREE.Vector3());
    const holder = new THREE.Group();
    const built: Built = {
      item: { ...item, mount: mountFor(item, raw) },
      root: new THREE.Group(),
      holder,
      raw,
      offset: new THREE.Vector3(),
      size: new THREE.Vector3(),
      rect: { x0: 0, x1: 0, z0: 0, z1: 0 },
      elev: 0,
      box: new THREE.Box3(),
      front: false,
    };
    const extras = item.extras;

    if (extras?.clock?.kind === 'analog') {
      const { center, radius, hands } = extras.clock;
      let material = this.handMaterials.get(hands);
      if (!material) {
        material = shared(new THREE.MeshStandardMaterial({ color: hexColor(hands), roughness: 0.6 }));
        this.handMaterials.set(hands, material);
      }
      const hand = (length: number, width: number) => {
        const pivot = new THREE.Group();
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, length, width * 0.4), material);
        mesh.position.y = length / 2 - width;
        mesh.castShadow = true;
        pivot.add(mesh);
        pivot.position.set(...center);
        model.add(pivot);
        return pivot;
      };
      const hour = hand(radius * 0.55, radius * 0.12);
      const minute = hand(radius * 0.85, radius * 0.08);
      minute.position.z += radius * 0.04;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.09, radius * 0.09, radius * 0.08, 12), material);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(center[0], center[1], center[2] + radius * 0.08);
      model.add(cap);
      built.clock = { hour, minute };
    } else if (extras?.clock?.kind === 'digital') {
      const { center, width, height, ink, paper } = extras.clock;
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = Math.max(32, Math.round((256 * height) / width));
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const screenMaterial = (this.pools.screen.pop() as THREE.MeshBasicMaterial | undefined)
        ?? new THREE.MeshBasicMaterial({ toneMapped: false });
      screenMaterial.userData.pool = 'screen';
      screenMaterial.map = texture;
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(width, height), screenMaterial);
      screen.position.set(...center);
      model.add(screen);
      built.clock = { texture, canvas, ink, paper };
    }

    const imageUrl = item.placement.content?.imageUrl;
    if (extras?.picture && imageUrl) {
      const { center, width, height, oval } = extras.picture;
      const geometry = oval ? new THREE.CircleGeometry(0.5, 32) : new THREE.PlaneGeometry(1, 1);
      const material = (this.pools.picture.pop() as THREE.MeshStandardMaterial | undefined)
        ?? new THREE.MeshStandardMaterial({ roughness: 0.7 });
      material.userData.pool = 'picture';
      material.map?.dispose();
      material.map = null;
      material.color.set('#ffffff');
      material.visible = false;
      // Pooled materials get reused: only the latest load for this frame may land
      const load = {};
      material.userData.load = load;
      const picture = new THREE.Mesh(geometry, material);
      picture.scale.set(width, height, 1);
      picture.position.set(center[0], center[1], center[2] + 0.4);
      model.add(picture);
      this.textureLoader.load(imageUrl, (texture) => {
        if (this.disposed || material.userData.load !== load) { texture.dispose(); return; }
        texture.colorSpace = THREE.SRGBColorSpace;
        // Cover-fit the image into the opening
        const img = texture.image as { width: number; height: number };
        const imageAspect = img.width / img.height;
        const aspect = width / height;
        if (imageAspect > aspect) {
          texture.repeat.set(aspect / imageAspect, 1);
          texture.offset.set((1 - aspect / imageAspect) / 2, 0);
        } else {
          texture.repeat.set(1, imageAspect / aspect);
          texture.offset.set(0, (1 - imageAspect / aspect) / 2);
        }
        material.map = texture;
        material.visible = true;
        material.needsUpdate = true;
        this.requestRender();
      }, undefined, () => {
        // WebGL can only use images served with CORS headers; anything else shows a plain card
        if (this.disposed || material.userData.load !== load) return;
        material.color.set('#d6d3d1');
        material.visible = true;
        this.requestRender();
      });
    }

    if (extras?.light) {
      built.lamp = { at: new THREE.Vector3(...extras.light.at), world: new THREE.Vector3(), color: hexColor(extras.light.color), intensity: extras.light.intensity, on: true, level: 1 };
    }
    if (extras?.shade) {
      // The light sits inside the shade, which faces away from it, so the shade
      // gets a self-lit skin over it instead, as if the bulb shone through. Facet
      // for facet with the shade and a hair outside it, so no edge of the shade
      // shows through in lines; outer faces only, so it doesn't double up
      const { profile, segments, color } = extras.shade;
      const shade = new THREE.Mesh(
        new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r * 1.015, y)), latheSegments(segments)),
        new THREE.MeshBasicMaterial({
          color: hexColor(color), transparent: true, opacity: SHADE_GLOW,
          depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
        }),
      );
      shade.renderOrder = 1;
      model.add(shade);
      built.shade = shade;
    }
    if (extras?.light && extras.light.intensity > 0) {
      // A lamp is a light source: its shade throwing a dark shadow on the wall reads as impossible
      model.traverse((child) => { child.castShadow = false; });
    }
    if (extras?.bulbs?.length) {
      // Drawn unlit, just over the model's own bulbs, so they glow in their colours
      // whatever the room's light; each throws a halo of its colour on the wall
      // behind it, which is what real lights per bulb would cost too much to do
      built.bulbs = extras.bulbs.map(({ at, radius, color }) => {
        const tint = hexColor(color);
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), new THREE.MeshBasicMaterial({ color: tint.clone(), toneMapped: false }));
        mesh.position.set(...at);
        mesh.scale.set(radius[0] * 1.15, radius[1] * 1.15, radius[2] * 1.15);
        const halo = new THREE.Mesh(this.quad, new THREE.MeshBasicMaterial({
          map: this.halo, color: tint.clone(), transparent: true, opacity: HALO_OPACITY,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
          // A hair off the wall: pulled forward in depth so it never flickers into the wallpaper
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
        }));
        halo.position.set(at[0], at[1], 0.3);
        const size = Math.max(radius[0], radius[1]) * 16;
        halo.scale.set(size, size, 1);
        halo.renderOrder = 1;
        model.add(mesh, halo);
        return { mesh, halo, color: tint };
      });
    }

    // Normalize: floor pieces stand on their base, centered; wall pieces hang
    // by their back, centered on their middle
    const center = box.getCenter(new THREE.Vector3());
    if (item.mount === 'wall') model.position.set(-center.x, -center.y, -box.min.z);
    else model.position.set(-center.x, -box.min.y, -center.z);
    holder.add(model);
    built.offset.copy(model.position);
    built.root.add(holder);
    this.rescale(built);
    model.traverse((child) => {
      if (child instanceof THREE.Points && child.material instanceof THREE.PointsMaterial) {
        child.material.size = Math.max(raw.x, raw.y, raw.z) / 60;
      }
    });

    this.furniture.add(built.root);
    return built;
  }

  /**
   * Resolve every item's footprint and pose: snap to the grid, keep inside
   * the room, stand small items on tables under them, then find overlaps.
   */
  private layoutItems() {
    const all = [...this.built.values()];
    for (const built of all) {
      const p = built.item.placement;
      const s = built.size;
      if (p.at === 'floor') {
        const quarter = p.rot ?? 0;
        const [w, d] = quarter % 2 ? [s.z, s.x] : [s.x, s.z];
        const fw = Math.min(G, tilesFor(w));
        const fd = Math.min(G, tilesFor(d));
        built.rect = rectAt(snapCenter(p.x, fw), snapCenter(p.y, fd), fw, fd);
      } else {
        built.rect = wallRect(p.x, p.y, s);
      }
    }

    // Small things stand on tables they're placed over
    for (const built of all) {
      built.elev = 0;
      built.stackedOn = undefined;
      if (!built.item.small || built.item.placement.at !== 'floor') continue;
      const surface = all.find((o) => o !== built && o.item.surface && o.item.placement.at === 'floor'
        && contains(o.rect, midX(built.rect), midZ(built.rect)));
      if (surface) {
        built.elev = surface.size.y;
        built.stackedOn = surface.item.index;
      }
    }

    // Overlaps: floor pieces with floor pieces, rugs with rugs, wall pieces on the same wall
    const invalid = new Set<number>();
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        if (a.item.placement.at !== b.item.placement.at) continue;
        if (a.item.placement.at === 'floor') {
          if ((a.item.mount === 'rug') !== (b.item.mount === 'rug')) continue;
          if (a.stackedOn === b.item.index || b.stackedOn === a.item.index) continue;
          if ((a.stackedOn === undefined) !== (b.stackedOn === undefined)) continue;
        }
        if (overlaps(a.rect, b.rect)) {
          invalid.add(a.item.index);
          invalid.add(b.item.index);
        }
      }
    }
    const changed = invalid.size !== this.invalid.size || [...invalid].some((i) => !this.invalid.has(i));
    this.invalid = invalid;
    if (changed) this.onInvalidChange?.(invalid);

    for (const built of all) {
      const p = built.item.placement;
      const lift = this.editing && this.selected === built.item.index ? SELECT_LIFT : 0;
      poseOnSurface(built.root, p.at, built.rect, built.elev + FLOOR_OFFSET + lift, WALL_OFFSET + lift);
      built.root.rotation.set(0, p.at === 'floor' ? -(p.rot ?? 0) * (Math.PI / 2) : p.at === 'left' ? Math.PI / 2 : 0, 0);
      // Measure at rest, not squashed mid pop-up or poke
      const animScale = built.root.scale.clone();
      built.root.scale.set(1, 1, 1);
      built.root.updateMatrixWorld(true);
      built.box.setFromObject(built.holder);
      if (built.lamp) {
        built.lamp.world.copy(built.lamp.at).add(built.offset).multiplyScalar(built.holder.scale.x).applyMatrix4(built.root.matrixWorld);
      }
      built.root.scale.copy(animScale);
      built.root.updateMatrixWorld(true);
    }

    this.updateHighlights();
    this.shadowsDirty = true;
  }

  /** Footprint markers while editing: the selected item, and anything blocked. */
  private updateHighlights() {
    for (const child of [...this.overlay.children]) this.overlay.remove(child);
    this.grid.visible = this.editing;
    if (!this.editing) return;
    for (const built of this.built.values()) {
      const index = built.item.index;
      const bad = this.invalid.has(index);
      if (index !== this.selected && !bad) continue;
      const mesh = new THREE.Mesh(this.quad, bad ? this.badMaterial : this.okMaterial);
      mesh.renderOrder = 2;
      const r = built.rect;
      const at = built.item.placement.at;
      mesh.scale.set(r.x1 - r.x0, r.z1 - r.z0, 1);
      if (at === 'floor') mesh.rotation.x = -Math.PI / 2;
      else if (at === 'left') mesh.rotation.y = Math.PI / 2;
      poseOnSurface(mesh, at, r, built.elev + 0.03, 0.02);
      this.overlay.add(mesh);
    }
  }

  /**
   * Which standing furniture is in front of the Blobbi this frame: nearer the
   * open corner and overlapping it on screen. Those are drawn over it.
   */
  /** Nothing is drawn over the page's Blobbis (there are none): every piece back to the plain pass. */
  private clearFront(): boolean {
    for (const built of this.built.values()) {
      if (built.front) {
        built.front = false;
        setFront(built.root, false);
      }
    }
    return false;
  }

  private classifyFront(): boolean {
    const actors = [...this.actors.values()].filter((a) => a.visible);
    const fronts = new Set<number>();
    for (const built of this.built.values()) {
      if (built.item.placement.at !== 'floor' || built.item.mount === 'rug') continue;
      const r = built.rect;
      let rect: ReturnType<RoomScene['screenRect']> | null = null;
      for (const b of actors) {
        if (!inFrontOf(r, b, b.tiles * BODY_HALF_WIDTH)) continue;
        const body = this.actorScreenBox(b, BODY_HALF_WIDTH, 1);
        if (!body) continue;
        rect ??= this.screenRect(built.box);
        if (rect.x1 > body.x0 && rect.x0 < body.x1 && rect.y1 > body.y0 && rect.y0 < body.y1) {
          fronts.add(built.item.index);
          break;
        }
      }
    }
    // The overlay is drawn over the whole room, so a piece standing in front of
    // one on it goes on it too, or the piece behind would cover it (the bed
    // over its nightstand). Repeats until nothing more is pulled in.
    if (fronts.size) {
      const standing = [...this.built.values()].filter((b) => b.item.placement.at === 'floor' && b.item.mount !== 'rug' && b.stackedOn === undefined);
      const rects = new Map(standing.map((b) => [b, this.screenRect(b.box)]));
      for (let grew = true; grew;) {
        grew = false;
        for (const q of standing) {
          if (fronts.has(q.item.index)) continue;
          const qs = rects.get(q)!;
          const covers = standing.some((p) => {
            if (!fronts.has(p.item.index) || !nearerThan(q.rect, p.rect)) return false;
            const ps = rects.get(p)!;
            return qs.x1 > ps.x0 && qs.x0 < ps.x1 && qs.y1 > ps.y0 && qs.y0 < ps.y1;
          });
          if (covers) {
            fronts.add(q.item.index);
            grew = true;
          }
        }
      }
    }
    let any = false;
    for (const built of this.built.values()) {
      // Whatever stands on a piece drawn over the Blobbi is drawn over it too,
      // or the piece would cover it
      const front = fronts.has(built.item.index) || (built.stackedOn !== undefined && fronts.has(built.stackedOn));
      if (front !== built.front) {
        built.front = front;
        setFront(built.root, front);
      }
      any ||= front;
    }
    return any;
  }

  private screenRect(box: THREE.Box3) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const p = this.toScreen(new THREE.Vector3(x, y, z));
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    return { x0, y0, x1, y1 };
  }

  // ─── Clocks ────────────────────────────────────────────────────────────────

  private syncClockTimer() {
    const hasClock = [...this.built.values()].some((b) => b.clock);
    if (hasClock && !this.clockTimer) {
      this.clockTimer = setInterval(() => this.requestRender(), 15_000);
    } else if (!hasClock && this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = undefined;
    }
  }

  private updateClocks() {
    const now = new Date();
    const minutes = now.getMinutes() + now.getSeconds() / 60;
    const hours = (now.getHours() % 12) + minutes / 60;
    const label = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    for (const built of this.built.values()) {
      const clock = built.clock;
      if (!clock) continue;
      if ('hour' in clock) {
        if (clock.minute.rotation.z !== -(minutes / 60) * Math.PI * 2) this.shadowsDirty = true;
        clock.hour.rotation.z = -(hours / 12) * Math.PI * 2;
        clock.minute.rotation.z = -(minutes / 60) * Math.PI * 2;
      } else if (clock.canvas.dataset.label !== label) {
        const ctx = clock.canvas.getContext('2d');
        if (!ctx) continue;
        const { width, height } = clock.canvas;
        ctx.fillStyle = clock.paper;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = clock.ink;
        ctx.shadowColor = clock.ink;
        ctx.shadowBlur = height * 0.12;
        ctx.font = `700 ${Math.round(height * 0.72)}px ui-monospace, "SF Mono", Menlo, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, width / 2, height * 0.54);
        clock.canvas.dataset.label = label;
        clock.texture.needsUpdate = true;
      }
    }
  }

  // ─── Render loop ───────────────────────────────────────────────────────────

  /** Pose the room's fold-in; returns whether it's still playing. */
  private applyIntro(now: number): boolean {
    const folds = this.folds;
    if (!folds) return false;
    const t = this.introStart === null ? Infinity : now - this.introStart;
    const phase = ([from, to]: readonly [number, number]) => Math.max(0, Math.min(1, (t - from) / (to - from)));

    const INTRO = this.introTiming;
    const floor = easeOut(phase(INTRO.floor));
    folds.floor.scale.set(Math.max(0.001, floor), 1, Math.max(0.001, floor));
    folds.floor.visible = floor > 0.02;
    // Walls hinge up from lying flat outside the room
    const left = phase(INTRO.left);
    folds.left.rotation.z = (Math.PI / 2) * (1 - easeOutBack(left));
    folds.left.visible = left > 0;
    const right = phase(INTRO.right);
    folds.right.rotation.x = -(Math.PI / 2) * (1 - easeOutBack(right));
    folds.right.visible = right > 0;

    const playing = t < INTRO.right[1];
    if (!playing) this.introStart = null;
    return playing;
  }

  /**
   * The build (a first visit's full fold-in) has played to its end in front
   * of the player: the floor and walls folded up and every piece popped up,
   * not held by a scrubber, not skipped in a hidden tab. Reported once; a
   * quick fold-in is not an introduction and reports nothing.
   */
  private checkIntroDone() {
    if (this.introMode !== 'build' || this.introPending || this.introStart !== null || this.introHeld !== null || this.introInterrupted) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    for (const built of this.built.values()) if (built.popStart !== undefined) return;
    this.introMode = 'none';
    this.onIntroDone?.();
  }

  /**
   * The browser took the context away and three has not heard yet (the event
   * comes a task later): compiling now would ask iOS Safari for shaders it
   * answers with null, a TypeError thrown into whoever asked for the frame.
   * The page's `webglcontextlost` listener makes the room again.
   */
  private contextLost(): boolean {
    return this.renderer.getContext().isContextLost();
  }

  requestRender() {
    if (this.disposed || this.frame || this.compiling || this.contextLost()) return;
    // New materials compile off the main thread first (KHR_parallel_shader_compile);
    // the previous frame stays up meanwhile
    if (this.needsCompile && this.geometry && this.layout) {
      this.needsCompile = false;
      this.compiling = true;
      this.camera.layers.enableAll();
      this.renderer.compileAsync(this.scene, this.camera)
        .catch(() => undefined)
        .finally(() => {
          this.compiling = false;
          // The fold-in starts when the room can actually be drawn; later
          // compiles (a model arriving mid-fold) don't restart it
          const now = performance.now();
          const delay = this.introPending && this.introStart !== null ? now - this.introStart : 0;
          this.introPending = false;
          if (delay > 0) {
            this.introStart = now;
            for (const built of this.built.values()) if (built.popStart !== undefined) built.popStart += delay;
          }
          this.requestRender();
        });
      return;
    }
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.renderFrame();
    });
  }

  private renderFrame() {
    if (!this.geometry || !this.layout || this.disposed || this.contextLost()) return;
    const now = performance.now();
    this.idleAnimating = false;
    // The fold-in's own clock: held by a scrubber, or running
    const introNow = this.introHeld !== null && this.introStart !== null ? this.introStart + this.introHeld : now;
    // The first frame after a rest counts as one frame's worth
    const dt = Math.min(0.1, this.lastFrame ? (now - this.lastFrame) / 1000 : 1 / 60);
    this.lastFrame = now;
    let animating = false;

    // Ease parallax, the editing camera, and sleep
    const px = this.parallaxTarget.x - this.parallax.x;
    const py = this.parallaxTarget.y - this.parallax.y;
    if (Math.abs(px) > 0.001 || Math.abs(py) > 0.001) {
      const k = easeBy(dt, PARALLAX_EASE);
      this.parallax.x += px * k;
      this.parallax.y += py * k;
      animating = true;
    }
    const editTarget = this.editing ? 1 : 0;
    if (this.editT !== editTarget) {
      this.editT = Math.abs(editTarget - this.editT) < 0.01 ? editTarget : this.editT + (editTarget - this.editT) * Math.min(1, dt * 7);
      animating = true;
    }
    if (this.zoomShown !== this.zoom) {
      const dz = this.zoom - this.zoomShown;
      this.zoomShown = Math.abs(dz) < 0.002 ? this.zoom : this.zoomShown + dz * easeBy(dt, ZOOM_EASE);
      this.updateCamera();
      animating = true;
    }
    if (Math.abs(this.sleepTarget - this.sleeping) > 0.001) {
      this.sleeping += (this.sleepTarget - this.sleeping) * easeBy(dt, SLEEP_EASE);
      animating = true;
    } else {
      this.sleeping = this.sleepTarget;
    }
    this.updateCamera();

    // Lights: dim and cool at night and when asleep; lamps glow brighter
    const dark = Math.max(this.sleeping, (1 - daylight()) * 0.55);
    this.hemi.intensity = 2.1 - 1.5 * dark;
    this.hemi.color.set('#ffffff').lerp(new THREE.Color('#9fb2ff'), dark);
    this.key.intensity = 1.6 - 1.3 * dark;
    for (const b of this.built.values()) {
      const l = b.lamp;
      if (!l || l.level === (l.on ? 1 : 0)) continue;
      const step = easeBy(dt, LAMP_EASE);
      l.level += ((l.on ? 1 : 0) - l.level) * step;
      if (Math.abs(l.level - (l.on ? 1 : 0)) < 0.01) l.level = l.on ? 1 : 0;
      else animating = true;
      // Bulbs go dark with the lamp, keeping a trace of their colour; their halos fade out
      for (const bulb of b.bulbs ?? []) {
        (bulb.mesh.material as THREE.MeshBasicMaterial).color.copy(bulb.color).multiplyScalar(0.3 + 0.7 * l.level);
        (bulb.halo.material as THREE.MeshBasicMaterial).opacity = HALO_OPACITY * l.level;
      }
      if (b.shade) {
        (b.shade.material as THREE.MeshBasicMaterial).opacity = SHADE_GLOW * l.level;
        b.shade.visible = l.level > 0;
      }
    }
    const lit = [...this.built.values()].flatMap((b) => (b.lamp && b.lamp.intensity > 0 && b.lamp.level > 0 && b.popStart === undefined ? [b.lamp] : []));
    // The lights are pooled: with more lamps lit than lights, the strongest get
    // them, in a fixed order, so lights never jump between lamps as the Blobbi moves
    if (lit.length > this.lamps.length) lit.sort((a, b) => b.intensity - a.intensity);
    this.lamps.forEach((lamp, i) => {
      // Fewer lights drawn at lower quality (the bulbs and their halos still glow)
      const source = i < this.quality.lamps ? lit[i] : undefined;
      lamp.intensity = source ? source.intensity * source.level * 6 * (1 + dark * 1.5) : 0;
      if (!source) return;
      lamp.position.copy(source.world);
      lamp.color.copy(source.color);
    });

    if (this.applyIntro(introNow)) {
      animating = true;
      this.shadowsDirty = true;
    }

    // Pop-up: pieces fold up from the floor with a springy squash; a poke squashes once
    for (const built of this.built.values()) {
      let sx = 1, sy = 1;
      if (built.popStart !== undefined) {
        const t = (introNow - built.popStart) / this.introTiming.pop;
        if (t <= 0) {
          sy = 0.001;
          animating = true;
        } else if (t < 1) {
          const k = easeOutBack(t);
          sx = 1 + (1 - k) * 0.25;
          sy = Math.max(0.001, k);
          animating = true;
        } else {
          built.popStart = undefined;
        }
        this.shadowsDirty = true;
      }
      if (built.pokeStart !== undefined) {
        const t = (now - built.pokeStart) / POKE_DURATION;
        if (t < 1) {
          const k = Math.sin(t * Math.PI) * (1 - t);
          sx *= 1 + k * 0.18;
          sy *= 1 - k * 0.22;
          animating = true;
        } else {
          built.pokeStart = undefined;
        }
        this.shadowsDirty = true;
      }
      // Under the pointer: a small lift (it answers before it is touched); pressed: it gives under the finger
      const wantHover = this.hovered === built.item.index && !this.editing ? 1 : 0;
      const hover = built.hover ?? 0;
      if (Math.abs(wantHover - hover) > 0.001) {
        built.hover = this.reducedMotion ? wantHover : hover + (wantHover - hover) * Math.min(1, dt * 14);
        animating = true;
        this.shadowsDirty = true;
      } else built.hover = wantHover;
      if (!this.reducedMotion) {
        sy *= 1 + 0.04 * (built.hover ?? 0);
        if (built.pressed) {
          sx *= 1.03;
          sy *= 0.95;
        }
      }
      // Floor pieces only bulge into spare room on their tiles, never through
      // a wall or into a neighbour
      if (sx > 1 && built.item.placement.at === 'floor') {
        const r = built.rect;
        const b = built.box;
        const spare = Math.min((r.x1 - r.x0) / Math.max(b.max.x - b.min.x, 1e-6), (r.z1 - r.z0) / Math.max(b.max.z - b.min.z, 1e-6));
        sx = Math.min(sx, Math.max(1, spare));
      }
      built.root.scale.set(sx, sy, sx);
      // Hidden while squashed flat, where it would flicker against the floor
      built.root.visible = sy > 0.05;
    }

    this.checkIntroDone();
    this.placeHoverRing();
    if (this.stepActors(dt)) animating = true;
    if (this.placeActorProxies(dt)) animating = true;
    if (this.stepProps(dt, now)) animating = true;
    if (this.bath) {
      this.updateBathAnchor();
      if (this.bath.layer.step(dt)) animating = true;
    }
    this.updateClocks();

    // Furniture in front of the Blobbi is also drawn to the overlay canvas, over it.
    // That pass only sees layer 1, so it keeps the last shadow map rather than
    // rebuilding it from the front pieces alone.
    const ctx = this.fgContext;
    // Only a Blobbi drawn by the page (the 2D drawing, a visitor) needs furniture drawn over it; a 3D model is
    // hidden by depth like anything else, so with none drawn by the page the second pass is skipped altogether
    const domDrawn = [...this.actors.values()].some((a) => a.visible && !(a.model && a.modelDrawn));
    // The bath's near walls, water, foam and tools cover the page's drawing in the tub the way depth covers the model
    this.bath?.layer.setFrontForDom(domDrawn);
    const hasFront = (domDrawn ? this.classifyFront() : this.clearFront()) || this.classifyPropsFront(domDrawn) || (this.bath?.layer.onFront ?? false);
    if (ctx) {
      ctx.clearRect(0, 0, this.fgCanvas.width, this.fgCanvas.height);
      if (hasFront) {
        this.renderer.shadowMap.needsUpdate = false;
        this.camera.layers.set(1);
        this.renderer.render(this.scene, this.camera);
        ctx.drawImage(this.renderer.domElement, 0, 0, this.fgCanvas.width, this.fgCanvas.height);
      }
    }

    // Shadow map once per frame at most, only when a caster moved, from every caster
    if (this.shadowsDirty) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowsDirty = false;
    }
    this.camera.layers.set(0);
    this.renderer.render(this.scene, this.camera);
    // A model on this frame is on screen: from here its DOM drawing may step aside (onFrame sees it at once)
    for (const b of this.actors.values()) if (b.model) b.modelDrawn = true;

    this.onFrame?.();
    const cost = performance.now() - now;
    this.perf.frames += 1;
    if (!animating && this.idleAnimating) this.perf.idleFrames += 1;
    this.perf.cpuMs = cost;
    // Sustained slowness while something moves (a real frame interval, not the idle rate's) lowers quality
    if (this.lastFrameAt > 0 && this.monitor.frame(now - this.lastFrameAt, animating, now)) this.onSlow?.();
    this.lastFrameAt = now;
    this.perf.cpuSamples.push(cost);
    if (this.perf.cpuSamples.length > 240) this.perf.cpuSamples.shift();
    if (animating) this.requestRender();
    else if (this.idleAnimating) this.requestIdleRender();
    else this.lastFrame = 0;
  }

  /** The next frame of idle life only: a little later than the next vsync, and none at all in a hidden tab. */
  private requestIdleRender() {
    if (this.idleTimer || this.disposed) return;
    if (typeof document !== 'undefined' && document.hidden) {
      this.lastFrame = 0;
      return;
    }
    this.idleTimer = setTimeout(() => {
      this.idleTimer = undefined;
      this.requestRender();
    }, Math.max(IDLE_FRAME_MS, 1000 / this.quality.idleFps) - 4);
  }

  /**
   * Development measurements: frames drawn so far (and how many were idle life only), the last frame's
   * main-thread cost and its recent average and 95th percentile (ms), and the renderer's own counts (draw calls,
   * triangles, live geometries, textures, shader programs).
   */
  stats() {
    const samples = [...this.perf.cpuSamples].sort((a, b) => a - b);
    const avg = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
    const p95 = samples.length ? samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))] : 0;
    const info = this.renderer.info;
    const canvas = this.renderer.domElement;
    return {
      pixelRatio: this.renderer.getPixelRatio(),
      canvas: [canvas.width, canvas.height] as [number, number],
      quality: this.quality.level,
      frames: this.perf.frames,
      idleFrames: this.perf.idleFrames,
      cpuMs: this.perf.cpuMs,
      cpuAvgMs: avg,
      cpuP95Ms: p95,
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
    };
  }
}

