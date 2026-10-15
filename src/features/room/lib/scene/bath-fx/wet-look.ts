/**
 * The wet look (M15 care, the 3D effects): a wet Blobbi shines. While the
 * body is wet its model's materials are made glossier (the roughness
 * lowered toward a wet sheen, and a clearcoat where the material has one)
 * in step with `wetness`, and every value is put back EXACTLY as it was
 * when the body dries, the bath ends or the layer is disposed. Only the
 * standard materials the model is built from are touched (`model.ts`:
 * MeshStandardMaterial); anything else on the object is left alone. No
 * material is created or replaced, so nothing recompiles.
 */
import * as THREE from 'three';

interface Saved {
  roughness: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
}

/** The roughness of a fully wet body. */
const WET_ROUGHNESS = 0.22;
const WET_CLEARCOAT = 0.7;

type Coated = THREE.MeshStandardMaterial & { clearcoat?: number; clearcoatRoughness?: number };

export class WetLook {
  private saved = new Map<Coated, Saved>();
  private body: THREE.Object3D | null = null;

  /** How glossy the body is now (0 dry .. 1 wet), as last applied. */
  wetness = 0;

  /** Make `body` look this wet; 0 puts everything back. A different body first restores the last one. */
  apply(body: THREE.Object3D | null, wetness: number) {
    const w = Math.max(0, Math.min(1, wetness));
    if (body !== this.body) this.restore();
    if (!body || w <= 0) {
      this.restore();
      return;
    }
    this.body = body;
    this.wetness = w;
    body.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials: THREE.Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const m = material as Coated;
        if (!(m as THREE.MeshStandardMaterial).isMeshStandardMaterial) continue;
        let saved = this.saved.get(m);
        if (!saved) {
          saved = { roughness: m.roughness };
          if (typeof m.clearcoat === 'number') {
            saved.clearcoat = m.clearcoat;
            saved.clearcoatRoughness = m.clearcoatRoughness;
          }
          this.saved.set(m, saved);
        }
        m.roughness = saved.roughness + (WET_ROUGHNESS - saved.roughness) * w;
        if (saved.clearcoat !== undefined) {
          m.clearcoat = saved.clearcoat + (WET_CLEARCOAT - saved.clearcoat) * w;
          m.clearcoatRoughness = 0.3;
        }
      }
    });
  }

  /** Every touched material back exactly as it was. */
  restore() {
    for (const [m, saved] of this.saved) {
      m.roughness = saved.roughness;
      if (saved.clearcoat !== undefined) {
        m.clearcoat = saved.clearcoat;
        m.clearcoatRoughness = saved.clearcoatRoughness;
      }
    }
    this.saved.clear();
    this.body = null;
    this.wetness = 0;
  }

  /** How many materials are held glossy now (for tests). */
  get touched(): number {
    return this.saved.size;
  }
}
