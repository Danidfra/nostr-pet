/**
 * The water on and off the Blobbi (M15 care, the 3D effects): beads that
 * run down the body from sample to sample along its surface, let go at
 * the lowest body cell under them, fall under gravity and splash on the
 * floor; and the one-shot bursts the cues ask for (drops flung off the
 * body on a shake, flung up from the water on a jump in or out), which fly
 * the same way and splash where they land. One instanced mesh for every
 * drop and one for every splash ring: two draw calls, however many there
 * are. No simulation beyond a bead and gravity; nothing here knows the
 * frame's rules, only how wet the body is.
 */
import * as THREE from 'three';
import { surfacePoint, type BodySurface, type SurfaceBasis } from './surface';

export const DROPLETS = 28;
export const SPLASHES = 8;
/** Tiles per second²: a room's gravity, gentle enough to be seen. */
const GRAVITY = 7;
/** How fast a bead runs down the body, rows per second. */
const RUN_ROWS_PER_S = 2.2;
const SPLASH_S = 0.36;

type Mode = 'idle' | 'run' | 'fall' | 'fly';

interface Drop {
  mode: Mode;
  /** On the body: its column, the row it runs from and how far toward the next one down (0..1). */
  col: number;
  row: number;
  t: number;
  /** Off the body: where it is and how it moves (world, tiles). */
  p: THREE.Vector3;
  v: THREE.Vector3;
  /** Idle: how long until it may start again (s). */
  wait: number;
  size: number;
}

interface Splash {
  age: number;
  p: THREE.Vector3;
}

export interface DropletsContext {
  surface: BodySurface | null;
  /** Where the feet are now (world), and the frame the samples are in. */
  feet: THREE.Vector3;
  basis: SurfaceBasis;
  tiles: number;
  /** How wet the body is (0..1): how many beads run. */
  wetness: number;
  /** Where a falling drop lands (world y). */
  floorY: number;
  /** Nothing moves (reduced motion): no beads, no flights. */
  still: boolean;
}

