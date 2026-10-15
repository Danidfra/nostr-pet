/**
 * The care ritual in the 3D room, drawn: what the scene builds while one is
 * on (`RoomScene.setBath(frame, anchor)`), from the same frame the 2D home
 * draws from (`features/bath/bath-frame.ts`), so the two are one game with
 * two pictures. The frame decides everything; nothing here counts.
 *
 *   the tub      (a soak) the official tub's model steps aside and a HOLLOW
 *                tub stands on its footprint: a floor slab, four walls, a rim
 *                and four feet, so the Blobbi can really be in it, with the
 *                water inside (a translucent plane lapping the body) and a
 *                few suds. With the page's Classic drawing in it, the walls
 *                and rim nearer the camera are drawn on the overlay pass
 *                (layer 1) over the drawing, the way the 2D home's front
 *                layer stands over the actor; the water never is, it stays
 *                behind the drawing (on the overlay it drowned it).
 *   the surface  once per ritual, every body cell is sampled off the model's
 *                own meshes (`bath-fx/surface.ts`; the procedural shape when
 *                no model stands there): the foam sits on those points, the
 *                drops run between them.
 *   the foam     one small sphere per foamed cell, exactly those, on the
 *                sampled surface (instanced: one draw call); the shampoo's
 *                lather is tinted and denser (a second, smaller bead each).
 *   the water    beads running down the body in step with `wetness`, let go
 *                at its lowest point, falling and splashing on the floor
 *                (`bath-fx/droplets.ts`, two draw calls); the shower's rain
 *                from the head to where it meets the body; a wet sheen on the
 *                model's materials, restored exactly after (`bath-fx/wet-look.ts`).
 *   the cues     `splash-in` / `splash-out`: drops flung up from the water;
 *                `shake`: the model wobbles about its feet and flings a ring
 *                of drops. Each once per cue id.
 *   the tools    the soap, the shower head and the towel as small meshes at
 *                the frame's point, resting with a slow bob.
 *
 * With the page's drawing on screen (Classic) the body's effects are the DOM
 * layer's (`BathEffects2D`): nothing on the body is drawn here then, only the
 * tub. Reduced motion stills the water, draws no beads and no wobble, and
 * keeps the foam, the sheen and the tub's state. Everything is in tiles, in
 * world space; nothing here knows the DOM, React or the relays.
 */
import * as THREE from 'three';
import type { BathPoint, BathTool } from '@/features/bath/bath-machine';
import { cuesAfter, type BathFrame } from '@/features/bath/bath-frame';
import { CAMERA_AZIMUTH } from '../room-geometry';
import { sampleBodySurface, surfacePoint, type BodySurface, type SurfaceBasis } from './bath-fx/surface';
import { Droplets } from './bath-fx/droplets';
import { WetLook } from './bath-fx/wet-look';

/** The tool's place in the body's box while pressed, or null (resting). */
const pointerOf = (frame: BathFrame): BathPoint | null => (frame.tool?.pressed ? frame.tool.at : null);

/** The tub's footprint (tiles) the scene hands over. */
export interface BathTubRect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** The actor the ritual is on: where it stands, how tall its box is, and what stands there to sample and to wobble. */
export interface BathActorPlace {
  x: number;
  z: number;
  elev: number;
  tiles: number;
  /** The 3D model's root when one draws the Blobbi (sampled, made glossy, wobbled); null for the page's drawing. */
  model?: THREE.Object3D | null;
  /** The procedural body's shape (the scene's shadow caster), sampled when there is no model. */
  proxy?: THREE.Object3D | null;
}

/** The hollow tub's measures, in tiles. */
export const BATH_TUB = {
  wall: 0.14,
  height: 1.6,
  floor: 0.3,
  /** The water's surface above the floor slab. */
  water: 1.25,
  rim: 0.08,
  foot: 0.13,
} as const;

/** Where the Blobbi's feet stand inside the tub (tiles above the floor): on its floor slab. */
export const BATH_ELEV = BATH_TUB.floor + 0.02;

/** How long the shake-dry wobbles (s), the machine's `SHAKE_MS`. */
export const SHAKE_S = 0.7;

const RIGHT = new THREE.Vector3(Math.cos(CAMERA_AZIMUTH), 0, -Math.sin(CAMERA_AZIMUTH));
const TOWARD_CAMERA = new THREE.Vector3(Math.sin(CAMERA_AZIMUTH), 0, Math.cos(CAMERA_AZIMUTH));
const BASIS: SurfaceBasis = { right: RIGHT, toward: TOWARD_CAMERA };

