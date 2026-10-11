/**
 * A journey drawn on a 3D model: the three.js adapter of the shared timeline
 * and mote field. The model itself comes apart and together, nothing is
 * swapped for a picture:
 *
 *   dissolve   a clipping plane on every material of the model (body, limbs,
 *              eyes, the ink line), in world space along the model's own up
 *              axis (a leaning Blobbi dissolves along its body), at the
 *              timeline's `cut` of its real height: the geometry above it is
 *              gone (leaving) or not yet there (arriving)
 *   outline    the model's own vertices, bucketed by height once: where the
 *              body is across and in depth at each height, appendages and
 *              all, so motes are born where the body actually is
 *   motes      one `THREE.Points` (the shared field plus a ring of bright
 *              points along the cut), soft discs added light on light,
 *              white-hot fading to the Blobbi's own colour; unclipped
 *   cap        a glowing cross-section where it is cut: a closed shell opened
 *              by a plane would show its inside from the room's camera; the
 *              cut shows the energy it is turning into instead. The body's
 *              cut gets a disc; every other part the plane opens (an arm, an
 *              ear, a horn) shows its inside lit the same colour, because
 *              while cut every material draws its back faces in that light
 *   trails     each mote drags a short streak along where it just was
 *   sky        the motes rise out through the top of the view and come in
 *              from past it: the drawing says where that is (`skyY`, a
 *              world height above the model, or `ceiling` in body heights)
 *   glow       an emissive lift on its lit materials while it gathers and forms
 *   squash     the figure scaled about the ground (the feet stay down)
 *
 * Reduced motion: a material fade instead, no motes. Everything changed on
 * a material is remembered and put back exactly after a journey (`rest`);
 * `dispose` frees the motes' GPU objects.
 */
import * as THREE from 'three';
import { DEFAULT_CEILING, MOTE_COUNT, TRAIL_MS, motesAt, type MoteLayer, type Silhouette } from '../particles';
import type { JourneyFrame, JourneyKind } from '../timeline';

export interface TeleportTarget3D {
  /** Where the host stands, turns and scales the model. */
  root: THREE.Object3D;
  /** The body under it, squashed about the ground. */
  figure: THREE.Object3D;
}

export interface Teleport3DOptions {
  /** The top of the view as a world height (the motes leave through it and come in from past it). */
  skyY?: number;
  /** Or the same as body heights above the feet. */
  ceiling?: number;
  /** The motes to draw, current and handed on (`moteLayers`); by default the current journey's only. */
  layers?: MoteLayer[];
  /** The share of motes drawn (a lower rendering quality's); 1 by default. */
  density?: number;
}

export interface Teleport3D {
  /** Draw a frame of a journey `t` ms in. */
  apply(frame: JourneyFrame, kind: JourneyKind, t: number, options?: Teleport3DOptions): void;
  /** No journey: the model exactly as it was. */
  rest(): void;
  dispose(): void;
}

/** Height buckets for the outline. */
const BUCKETS = 40;
/** Bright points along the dissolving edge. */
const EDGE_POINTS = 36;

interface Bucket {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** The model's outline in its root's own space (unturned, unleaned): height range and, per height, its extent across and in depth. */
function outlineOf(target: TeleportTarget3D) {
  target.root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(target.root.matrixWorld).invert();
  const v = new THREE.Vector3();
  const points: THREE.Vector3[] = [];
  target.figure.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const p = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!p) return;
    const m = new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld);
    // Every few vertices is plenty for an outline
    for (let i = 0; i < p.count; i += 3) points.push(v.fromBufferAttribute(p, i).applyMatrix4(m).clone());
  });
  let minY = Infinity;
  let maxY = -Infinity;
  for (const q of points) {
    minY = Math.min(minY, q.y);
    maxY = Math.max(maxY, q.y);
  }
  if (!Number.isFinite(minY) || maxY <= minY) {
    minY = 0;
    maxY = 1;
  }
  const buckets: (Bucket | null)[] = Array.from({ length: BUCKETS }, () => null);
  for (const q of points) {
    const i = Math.min(BUCKETS - 1, Math.max(0, Math.floor(((q.y - minY) / (maxY - minY)) * BUCKETS)));
    const b = buckets[i] ?? { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    b.minX = Math.min(b.minX, q.x);
    b.maxX = Math.max(b.maxX, q.x);
    b.minZ = Math.min(b.minZ, q.z);
    b.maxZ = Math.max(b.maxZ, q.z);
    buckets[i] = b;
  }
  const bucketAt = (h: number) => buckets[Math.min(BUCKETS - 1, Math.max(0, Math.floor(h * BUCKETS)))];
  const silhouette: Silhouette = {
    span(h) {
      if (h < 0 || h > 1) return null;
      const b = bucketAt(h);
      return b ? { left: b.minX, right: b.maxX } : null;
    },
  };
  return { minY, maxY, silhouette, depth: (h: number) => bucketAt(h) ?? { minZ: -0.05, maxZ: 0.05, minX: 0, maxX: 0 } };
}