export class Droplets {
  readonly mesh: THREE.InstancedMesh;
  readonly splashes: THREE.InstancedMesh;
  private drops: Drop[] = [];
  private rings: Splash[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly p = new THREE.Vector3();
  private readonly flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  private seed = 0.37;

  constructor() {
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), new THREE.MeshStandardMaterial({ color: '#7dd3fc', roughness: 0.15, transparent: true, opacity: 0.88 }), DROPLETS);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.splashes = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.16, 6, 14), new THREE.MeshStandardMaterial({ color: '#e0f2fe', roughness: 0.3, transparent: true, opacity: 0.75 }), SPLASHES);
    this.splashes.frustumCulled = false;
    this.splashes.receiveShadow = true;
    this.splashes.castShadow = false;
    for (let i = 0; i < DROPLETS; i++) this.drops.push({ mode: 'idle', col: 0, row: 0, t: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), wait: this.random() * 1.2, size: 0.03 + this.random() * 0.015 });
    this.hideAll();
  }

  /** A small deterministic sequence: the same bath looks the same twice (tests can count on it). */
  private random(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  private hideAll() {
    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < DROPLETS; i++) this.mesh.setMatrixAt(i, m);
    for (let i = 0; i < SPLASHES; i++) this.splashes.setMatrixAt(i, m);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.splashes.instanceMatrix.needsUpdate = true;
  }

  /** Every bead off the body and every ring gone (a new ritual, the end). */
  reset() {
    for (const d of this.drops) {
      d.mode = 'idle';
      d.wait = this.random() * 1.2;
    }
    this.rings = [];
    this.hideAll();
  }

  /** How many beads are on the body or in the air (for tests and the lab). */
  get active(): number {
    return this.drops.filter((d) => d.mode !== 'idle').length;
  }

  /** The beads running on the body, with where each one is (world) — for tests. */
  running(ctx: Pick<DropletsContext, 'surface' | 'feet' | 'basis'>): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    for (const d of this.drops) if (d.mode === 'run' && ctx.surface) out.push(this.runPoint(d, ctx.surface, ctx.feet, ctx.basis, new THREE.Vector3()));
    return out;
  }

  /**
   * Fling `count` drops from a point: radially (a shake: all round, a little up) or up and out (a splash from the
   * water). They fall under gravity and splash on the floor. Idle beads are used first; the rest are taken from
   * the beads running, so a burst never exceeds the pool.
   */
  burst(origin: THREE.Vector3, count: number, speed: number, shape: 'radial' | 'up') {
    let flung = 0;
    const take = (d: Drop, i: number) => {
      const a = (i / Math.max(1, count)) * Math.PI * 2 + 0.4;
      d.mode = 'fly';
      d.p.copy(origin);
      if (shape === 'radial') {
        d.v.set(Math.cos(a) * speed, speed * (0.25 + 0.3 * this.random()), Math.sin(a) * speed);
      } else {
        d.v.set(Math.cos(a) * speed * 0.55, speed * (0.9 + 0.5 * this.random()), Math.sin(a) * speed * 0.55);
      }
      flung += 1;
    };
    for (const d of this.drops) if (flung < count && d.mode === 'idle') take(d, flung);
    for (const d of this.drops) if (flung < count && d.mode !== 'fly') take(d, flung);
  }

  private runPoint(d: Drop, surface: BodySurface, feet: THREE.Vector3, basis: SurfaceBasis, out: THREE.Vector3): THREE.Vector3 {
    const from = d.row * surface.grid + d.col;
    const below = Math.max(surface.columnBottom[d.col], d.row - 1) * surface.grid + d.col;
    surfacePoint(surface, from, feet, basis, d.size * 0.6, out);
    if (below !== from) {
      surfacePoint(surface, below, feet, basis, d.size * 0.6, this.p);
      out.lerp(this.p, d.t);
    }
    return out;
  }

  /** Start a bead near the top of a body column. */
  private spawn(d: Drop, surface: BodySurface) {
    const columns: number[] = [];
    for (let c = 0; c < surface.grid; c++) if (surface.columnBottom[c] >= 0) columns.push(c);
    if (columns.length === 0) return;
    d.col = columns[Math.floor(this.random() * columns.length)];
    const top = surface.columnTop[d.col];
    const bottom = surface.columnBottom[d.col];
    d.row = Math.max(bottom, top - Math.floor(this.random() * 2));
    d.t = this.random() * 0.5;
    d.mode = 'run';
  }

  /** A frame: the beads run, fall, fly and splash. True while anything moves. */
  update(dt: number, ctx: DropletsContext): boolean {
    const { surface, feet, basis, wetness, floorY, still } = ctx;
    if (still) {
      if (this.active > 0 || this.rings.length > 0) this.reset();
      return false;
    }
    const wanted = surface ? Math.round(DROPLETS * 0.8 * Math.max(0, Math.min(1, wetness))) : 0;
    let running = 0;
    for (const d of this.drops) if (d.mode === 'run') running += 1;
    let moving = false;
    const { m, q, s, p } = this;
    q.identity();
    for (let i = 0; i < DROPLETS; i++) {
      const d = this.drops[i];
      if (d.mode === 'idle') {
        d.wait -= dt;
        if (d.wait <= 0 && surface && running < wanted) {
          this.spawn(d, surface);
          running += 1;
        } else {
          m.makeScale(0, 0, 0);
          this.mesh.setMatrixAt(i, m);
          continue;
        }
      }
      moving = true;
      if (d.mode === 'run') {
        if (!surface) {
          d.mode = 'idle';
          d.wait = 0.5;
          continue;
        }
        d.t += dt * RUN_ROWS_PER_S * (0.7 + d.size * 8);
        while (d.t >= 1) {
          d.t -= 1;
          if (d.row <= surface.columnBottom[d.col]) {
            // The body ends here: the bead lets go and falls
            this.runPoint(d, surface, feet, basis, d.p);
            d.v.set(0, -0.2, 0);
            d.mode = 'fall';
            break;
          }
          d.row -= 1;
        }
        if (d.mode === 'run') this.runPoint(d, surface, feet, basis, p);
        else p.copy(d.p);
      } else {
        d.v.y -= GRAVITY * dt;
        d.p.addScaledVector(d.v, dt);
        if (d.p.y <= floorY) {
          this.splash(d.p.x, floorY, d.p.z);
          d.mode = 'idle';
          d.wait = 0.3 + this.random() * 1.1;
          m.makeScale(0, 0, 0);
          this.mesh.setMatrixAt(i, m);
          continue;
        }
        p.copy(d.p);
      }
      const stretch = d.mode === 'run' ? 1.3 : 1.7;
      s.set(d.size, d.size * stretch, d.size);
      m.compose(p, q, s);
      this.mesh.setMatrixAt(i, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    // The rings widen and go
    for (let i = 0; i < SPLASHES; i++) {
      const r = this.rings[i];
      if (!r) {
        m.makeScale(0, 0, 0);
      } else {
        r.age += dt;
        const k = Math.min(1, r.age / SPLASH_S);
        const radius = (0.04 + k * 0.16) * Math.max(0.6, ctx.tiles / 3);
        s.set(radius, radius, radius * (1 - k) * 0.6 + 0.01);
        m.compose(r.p, this.flat, s);
        moving = true;
      }
      this.splashes.setMatrixAt(i, m);
    }
    this.rings = this.rings.filter((r) => r.age < SPLASH_S);
    this.splashes.instanceMatrix.needsUpdate = true;
    return moving;
  }

  private splash(x: number, y: number, z: number) {
    if (this.rings.length >= SPLASHES) this.rings.shift();
    this.rings.push({ age: 0, p: new THREE.Vector3(x, y + 0.012, z) });
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.splashes.geometry.dispose();
    (this.splashes.material as THREE.Material).dispose();
  }
}
