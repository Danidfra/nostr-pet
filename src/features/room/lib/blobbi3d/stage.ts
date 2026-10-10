/**
 * A small stage for one 3D Blobbi: its own renderer, a camera framing the
 * art box, soft lighting and a ground shadow, the model driven as the room
 * would drive it (`actor.ts`) but facing a chosen view or turning on the
 * spot. The lab's viewer; nothing in the room uses it.
 */
import * as THREE from 'three';
import type { BlobbiMotion } from '@blobbi-kit/renderer/procedural';
import { createBlobbiActor, type ActorModel } from './actor';
import type { BlobbiModel } from './model';
import { yawForView } from './rig';

export type StageView = 'front' | 'side' | 'back' | 'turn';

export interface StageOptions {
  walkCycle?: number;
  reducedMotion?: () => boolean;
}

/** The user's reduced-motion setting, read when asked (it can change while a stage is up). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Radians per second the turntable turns. */
const TURN_RATE = 0.9;

function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
    }
  });
}

export class BlobbiStage {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(24, 1, 0.05, 20);
  private actor: ActorModel | null = null;
  private figurine: THREE.Object3D | null = null;
  private view: StageView = 'front';
  private motion: BlobbiMotion = 'idle';
  private sleeping = false;
  private heading = 0;
  private frame = 0;
  private last = 0;
  private disposed = false;
  private width = 1;
  private height = 1;
  private ground: THREE.Mesh;

  /** The stage's own canvas, put in `host`: a lost context never has to be won back on a canvas React keeps. */
  readonly canvas: HTMLCanvasElement;

  constructor(host: HTMLElement, private options: StageOptions = {}) {
    const canvas = host.ownerDocument.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    host.appendChild(canvas);
    this.renderer.setPixelRatio(Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // No tone mapping: the palette's colours are the kit's, and should read as they do in the drawing
    this.renderer.toneMapping = THREE.NoToneMapping;
    const hemi = new THREE.HemisphereLight('#ffffff', '#d9cfc2', 1.15);
    const key = new THREE.DirectionalLight('#fff6e8', 1.25);
    key.position.set(1.2, 2.4, 1.6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 8;
    key.shadow.camera.left = key.shadow.camera.bottom = -1.5;
    key.shadow.camera.right = key.shadow.camera.top = 1.5;
    key.shadow.radius = 4;
    const fill = new THREE.DirectionalLight('#dfe8ff', 0.45);
    fill.position.set(-1.6, 0.8, 1.0);
    this.scene.add(hemi, key, fill);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.22 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.camera.position.set(0, 0.48, 2.45);
    this.camera.lookAt(0, 0.4, 0);
  }

  /** Stand a model on the stage (replacing the last), and optionally the SNO figurine beside it. */
  setModel(model: BlobbiModel | null, figurine: THREE.Object3D | null = null) {
    if (this.actor) {
      this.scene.remove(this.actor.object);
      this.actor = null;
    }
    if (this.figurine) {
      this.scene.remove(this.figurine);
      disposeObject(this.figurine);
      this.figurine = null;
    }
    if (model) {
      this.actor = createBlobbiActor(model, { walkCycle: this.options.walkCycle, reducedMotion: this.options.reducedMotion });
      this.scene.add(this.actor.object);
    }
    if (figurine) {
      this.figurine = figurine;
      figurine.position.set(0.95, 0, 0);
      this.scene.add(figurine);
    }
    // Two on the stage: step back and look between them
    this.camera.position.set(figurine ? 0.48 : 0, 0.48, figurine ? 3.6 : 2.45);
    this.camera.lookAt(figurine ? 0.48 : 0, 0.4, 0);
    this.last = 0;
    // Drawn at once (a hidden tab gets no animation frames), then kept moving
    this.renderFrame(0);
    this.requestFrame();
  }

  setView(view: StageView) {
    this.view = view;
    this.renderFrame(0);
    this.requestFrame();
  }

  setMotion(motion: BlobbiMotion) {
    this.motion = motion;
    this.renderFrame(0);
    this.requestFrame();
  }

  setSleeping(sleeping: boolean) {
    this.sleeping = sleeping;
    this.renderFrame(0);
    this.requestFrame();
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderFrame(0);
    this.requestFrame();
  }

  /** The current frame as a PNG data URL. */
  snapshot(): string {
    this.renderFrame(0);
    return this.canvas.toDataURL('image/png');
  }

  requestFrame() {
    if (this.disposed || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const now = performance.now();
      const dt = Math.min(0.1, this.last ? (now - this.last) / 1000 : 1 / 60);
      this.last = now;
      if (this.renderFrame(dt)) this.requestFrame();
      else this.last = 0;
    });
  }

  /** Draw one frame; true while something keeps moving. */
  private renderFrame(dt: number): boolean {
    let animating = false;
    if (this.actor) {
      if (this.view === 'turn') {
        this.heading = (this.heading + dt * TURN_RATE) % (Math.PI * 2);
        animating = true;
      } else {
        this.heading = yawForView(this.view);
      }
      if (this.actor.update({ dt, motion: this.motion, heading: this.heading, sleeping: this.sleeping })) animating = true;
      if (this.figurine) this.figurine.rotation.y = this.actor.object.rotation.y;
    }
    this.renderer.render(this.scene, this.camera);
    return animating;
  }

  dispose() {
    this.disposed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (this.actor) this.scene.remove(this.actor.object);
    if (this.figurine) {
      this.scene.remove(this.figurine);
      disposeObject(this.figurine);
    }
    this.ground.geometry.dispose();
    (this.ground.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