interface Saved {
  material: THREE.Material;
  clippingPlanes: THREE.Plane[] | null;
  clipShadows: boolean;
  transparent: boolean;
  opacity: number;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
  side: THREE.Side;
  onBeforeCompile: THREE.Material['onBeforeCompile'];
  customProgramCacheKey: THREE.Material['customProgramCacheKey'];
}

/** Materials whose shaders end in the standard dithering chunk can light their back faces (`litInside`). */
const LIT_INSIDE = new Set(['MeshStandardMaterial', 'MeshPhysicalMaterial', 'MeshLambertMaterial', 'MeshPhongMaterial', 'MeshBasicMaterial', 'MeshToonMaterial']);

const TRAIL_VERTEX = /* glsl */ `
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const TRAIL_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(uColor, vAlpha);
  }
`;

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aHeat;
  uniform float uViewport;
  varying float vAlpha;
  varying float vHeat;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // Sizes are in the model's units, scaled as the model is: as big on screen as that much of the Blobbi
    float scale = length(modelMatrix[0].xyz);
    gl_PointSize = max(1.0, aSize * scale * projectionMatrix[1][1] * uViewport * 0.5 / -mv.z);
    vAlpha = aAlpha;
    vHeat = aHeat;
  }
`;
const FRAGMENT = /* glsl */ `
  uniform vec3 uTint;
  varying float vAlpha;
  varying float vHeat;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    // A white-hot core in a halo of the Blobbi's own colour: readable on a light wall and a dark one alike
    float core = smoothstep(0.42, 0.0, d);
    float halo = smoothstep(1.0, 0.25, d);
    vec3 color = mix(uTint, vec3(1.0, 0.99, 0.95), clamp(core * (0.4 + 0.6 * vHeat) * 1.6, 0.0, 1.0));
    float alpha = clamp(core + halo * 0.55, 0.0, 1.0) * vAlpha;
    gl_FragColor = vec4(color, alpha);
  }
