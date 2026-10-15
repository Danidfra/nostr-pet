/**
 * The bath in the 3D room, drawn: what the scene builds while a bath is on
 * (`RoomScene.setBath`), from the same machine state the 2D home draws
 * from (`features/bath`), so the two are one game with two pictures.
 *
 *   the tub      the official tub's model steps aside and a HOLLOW tub stands
 *                on its footprint: a floor slab, four walls, a rim and four
 *                feet, so the Blobbi can really be in it, with the water
 *                inside (a translucent plane lapping the body) and a few suds
 *                while the soap is on. The walls nearer the camera and the
 *                water are also drawn on the overlay pass (layer 1) when the
 *                Blobbi is the page's drawing, so they cover its lower body
 *                the way depth covers the 3D model's.
 *   the foam     one small sphere per lathered cell of the body grid, on the
 *                body's front (instanced: one draw call), growing with the
 *                lather; gone with the rinse.
 *   the rain     drops falling from the shower head to the water while it
 *                is held, with a splash where they land.
 *   the tools    the soap, the shower head and the towel as small procedural
 *                meshes, at the pointer (mapped into the body's box like the
 *                foam) or resting beside the body with a slow bob.
 *
 * The body's box: x across the Blobbi (0 left, 1 right), y up from the box's
 * bottom (0) to its top (1); the outline says where its feet and top are in
 * the box, so a cell lands on the body as it does on the drawing. Everything
 * is in tiles, in world space, built from the tub's footprint and the
 * Blobbi's place; nothing here knows the DOM, React or the relays.
 */
import * as THREE from 'three';
import type { BathPoint, BathTool } from '@/features/bath/bath-machine';
import type { BathFrame } from '@/features/bath/bath-frame';
import { CAMERA_AZIMUTH } from '../room-geometry';

/** The tool's place in the body's box while pressed, or null (resting). */
const pointerOf = (frame: BathFrame): BathPoint | null => (frame.tool?.pressed ? frame.tool.at : null);

/** The tub's footprint (tiles) the scene hands over. */
export interface BathTubRect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** The actor the foam sits on: where it stands, how tall its box is. */
export interface BathActorPlace {
  x: number;
  z: number;
  elev: number;
  tiles: number;
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

const RIGHT = new THREE.Vector3(Math.cos(CAMERA_AZIMUTH), 0, -Math.sin(CAMERA_AZIMUTH));
const TOWARD_CAMERA = new THREE.Vector3(Math.sin(CAMERA_AZIMUTH), 0, Math.cos(CAMERA_AZIMUTH));

const SHELL = '#f4f7fb';
const SHELL_SHADE = '#d9e3ee';
const WATER = '#7dd3fc';
const FOAM_MAX = 64;
const DROPS = 28;

/** The tools' resting places in the body's box while nothing is pressed. */
const RESTING: Readonly<Record<BathTool, BathPoint>> = { soap: { x: 1.08, y: 0.42 }, shower: { x: 0.5, y: 1.12 }, towel: { x: -0.08, y: 0.45 } };

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
  /** The tub's walls nearer the camera and the water: drawn over the page's drawing too. */
  private frontParts = new THREE.Group();
  private backParts = new THREE.Group();
  private water: THREE.Mesh;
  private suds: THREE.Mesh[] = [];
  private foam: THREE.InstancedMesh;
  private drops: THREE.InstancedMesh;
  private splash: THREE.InstancedMesh;
  private tools: Record<BathTool, THREE.Group>;
  private state: BathFrame | null = null;
  /** No tub: a ritual played where the Blobbi stands (only the foam, the rain and the tools). */
  private readonly tubless: boolean;
  private actor: BathActorPlace | null = null;
  private time = 0;
  private dropPhase = new Float32Array(DROPS);
  private front = false;
  private readonly scratch = { m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };

  constructor(tub: BathTubRect | null, private readonly reducedMotion: () => boolean) {
    this.tubless = tub === null;
    // Placeholder (M15 care contract): a ritual in place builds the tub's parts too, hidden, so the rest is unchanged
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
    // Every mesh that may go on the overlay pass receives shadows: WebKit's GL rejects a draw there from a program
    // compiled without shadow sampling ("mismatch between texture format and sampler type"), and every piece of
    // furniture that pass draws receives them already
    this.water.receiveShadow = true;
    this.frontParts.add(this.water);
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
      this.frontParts.add(sud);
    }
    // The foam on the body: one instance per cell, hidden until lathered
    this.foam = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 }), FOAM_MAX);
    this.foam.castShadow = false;
    this.foam.receiveShadow = true;
    this.foam.count = FOAM_MAX;
    this.foam.frustumCulled = false;
    this.hideAll(this.foam);
    // The shower's rain and the splash where it lands
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
    this.root.add(this.backParts, this.frontParts, this.foam, this.drops, this.splash, ...Object.values(this.tools));
    setFront(this.backParts, false);
    if (this.tubless) {
      this.backParts.visible = false;
      this.frontParts.visible = false;
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

  /** The bath as it stands now, and where the Blobbi is; redraws the foam, the suds, the tools. */
  update(state: BathFrame, actor: BathActorPlace) {
    this.state = state;
    this.actor = actor;
    const { m, p, q, s } = this.scratch;
    q.identity();
    // The foam: a sphere on each lathered cell, growing with the lather
    const cellTiles = actor.tiles / state.grid;
    for (let i = 0; i < FOAM_MAX; i++) {
      const f = state.cells[i]?.foamed ? 1 : 0;
      if (f === 0) {
        m.makeScale(0, 0, 0);
      } else {
        const r = cellTiles * (0.22 + 0.36 * Math.min(1, f));
        this.bodyPoint({ x: (i % state.grid + 0.5) / state.grid, y: (Math.floor(i / state.grid) + 0.5) / state.grid }, p, r * 0.4);
        s.set(r, r * 0.9, r);
        m.compose(p, q, s);
      }
      this.foam.setMatrixAt(i, m);
    }
    this.foam.instanceMatrix.needsUpdate = true;
    const soapy = state.stage?.id === 'lather' || state.stage?.id === 'rinse' || state.stage?.id === 'play';
    for (const sud of this.suds) sud.visible = soapy;
    // The tool in hand: the stage's, at the pointer or resting; the others away
    const kindNow = state.tool?.kind ?? null;
    const pointer = pointerOf(state);
    for (const [kind, tool] of Object.entries(this.tools) as [BathTool, THREE.Group][]) tool.visible = kind === kindNow;
    if (kindNow) {
      const at = pointer ?? RESTING[kindNow];
      const tool = this.tools[kindNow];
      this.bodyPoint(at, tool.position, 0.35);
      if (kindNow === 'shower') tool.position.y += actor.tiles * 0.12;
      tool.rotation.set(0, CAMERA_AZIMUTH, 0);
      if (kindNow === 'soap' && pointer) tool.rotation.z = -0.25;
      if (kindNow === 'towel' && pointer) tool.rotation.z = 0.2;
    }
    if (!pointer || state.stage?.kind !== 'rinse') {
      this.hideAll(this.drops);
      this.hideAll(this.splash);
    }
  }

  /** Whose drawing is over the room: the page's (the tub's near walls, the water and the foam go on the overlay pass) or none. */
  setFrontForDom(dom: boolean) {
    if (this.front === dom) return;
    this.front = dom;
    // In place, the page's drawing has the ritual on its own layer; the scene draws it only on the model
    if (this.tubless) this.root.visible = !dom;
    setFront(this.frontParts, dom);
    setFront(this.foam, dom);
    setFront(this.drops, dom);
    setFront(this.splash, dom);
    for (const tool of Object.values(this.tools)) setFront(tool, dom);
  }

  /** Whether anything of the bath is on the overlay pass this frame. */
  get onFront(): boolean {
    return this.front;
  }

  /** A frame: the rain falls, the water ripples, a resting tool bobs. True while something moves. */
  step(dt: number): boolean {
    const state = this.state;
    const actor = this.actor;
    if (!state || !actor) return false;
    const still = this.reducedMotion();
    if (!still) this.time += dt;
    let animating = false;
    const { m, p, q, s } = this.scratch;
    q.identity();
    // The rain: from the shower head down to the water, each drop on its own phase
    const raining = state.stage?.kind === 'rinse' && pointerOf(state) !== null && state.tool?.kind === 'shower';
    if (raining) {
      const head = this.tools.shower.position;
      const waterY = BATH_TUB.foot + BATH_TUB.water;
      const fall = Math.max(0.2, head.y - 0.1 - waterY);
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
        p.set(head.x + (i - 1.5) * actor.tiles * 0.09, waterY + 0.01, head.z + Math.cos(i) * 0.08);
        const r = 0.05 + t * 0.14;
        s.set(r, r, r * 0.3);
        m.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), s);
        this.splash.setMatrixAt(i, m);
      }
      this.splash.instanceMatrix.needsUpdate = true;
      animating = !still;
    }
    // The water ripples a little under the shower; the suds drift
    if (!still) {
      this.water.position.y = BATH_TUB.foot + BATH_TUB.water + (state.stage?.kind === 'rinse' || state.stage?.kind === 'timed' ? Math.sin(this.time * 6) * 0.012 : 0);
      for (let i = 0; i < this.suds.length; i++) if (this.suds[i].visible) this.suds[i].position.y = BATH_TUB.foot + BATH_TUB.water + 0.01 + Math.sin(this.time * 2 + i) * 0.008;
      if (state.stage?.kind === 'rinse' || state.stage?.kind === 'timed') animating = true;
    }
    // A resting tool bobs, inviting the hand
    if (!still && state.tool && !pointerOf(state)) {
      const tool = this.tools[state.tool.kind];
      this.bodyPoint(RESTING[state.tool.kind], tool.position, 0.35);
      if (state.tool.kind === 'shower') tool.position.y += actor.tiles * 0.12;
      tool.position.y += Math.sin(this.time * 2.2) * 0.05;
      tool.rotation.z = Math.sin(this.time * 1.6) * 0.12;
      animating = true;
    }
    return animating;
  }

  dispose() {
    dispose(this.root);
  }
}
