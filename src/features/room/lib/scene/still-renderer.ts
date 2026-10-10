/**
 * Stills of furniture models for the decorator's catalog: one WebGL context,
 * studio lighting built once, the model centred and framed from a
 * three-quarter view, a PNG blob out. Ditto's `modelRenderer.ts` less the
 * file loaders (nothing here loads a model file). Imported on demand with three.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** The soft studio reflections models are lit with. Costly: build once per renderer. */
function studioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  return envMap;
}

/** Free every geometry, material and texture under an object. */
function disposeObject(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.Line) {
      child.geometry.dispose();
      const materials: THREE.Material[] = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
        material.dispose();
      }
    }
  });
}

/** Light a model, centre it at the origin, and frame it from a three-quarter view. */
function stage(model: THREE.Object3D, aspect: number, environment: THREE.Texture): { scene: THREE.Scene; camera: THREE.PerspectiveCamera; dispose: () => void } {
  const scene = new THREE.Scene();
  scene.environment = environment;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(3, 5, 4);
  scene.add(key);
  const pivot = new THREE.Group();
  pivot.add(model);
  scene.add(pivot);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const radius = Number.isFinite(sphere.radius) && sphere.radius > 0 ? sphere.radius : 1;
  model.position.sub(sphere.center);
  model.traverse((child) => {
    if (child instanceof THREE.Points && child.material instanceof THREE.PointsMaterial) {
      child.material.size = radius / (child.userData.pointsPerRadius ?? 200);
    }
  });
  const fov = 35;
  const camera = new THREE.PerspectiveCamera(fov, aspect, radius / 100, radius * 100);
  const distance = (radius / Math.sin(THREE.MathUtils.degToRad(fov / 2))) * 1.05;
  camera.position.copy(new THREE.Vector3(1, 0.7, 1.2).normalize().multiplyScalar(distance));
  camera.lookAt(0, 0, 0);
  return { scene, camera, dispose: () => disposeObject(scene) };
}

export interface StillRenderer {
  /** A still of `model` (consumed: its resources are freed), or `undefined` if rendering failed. */
  render(model: THREE.Object3D, width: number, height: number): Promise<Blob | undefined>;
  /** Release the WebGL context. */
  dispose(): void;
}

/** A still renderer, or `undefined` without WebGL. */
export function createStillRenderer(): StillRenderer | undefined {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return undefined;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  let environment: THREE.Texture;
  try {
    environment = studioEnvironment(renderer);
  } catch {
    renderer.dispose();
    renderer.forceContextLoss();
    return undefined;
  }
  const canvas = renderer.domElement;
  return {
    async render(model, width, height) {
      let staged: ReturnType<typeof stage> | undefined;
      try {
        if (canvas.width !== width || canvas.height !== height) renderer.setSize(width, height, false);
        staged = stage(model, width / height, environment);
        await renderer.compileAsync(staged.scene, staged.camera);
        renderer.render(staged.scene, staged.camera);
        return await new Promise<Blob | undefined>((resolve) => {
          canvas.toBlob((blob) => resolve(blob ?? undefined), 'image/png');
        });
      } catch {
        return undefined;
      } finally {
        staged?.dispose();
      }
    },
    dispose() {
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