`;

export function createTeleport3D(target: TeleportTarget3D, tint: THREE.Color): Teleport3D {
  let outline: ReturnType<typeof outlineOf> | null = null;
  const plane = new THREE.Plane();
  const saved: Saved[] = [];
  let active = false;
  const restScale = target.figure.scale.clone();

  // The motes: the field (current and handed-on) and the edge ring in one buffer
  const capacity = MOTE_COUNT * 2 + EDGE_POINTS;
  const positions = new Float32Array(capacity * 3);
  const sizes = new Float32Array(capacity);
  const alphas = new Float32Array(capacity);
  const heats = new Float32Array(capacity);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aHeat', new THREE.BufferAttribute(heats, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0, 0);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { uTint: { value: tint.clone() }, uViewport: { value: 600 } },
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'teleport-motes';
  points.frustumCulled = false;
  points.visible = false;
  points.renderOrder = 10;
  const size = new THREE.Vector2();
  points.onBeforeRender = (renderer) => {
    renderer.getDrawingBufferSize(size);
    material.uniforms.uViewport.value = size.y;
  };
  target.root.add(points);

  // The trails: a streak per mote, from where it was a moment ago (bright) back to nothing
  const trailPositions = new Float32Array(MOTE_COUNT * 2 * 2 * 3);
  const trailAlphas = new Float32Array(MOTE_COUNT * 2 * 2);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3).setUsage(THREE.DynamicDrawUsage));
  trailGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(trailAlphas, 1).setUsage(THREE.DynamicDrawUsage));
  trailGeometry.setDrawRange(0, 0);
  const trailMaterial = new THREE.ShaderMaterial({
    vertexShader: TRAIL_VERTEX,
    fragmentShader: TRAIL_FRAGMENT,
    uniforms: { uColor: { value: tint.clone().lerp(new THREE.Color(1, 0.98, 0.92), 0.65) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const trails = new THREE.LineSegments(trailGeometry, trailMaterial);
  trails.name = 'teleport-trails';
  trails.frustumCulled = false;
  trails.visible = false;
  trails.renderOrder = 9;
  target.root.add(trails);

  // Inside, where any part is cut open: its back faces in the cut's light
  const insideColor = { value: tint.clone().lerp(new THREE.Color(1, 1, 1), 0.6) };
  const litInside: THREE.Material['onBeforeCompile'] = (shader) => {
    shader.uniforms.uTeleportInside = insideColor;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 uTeleportInside;\nvoid main() {')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  if (!gl_FrontFacing) gl_FragColor = vec4(uTeleportInside, gl_FragColor.a);');
  };
  let insideLit = false;

  // The cut's cap: a disc the size of the body where it is cut, lit from within
  const capGeometry = new THREE.CircleGeometry(1, 48);
  capGeometry.rotateX(-Math.PI / 2);
  const capMaterial = new THREE.MeshBasicMaterial({ color: tint.clone().lerp(new THREE.Color(1, 1, 1), 0.6), transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: true });
  const cap = new THREE.Mesh(capGeometry, capMaterial);
  cap.name = 'teleport-cap';
  cap.visible = false;
  cap.renderOrder = 5;
  target.root.add(cap);

  const begin = () => {
    if (active) return;
    active = true;
    outline ??= outlineOf(target);
    target.figure.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (saved.some((s) => s.material === m)) continue;
        const std = m as THREE.MeshStandardMaterial;
        saved.push({
          material: m,
          clippingPlanes: m.clippingPlanes,
          clipShadows: m.clipShadows,
          transparent: m.transparent,
          opacity: m.opacity,
          emissive: std.emissive?.clone(),
          emissiveIntensity: std.emissiveIntensity,
          side: m.side,
          onBeforeCompile: m.onBeforeCompile,
          customProgramCacheKey: m.customProgramCacheKey,
        });
      }
    });
  };

  const rest = () => {
    if (!active) return;
    active = false;
    for (const s of saved) {
      s.material.clippingPlanes = s.clippingPlanes;
      s.material.clipShadows = s.clipShadows;
      s.material.transparent = s.transparent;
      s.material.opacity = s.opacity;
      const std = s.material as THREE.MeshStandardMaterial;
      if (s.emissive && std.emissive) std.emissive.copy(s.emissive);
      if (s.emissiveIntensity !== undefined) std.emissiveIntensity = s.emissiveIntensity;
      s.material.side = s.side;
      s.material.onBeforeCompile = s.onBeforeCompile;
      s.material.customProgramCacheKey = s.customProgramCacheKey;
      s.material.needsUpdate = true;
    }
    saved.length = 0;
    insideLit = false;
    trails.visible = false;
    trailGeometry.setDrawRange(0, 0);
    target.figure.scale.copy(restScale);
    points.visible = false;
    cap.visible = false;
    geometry.setDrawRange(0, 0);
  };

  // It glows in its own colour, lightened: energy, not a white-out
  const warm = tint.clone().lerp(new THREE.Color(1, 0.97, 0.9), 0.5);
  const up = new THREE.Vector3();
  const at = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();

  return {
    apply(frame, kind, t, options = {}) {
      begin();
      const o = outline!;
      const range = o.maxY - o.minY;
      // Squash about the ground
      target.figure.scale.set(restScale.x * frame.sx, restScale.y * frame.sy, restScale.z * frame.sx);
      // The cut: keep what is below it, along the model's own up axis, in the world
      target.root.updateMatrixWorld(true);
      target.root.getWorldQuaternion(quaternion);
      up.set(0, -1, 0).applyQuaternion(quaternion);
      const cutY = (o.minY + frame.cut * range) * frame.sy;
      at.set(0, cutY, 0);
      target.root.localToWorld(at);
      plane.setFromNormalAndCoplanarPoint(up, at);
      const fading = frame.opacity < 1;
      // While it is cut open, everything cut shows its inside lit (a program per material, cached across journeys)
      const lightInside = frame.cut < 1;
      if (lightInside !== insideLit) {
        insideLit = lightInside;
        for (const s of saved) {
          if (!LIT_INSIDE.has(s.material.type)) continue;
          s.material.side = lightInside ? THREE.DoubleSide : s.side;
          s.material.onBeforeCompile = lightInside ? litInside : s.onBeforeCompile;
          s.material.customProgramCacheKey = lightInside ? () => 'teleport-lit-inside' : s.customProgramCacheKey;
          s.material.needsUpdate = true;
        }
      }
      for (const s of saved) {
        const wantPlanes = frame.cut < 1 ? [plane] : null;
        if ((s.material.clippingPlanes?.length ?? 0) !== (wantPlanes?.length ?? 0)) {
          s.material.clippingPlanes = wantPlanes;
          // Its cast shadow is cut with it: the shadow map's own pass clips by the same plane, no pass more
          s.material.clipShadows = wantPlanes !== null;
          s.material.needsUpdate = true;
        }
        if (fading !== s.material.transparent && !s.transparent) {
          s.material.transparent = fading;
          s.material.needsUpdate = true;
        }
        s.material.opacity = s.opacity * frame.opacity;
        const std = s.material as THREE.MeshStandardMaterial;
        if (std.emissive && s.emissive) {
          std.emissive.copy(s.emissive).lerp(warm, Math.min(1, frame.glow));
          std.emissiveIntensity = (s.emissiveIntensity ?? 1) * (1 - frame.glow) + 0.32 * frame.glow;
        }
      }
      // The sky, in body heights above the feet: from the world height the drawing gives, through the model's scale
      let ceiling = options.ceiling ?? DEFAULT_CEILING;
      if (options.skyY !== undefined) {
        const feet = new THREE.Vector3(0, o.minY * frame.sy, 0);
        target.root.localToWorld(feet);
        const scale = target.root.matrixWorld.getMaxScaleOnAxis();
        const bodyHeight = range * frame.sy * scale;
        if (bodyHeight > 1e-6) ceiling = Math.max(1.4, (options.skyY - feet.y) / bodyHeight);
      }
      const layers = options.layers ?? (frame.motes ? [{ kind, t, fade: 1 }] : []);
      // The motes (and their trails), then the edge's ring of light
      let n = 0;
      let segments = 0;
      const place = (m: { x: number; y: number; depth: number }, out: Float32Array, at: number) => {
        const d = o.depth(Math.min(1, Math.max(0, m.y)));
        // In front of the body mostly, some round its sides: depth from its layer, toward the viewer's side
        out[at] = m.x * frame.sx;
        out[at + 1] = (o.minY + m.y * range) * frame.sy;
        out[at + 2] = d.minZ + (d.maxZ - d.minZ) * (0.55 + 0.45 * m.depth);
      };
      for (const layer of layers) {
        const motes = motesAt(layer.kind, layer.t, o.silhouette, { ceiling, bornBefore: layer.bornBefore, density: options.density });
        const before = new Map(motesAt(layer.kind, layer.t - TRAIL_MS, o.silhouette, { ceiling, bornBefore: layer.bornBefore, density: options.density }).map((m) => [m.index, m]));
        for (const m of motes) {
          if (n >= MOTE_COUNT * 2) break;
          place(m, positions, n * 3);
          sizes[n] = m.size * 3.2;
          alphas[n] = m.alpha * layer.fade;
          heats[n] = m.heat;
          const was = before.get(m.index);
          if (was && segments < MOTE_COUNT * 2) {
            place(was, trailPositions, segments * 6);
            trailPositions[segments * 6 + 3] = positions[n * 3];
            trailPositions[segments * 6 + 4] = positions[n * 3 + 1];
            trailPositions[segments * 6 + 5] = positions[n * 3 + 2];
            trailAlphas[segments * 2] = 0;
            trailAlphas[segments * 2 + 1] = 0.5 * m.alpha * layer.fade;
            segments++;
          }
          n++;
        }
      }
      cap.visible = false;
      if (frame.edgeGlow > 0 && frame.cut > 0 && frame.cut < 1) {
        const d = o.depth(frame.cut);
        const span = o.silhouette.span(frame.cut) ?? { left: d.minX, right: d.maxX };
        const cx = (span.left + span.right) / 2;
        const a = (span.right - span.left) / 2;
        const cz = (d.minZ + d.maxZ) / 2;
        const b = (d.maxZ - d.minZ) / 2;
        // The cap fills the cut, just inside the outline (the ink line keeps its edge)
        cap.visible = a > 0.002 && b > 0.002;
        cap.position.set(cx * frame.sx, cutY, cz);
        cap.scale.set(a * frame.sx * 0.97, 1, b * 0.97);
        capMaterial.opacity = 0.95 * Math.min(1, frame.edgeGlow * 1.2);
        for (let i = 0; i < EDGE_POINTS && n < capacity; i++) {
          const angle = (i / EDGE_POINTS) * Math.PI * 2 + t * 0.002;
          positions[n * 3] = (cx + a * Math.sin(angle)) * frame.sx;
          positions[n * 3 + 1] = cutY;
          positions[n * 3 + 2] = cz + b * Math.cos(angle);
          sizes[n] = 0.05 + 0.02 * Math.sin(t * 0.02 + i * 1.7);
          // The far side of the ring is dimmer: it is behind the body
          alphas[n] = frame.edgeGlow * (0.45 + 0.55 * Math.max(0, Math.cos(angle)));
          heats[n] = 1;
          n++;
        }
      }
      geometry.setDrawRange(0, n);
      trailGeometry.setDrawRange(0, segments * 2);
      (trailGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (trailGeometry.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
      trails.visible = segments > 0;
      for (const name of ['position', 'aSize', 'aAlpha', 'aHeat']) (geometry.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
      points.visible = n > 0;
    },
    rest,
    dispose() {
      rest();
      target.root.remove(points);
      target.root.remove(cap);
      target.root.remove(trails);
      geometry.dispose();
      material.dispose();
      trailGeometry.dispose();
      trailMaterial.dispose();
      capGeometry.dispose();
      capMaterial.dispose();
    },
  };
}