const SHELL = '#f4f7fb';
const SHELL_SHADE = '#d9e3ee';
const WATER = '#7dd3fc';
const FOAM_SOAP = '#ffffff';
const FOAM_SHAMPOO = '#ecdcff';
/** Up to two beads per cell (the shampoo's denser lather). */
const FOAM_MAX = 128;
const DROPS = 28;

/** Everything stays on layer 0; what should cover the page's drawing is on layer 1 too. */
function setFront(root: THREE.Object3D, front: boolean) {
  root.traverse((child) => {
    child.layers.set(0);
    if (front) child.layers.enable(1);
  });
}

function dispose(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh && !(child as THREE.InstancedMesh).isInstancedMesh) return;
    mesh.geometry.dispose();
    const materials: THREE.Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of materials) m.dispose();
  });
}

export class BathLayer {
  /** Everything of the bath, in world space. */
  readonly root = new THREE.Group();
  /** The tub's walls, rim and feet nearer the camera: drawn over the page's drawing too. */
  readonly frontParts = new THREE.Group();
  readonly backParts = new THREE.Group();
  /** The water and its suds: behind the page's drawing, never on the overlay pass. */
  readonly waterParts = new THREE.Group();
  /** What is laid on the body (the foam, the rain, the beads, the tools): the DOM layer's when the page draws the Blobbi. */
  readonly bodyFx = new THREE.Group();
  private water: THREE.Mesh;
  private suds: THREE.Mesh[] = [];
  readonly foam: THREE.InstancedMesh;
  private drops: THREE.InstancedMesh;
  private splash: THREE.InstancedMesh;
  private tools: Record<BathTool, THREE.Group>;
  readonly droplets = new Droplets();
  readonly wet = new WetLook();
  private state: BathFrame | null = null;
  /** No tub: a ritual played where the Blobbi stands (only what is laid on the body). */
  private readonly tubless: boolean;
  private actor: BathActorPlace | null = null;
  private time = 0;
  private dropPhase = new Float32Array(DROPS);
  private front = false;
  private surface: BodySurface | null = null;
  private surfaceFor: { key: number; tiles: number; body: THREE.Object3D | null } | null = null;
  private raycaster = new THREE.Raycaster();
  private lastCue = 0;
  private cueKey = -1;
  /** A shake under way: how far into it (s). */
  private shake: number | null = null;
  private readonly feet = new THREE.Vector3();
  private readonly scratch = { m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), roll: new THREE.Quaternion(), z: new THREE.Vector3(0, 0, 1) };

  constructor(tub: BathTubRect | null, private readonly reducedMotion: () => boolean) {
    this.tubless = tub === null;
    // A ritual in place builds the tub's parts too, hidden, so the rest is one code path
    const rect = tub ?? { x0: 0, x1: 2, z0: 0, z1: 2 };
    const shell = new THREE.MeshStandardMaterial({ color: SHELL, roughness: 0.85 });
    const shade = new THREE.MeshStandardMaterial({ color: SHELL_SHADE, roughness: 0.9 });
    const w = rect.x1 - rect.x0;
    const d = rect.z1 - rect.z0;
    const cx = (rect.x0 + rect.x1) / 2;
    const cz = (rect.z0 + rect.z1) / 2;
    const t = BATH_TUB.wall;
    const h = BATH_TUB.height;
    const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, material: THREE.Material, into: THREE.Group) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      into.add(mesh);
      return mesh;
    };
    // The floor slab and the far walls (x0 and z0 sides are away from the camera, which looks from +x, +z)
    box(w - 2 * t, BATH_TUB.floor, d - 2 * t, cx, BATH_TUB.floor / 2 + BATH_TUB.foot, cz, shade, this.backParts);
    box(t, h, d, rect.x0 + t / 2, h / 2 + BATH_TUB.foot, cz, shell, this.backParts);
    box(w, h, t, cx, h / 2 + BATH_TUB.foot, rect.z0 + t / 2, shell, this.backParts);
    // The near walls, drawn over the page's drawing too
    box(t, h, d, rect.x1 - t / 2, h / 2 + BATH_TUB.foot, cz, shell, this.frontParts);
    box(w, h, t, cx, h / 2 + BATH_TUB.foot, rect.z1 - t / 2, shell, this.frontParts);
    // The rim: a lip round the top, a little wider than the walls
    const rimY = BATH_TUB.foot + h + BATH_TUB.rim / 2;
    box(t * 1.6, BATH_TUB.rim, d + t * 0.6, rect.x0 + t / 2, rimY, cz, shell, this.backParts);
    box(w + t * 0.6, BATH_TUB.rim, t * 1.6, cx, rimY, rect.z0 + t / 2, shell, this.backParts);
    box(t * 1.6, BATH_TUB.rim, d + t * 0.6, rect.x1 - t / 2, rimY, cz, shell, this.frontParts);
    box(w + t * 0.6, BATH_TUB.rim, t * 1.6, cx, rimY, rect.z1 - t / 2, shell, this.frontParts);
    // Four feet
    const foot = new THREE.SphereGeometry(BATH_TUB.foot, 10, 6);
    const brass = new THREE.MeshStandardMaterial({ color: '#d4a853', roughness: 0.5, metalness: 0.3 });
    for (const [fx, fz] of [[rect.x0 + t, rect.z0 + t], [rect.x1 - t, rect.z0 + t], [rect.x0 + t, rect.z1 - t], [rect.x1 - t, rect.z1 - t]]) {
      const mesh = new THREE.Mesh(foot, brass);
      mesh.position.set(fx, BATH_TUB.foot * 0.7, fz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      (fz > cz || fx > cx ? this.frontParts : this.backParts).add(mesh);
    }
    // The tap on the far wall
    const metal = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.4, metalness: 0.5 });
    const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 10), metal);
    tap.position.set(cx - w * 0.25, BATH_TUB.foot + h + 0.2, rect.z0 + t / 2);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 10), metal);
    spout.rotation.x = Math.PI / 2;
    spout.position.set(cx - w * 0.25, BATH_TUB.foot + h + 0.42, rect.z0 + t / 2 + 0.15);
    this.backParts.add(tap, spout);
    // The water, lapping the body: translucent, over the floor slab, inside the walls
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 2 * t - 0.02, d - 2 * t - 0.02),
      new THREE.MeshStandardMaterial({ color: WATER, roughness: 0.15, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(cx, BATH_TUB.foot + BATH_TUB.water, cz);
    this.water.renderOrder = 2;
    this.water.receiveShadow = true;
    this.waterParts.add(this.water);
    // Suds on the water while the soap is on
    const sudMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
    const sudGeometry = new THREE.SphereGeometry(1, 8, 6);
    for (let i = 0; i < 6; i++) {
      const sud = new THREE.Mesh(sudGeometry, sudMaterial);
      sud.receiveShadow = true;
      const r = 0.09 + ((i * 7) % 4) * 0.025;
      sud.scale.set(r, r * 0.55, r);
      sud.position.set(rect.x0 + t + 0.25 + ((i * 1.7) % (w - 2 * t - 0.5)), BATH_TUB.foot + BATH_TUB.water + 0.01, rect.z0 + t + 0.2 + ((i * 1.1) % (d - 2 * t - 0.4)));
      sud.visible = false;
      this.suds.push(sud);
      this.waterParts.add(sud);
    }
    // The foam on the body: beads on the sampled surface, hidden until lathered
    this.foam = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: FOAM_SOAP, roughness: 0.55 }), FOAM_MAX);
    this.foam.castShadow = false;
    this.foam.receiveShadow = true;
    this.foam.count = FOAM_MAX;
    this.foam.frustumCulled = false;
    this.hideAll(this.foam);
    // The shower's rain and the splash where it meets the body
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshStandardMaterial({ color: WATER, roughness: 0.2, transparent: true, opacity: 0.85 }), DROPS);
    this.drops.frustumCulled = false;
    this.drops.receiveShadow = true;
    this.hideAll(this.drops);
    for (let i = 0; i < DROPS; i++) this.dropPhase[i] = (i * 0.618) % 1;
    this.splash = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.18, 6, 14), new THREE.MeshStandardMaterial({ color: '#e0f2fe', roughness: 0.3, transparent: true, opacity: 0.8 }), 4);
    this.splash.frustumCulled = false;
    this.splash.receiveShadow = true;
    this.hideAll(this.splash);
    this.tools = { soap: this.buildSoap(), shower: this.buildShower(), towel: this.buildTowel() };
    for (const tool of Object.values(this.tools)) {
      tool.visible = false;
      tool.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).receiveShadow = true;
      });
    }
    this.bodyFx.add(this.foam, this.drops, this.splash, this.droplets.mesh, this.droplets.splashes, ...Object.values(this.tools));
    this.root.add(this.backParts, this.frontParts, this.waterParts, this.bodyFx);
    setFront(this.root, false);
    if (this.tubless) {
      this.backParts.visible = false;
      this.frontParts.visible = false;
      this.waterParts.visible = false;
    }
  }

  private hideAll(mesh: THREE.InstancedMesh) {
    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, m);
    mesh.instanceMatrix.needsUpdate = true;
  }

  private buildSoap(): THREE.Group {
    const g = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.3), new THREE.MeshStandardMaterial({ color: '#f9a8d4', roughness: 0.5 }));
    bar.castShadow = true;
    const bubbles = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, transparent: true, opacity: 0.9 });
    const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), bubbles);
    b1.position.set(0.14, 0.17, 0.02);
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), bubbles);
    b2.position.set(0.24, 0.24, -0.04);
    g.add(bar, b1, b2);
    return g;
  }

  private buildShower(): THREE.Group {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.35, metalness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.6 });
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.09, 16), metal);
    head.castShadow = true;
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 16), dark);
    face.position.y = -0.05;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.5, 10), metal);
    handle.position.set(0.12, 0.3, -0.08);
    handle.rotation.z = -0.5;
    handle.rotation.x = 0.3;
    g.add(head, face, handle);
    return g;
  }

  private buildTowel(): THREE.Group {
    const g = new THREE.Group();
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.42), new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.95 }));
    cloth.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.08), new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.9 }));
    stripe.position.set(0, 0.05, 0.1);
    const stripe2 = stripe.clone();
    stripe2.position.z = -0.1;
    g.add(cloth, stripe, stripe2);
    return g;
  }

  /** A point of the body's box in the world: across the actor, up from its feet, out toward the camera over the body's dome. */
  private bodyPoint(p: BathPoint, out: THREE.Vector3, lift = 0): THREE.Vector3 {
    const a = this.actor;
    const o = this.state?.outline ?? { bottom: 0.08, top: 0.92 };
    if (!a) return out.set(0, 0, 0);
    const T = a.tiles;
    const across = (p.x - 0.5) * T * 0.92;
    const up = (p.y - o.bottom) * T;
    const dome = Math.sqrt(Math.max(0, 1 - ((p.x - 0.5) * 2.6) ** 2)) * T * 0.26 + lift;
    out.set(a.x, a.elev + up, a.z);
    out.addScaledVector(RIGHT, across);
    out.addScaledVector(TOWARD_CAMERA, dome);
    return out;
  }

  /** What stands in the Blobbi's place to sample: the model, else the procedural shape. */
  private bodyOf(actor: BathActorPlace): THREE.Object3D | null {
    return actor.model ?? actor.proxy ?? null;
  }

  /** The body's surface for this ritual, sampled once (again if the Blobbi's size or what stands there changed). */
  private ensureSurface(state: BathFrame, actor: BathActorPlace) {
    const body = this.bodyOf(actor);
    const have = this.surfaceFor;
    if (have && have.key === state.key && have.tiles === actor.tiles && have.body === body) return;
    // Never mid-script (a jump): the samples are taken from a standing body
    if (state.stage?.kind === 'script') return;
    this.surface = sampleBodySurface(body, { x: actor.x, z: actor.z, feetY: actor.elev, tiles: actor.tiles }, state, BASIS, this.raycaster);
    this.surfaceFor = { key: state.key, tiles: actor.tiles, body };
  }

  /** The sampled surface (for tests and the lab). */
  surfaceNow(): BodySurface | null {
    return this.surface;
  }

  /** Whether the shake-dry is under way (for tests). */
  get shaking(): boolean {
    return this.shake !== null;
  }

  /** Where the water would catch a drop: the tub's water when the Blobbi stands in the tub, else the floor under its feet. */
  private floorY(actor: BathActorPlace): number {
    if (!this.tubless && actor.elev >= BATH_ELEV - 0.05) return BATH_TUB.foot + BATH_TUB.water;
    return actor.elev;
  }

  /** The bath as it stands now, and where the Blobbi is; redraws the foam, the suds, the tools; plays the new cues. */
  update(state: BathFrame, actor: BathActorPlace) {
    this.state = state;
    this.actor = actor;
    this.feet.set(actor.x, actor.elev, actor.z);
    if (state.key !== this.cueKey) {
      this.cueKey = state.key;
      this.lastCue = 0;
      this.shake = null;
      this.droplets.reset();
      this.surface = null;
      this.surfaceFor = null;
    }
    this.ensureSurface(state, actor);
    const { m, p, q, s } = this.scratch;
    q.identity();
    // The foam: a bead on each foamed cell, on the sampled surface; the shampoo's lather tinted and denser
    const shampoo = state.style === 'shampoo';
    (this.foam.material as THREE.MeshStandardMaterial).color.set(shampoo ? FOAM_SHAMPOO : FOAM_SOAP);
    const cellTiles = actor.tiles / state.grid;
    const cells = state.grid * state.grid;
    for (let i = 0; i < FOAM_MAX; i++) {
      const cell = i % cells;
      const second = i >= cells;
      const foamed = !!state.cells[cell]?.foamed && (!second || shampoo);
      if (!foamed) {
        m.makeScale(0, 0, 0);
      } else {
        const r = cellTiles * (second ? 0.3 : shampoo ? 0.62 : 0.56) * (1 + ((cell * 3) % 3) * 0.06);
        if (this.surface) surfacePoint(this.surface, cell, this.feet, BASIS, r * 0.45, p);
        else this.bodyPoint({ x: (cell % state.grid + 0.5) / state.grid, y: (Math.floor(cell / state.grid) + 0.5) / state.grid }, p, r * 0.4);
        if (second) {
          p.addScaledVector(RIGHT, cellTiles * 0.34);
          p.y += cellTiles * 0.22;
        }
        s.set(r, r * 0.9, r);
        m.compose(p, q, s);
      }
      this.foam.setMatrixAt(i, m);
    }
    this.foam.instanceMatrix.needsUpdate = true;
    const soapy = state.stage?.id === 'lather' || state.stage?.id === 'rinse' || state.stage?.id === 'play';
    for (const sud of this.suds) sud.visible = soapy;
    // The tool in hand: the stage's, at the frame's point; the others away
    const kindNow = state.tool?.kind ?? null;
    const pointer = pointerOf(state);
    for (const [kind, tool] of Object.entries(this.tools) as [BathTool, THREE.Group][]) tool.visible = kind === kindNow;
    if (kindNow && state.tool) {
      const tool = this.tools[kindNow];
      this.bodyPoint(state.tool.at, tool.position, pointer ? 0.35 : 0.55);
      if (kindNow === 'shower') tool.position.y += actor.tiles * 0.12;
      tool.rotation.set(0, CAMERA_AZIMUTH, 0);
      if (kindNow === 'soap' && pointer) tool.rotation.z = -0.25;
      if (kindNow === 'towel' && pointer) tool.rotation.z = 0.2;
    }
    if (!pointer || state.stage?.kind !== 'rinse') {
      this.hideAll(this.drops);
      this.hideAll(this.splash);
    }
    // The wet sheen on the model, as wet as the frame says; back exactly when dry
    this.wet.apply(actor.model ?? null, state.wetness);
    // The cues, each once
    for (const cue of cuesAfter(state, this.lastCue)) {
      this.lastCue = cue.id;
      if (cue.kind === 'shake') {
        this.shake = this.reducedMotion() ? null : 0;
        if (!this.reducedMotion()) {
          p.copy(this.feet).addScaledVector(TOWARD_CAMERA, actor.tiles * 0.12);
          p.y += actor.tiles * 0.42;
          this.droplets.burst(p, 14, actor.tiles * 0.9, 'radial');
        }
      } else if (cue.kind === 'splash-in' || cue.kind === 'splash-out') {
        if (!this.reducedMotion()) {
          p.copy(this.feet);
          p.y = this.tubless ? actor.elev + 0.02 : BATH_TUB.foot + BATH_TUB.water;
          this.droplets.burst(p, 12, actor.tiles * 0.8, 'up');
        }
      }
    }
  }

  /**
   * Whose drawing is over the room: the page's (the tub's near walls go on the overlay pass; the body's effects are
   * the DOM layer's, so nothing of them is drawn here) or none (everything drawn here).
   */
  setFrontForDom(dom: boolean) {
    if (this.front === dom) return;
    this.front = dom;
    // In place, the page's drawing has the ritual on its own layer; the scene draws it only on the model
    if (this.tubless) this.root.visible = !dom;
    setFront(this.frontParts, dom);
    this.bodyFx.visible = !dom;
  }

  /** Whether anything of the bath is on the overlay pass this frame. */
  get onFront(): boolean {
    return this.front && !this.tubless;
  }

  /** A frame: the rain falls, the beads run, the water ripples, a resting tool bobs, the shake wobbles. True while something moves. */
  step(dt: number): boolean {
    const state = this.state;
    const actor = this.actor;
    if (!state || !actor) return false;
    const still = this.reducedMotion();
    if (!still) this.time += dt;
    let animating = false;
    const { m, p, q, s, roll, z } = this.scratch;
    q.identity();
    // The rain: from the shower head down to where it meets the body under it (the floor beside it), each drop on its own phase
    const raining = state.stage?.kind === 'rinse' && pointerOf(state) !== null && state.tool?.kind === 'shower';
    if (raining && state.tool) {
      const head = this.tools.shower.position;
      const col = Math.max(0, Math.min(state.grid - 1, Math.floor(state.tool.at.x * state.grid)));
      const topRow = this.surface ? this.surface.columnTop[col] : -1;
      let landY = this.floorY(actor);
      if (topRow >= 0 && this.surface) landY = Math.max(landY, surfacePoint(this.surface, topRow * state.grid + col, this.feet, BASIS, 0, p).y);
      const fall = Math.max(0.2, head.y - 0.1 - landY);
      for (let i = 0; i < DROPS; i++) {
        const t = still ? this.dropPhase[i] : (this.dropPhase[i] + this.time * 1.6) % 1;
        const spread = actor.tiles * 0.16;
        p.set(head.x + Math.sin(i * 2.4) * spread, head.y - 0.1 - t * fall, head.z + Math.cos(i * 1.7) * spread * 0.6);
        const r = 0.03 + 0.01 * ((i * 3) % 2);
        s.set(r, r * 1.8, r);
        m.compose(p, q, s);
        this.drops.setMatrixAt(i, m);
      }
      this.drops.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < 4; i++) {
        const t = still ? 0.5 : (this.time * 1.3 + i * 0.25) % 1;
        p.set(head.x + (i - 1.5) * actor.tiles * 0.09, landY + 0.01, head.z + Math.cos(i) * 0.08 + actor.tiles * 0.1);
        const r = 0.05 + t * 0.14;
        s.set(r, r, r * 0.3);
        m.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), s);
        this.splash.setMatrixAt(i, m);
      }
      this.splash.instanceMatrix.needsUpdate = true;
      animating = !still;
    }
    // The water ripples a little under the shower and while the Blobbi plays; the suds drift
    if (!still) {
      const lively = state.stage?.kind === 'rinse' || state.stage?.kind === 'timed';
      this.water.position.y = BATH_TUB.foot + BATH_TUB.water + (lively ? Math.sin(this.time * 6) * 0.012 : 0);
      for (let i = 0; i < this.suds.length; i++) if (this.suds[i].visible) this.suds[i].position.y = BATH_TUB.foot + BATH_TUB.water + 0.01 + Math.sin(this.time * 2 + i) * 0.008;
      if (lively) animating = true;
    }
    // A resting tool bobs, inviting the hand
    if (!still && state.tool && !pointerOf(state)) {
      const tool = this.tools[state.tool.kind];
      this.bodyPoint(state.tool.at, tool.position, 0.55);
      if (state.tool.kind === 'shower') tool.position.y += actor.tiles * 0.12;
      tool.position.y += Math.sin(this.time * 2.2) * 0.05;
      tool.rotation.z = Math.sin(this.time * 1.6) * 0.12;
      animating = true;
    }
    // The beads on and off the body (none with the page's drawing: its layer draws them)
    if (this.bodyFx.visible) {
      const wetness = state.status === 'stage' && state.stage?.kind === 'timed' ? 0 : state.wetness;
      if (this.droplets.update(dt, { surface: this.surface, feet: this.feet, basis: BASIS, tiles: actor.tiles, wetness, floorY: this.floorY(actor), still })) animating = true;
    }
    // The shake-dry: the model wobbles about its feet, decaying over SHAKE_S; the actor sets its turn afresh each frame
    if (this.shake !== null) {
      this.shake += dt;
      if (this.shake >= SHAKE_S || still) {
        this.shake = null;
      } else if (actor.model) {
        const k = 1 - this.shake / SHAKE_S;
        const angle = Math.sin(this.shake * 30) * 0.2 * k;
        roll.setFromAxisAngle(z, angle);
        actor.model.quaternion.multiply(roll);
        animating = true;
      }
    }
    return animating;
  }

  dispose() {
    this.wet.restore();
    this.droplets.dispose();
    dispose(this.root);
  }
}
