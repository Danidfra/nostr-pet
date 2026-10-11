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
import { journeyFrame, type JourneyKind } from '@/features/teleport/timeline';
import { CAMERA_ELEVATION } from '../room-geometry';

/** Where the stage's camera looks (model units), and from how far: alone, and beside the figurine. */
const LOOK_AT_Y = 0.4;
const DISTANCE = 2.45;
const DISTANCE_PAIR = 3.6;
/** The kit's views are drawn level: the camera a touch above the look point, as before. */
const LEVEL_ELEVATION = Math.atan2(0.08, DISTANCE);

/**
 * Which way the stage shows the model: the kit's three views, a turntable,
 * or `room`: facing the camera from the room's own elevation
 * (`CAMERA_ELEVATION`), the way the room shows a Blobbi at rest. A solid seen
 * from above is not its front drawing, so this is the view to judge it by.
 */
export type StageView = 'front' | 'side' | 'back' | 'turn' | 'room';

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
  private lookAt: THREE.Vector3 | null = null;
  /** A fixed moment of a journey to show (the lab's teleport preview). */
  private journey: { kind: JourneyKind; t: number; reduced: boolean } | null = null;
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
    // A teleporting model is cut by a plane (teleport3d.ts)
    this.renderer.localClippingEnabled = true;
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
    this.placeCamera();
  }

  /** Level for the kit's views and the turntable, the room's elevation for `room`; further back with the figurine. */
  private placeCamera() {
    const x = this.figurine ? 0.48 : 0;
    const distance = this.figurine ? DISTANCE_PAIR : DISTANCE;
    const elevation = this.view === 'room' ? CAMERA_ELEVATION : LEVEL_ELEVATION;
    this.camera.position.set(x, LOOK_AT_Y + distance * Math.sin(elevation), distance * Math.cos(elevation));
    this.camera.lookAt(x, LOOK_AT_Y, 0);
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
    this.placeCamera();
    this.last = 0;
    // Drawn at once (a hidden tab gets no animation frames), then kept moving
    this.renderFrame(0);
    this.requestFrame();
  }

  setView(view: StageView) {
    this.view = view;
    this.placeCamera();
    this.renderFrame(0);
    this.requestFrame();
  }

  setMotion(motion: BlobbiMotion) {
    this.motion = motion;
    this.renderFrame(0);
    this.requestFrame();
  }

  /** Show one moment of a journey (leaving or arriving), or none. */
  setJourney(journey: { kind: JourneyKind; t: number; reduced?: boolean } | null) {
    this.journey = journey ? { ...journey, reduced: journey.reduced ?? false } : null;
    this.renderFrame(0);
    this.requestFrame();
  }

  setSleeping(sleeping: boolean) {
    this.sleeping = sleeping;
    this.renderFrame(0);
    this.requestFrame();
  }

  /**
   * Where the eyes look: a point on the canvas (CSS px from its top left),
   * carried into the world as the point on the plane in front of the face
   * that the pointer's ray meets; or nothing, for the resting gaze. The
   * actor eases to it and fades it as the face turns away.
   */
  lookAtCanvasPoint(x: number, y: number) {
    const ray = new THREE.Vector3((x / this.width) * 2 - 1, 1 - (y / this.height) * 2, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    // The plane in front of the face: a little toward the camera from the model's centre line
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.6);
    const hit = new THREE.Ray(this.camera.position, ray).intersectPlane(plane, new THREE.Vector3());
    this.lookAt = hit;
    this.requestFrame();
  }

  lookAtNothing() {
    this.lookAt = null;
    this.requestFrame();
  }

  /** The eyes' gaze as posed, for the lab and its tests. */
  gaze(): { x: number; y: number } {
    return this.actor?.gaze() ?? { x: 0, y: 0 };
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
      // The room's view sees it as the room does: leaning back from the camera (on +z here)
      const viewAzimuth = this.view === 'room' ? 0 : undefined;
      const journey = this.journey ? { frame: journeyFrame(this.journey.kind, this.journey.t, this.journey.reduced), kind: this.journey.kind, t: this.journey.t } : null;
      if (this.actor.update({ dt, motion: this.motion, heading: this.heading, sleeping: this.sleeping, lookAt: this.lookAt, viewAzimuth, journey })) animating = true;
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
