/**
 * The two drawings of a journey. 2D: the canonical drawing is masked at the
 * cut (top down leaving, bottom up arriving), hidden while away, and left
 * exactly as it was at rest; the SVG itself is never touched. 3D: the model
 * is cut by a real clipping plane on every material, its motes and its cut's
 * cap are drawn, and everything is put back exactly when the journey ends;
 * disposing removes what it added.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { TeleportFrame2D } from './react/TeleportFrame2D';
import { createTeleport3D } from './three/teleport3d';
import { DEPART, ARRIVE, journeyFrame } from './timeline';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { buildBlobbiModel } from '@/features/room/lib/blobbi3d/model';
import { genomeOf, labBlobbi, morphologyOf } from '@/features/room/lib/blobbi3d/identity';

const drawing = <svg data-testid="drawing" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>;
const body = (c: HTMLElement) => c.querySelector('.teleport-2d__body') as HTMLElement;

describe('a journey around the 2D drawing', () => {
  it('masks the drawing at the cut: half gone leaving is a mask that stops part way up; the drawing itself is untouched', () => {
    const t = DEPART.gather + (DEPART.dissolve - DEPART.gather) / 2;
    const { container, getByTestId } = render(<TeleportFrame2D journey={null} absent={false} preview={{ kind: 'depart', t }}>{drawing}</TeleportFrame2D>);
    const mask = body(container).style.maskImage || body(container).style.webkitMaskImage;
    expect(mask).toMatch(/linear-gradient\(to top/);
    expect(body(container).style.transform).toMatch(/scale/);
    expect(getByTestId('drawing').outerHTML).toBe('<svg data-testid="drawing" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"></circle></svg>');
    expect(container.querySelector('.teleport-2d')).toHaveAttribute('data-teleport', 'depart');
  });

  it('is hidden while away, and exactly as it was at rest', () => {
    const { container, rerender } = render(<TeleportFrame2D journey={null} absent preview={null}>{drawing}</TeleportFrame2D>);
    expect(body(container).style.visibility).toBe('hidden');
    rerender(<TeleportFrame2D journey={null} absent={false} preview={{ kind: 'arrive', t: ARRIVE.incoming + 200 }}>{drawing}</TeleportFrame2D>);
    expect(body(container).style.maskImage || body(container).style.webkitMaskImage).toMatch(/gradient/);
    rerender(<TeleportFrame2D journey={null} absent={false} preview={null}>{drawing}</TeleportFrame2D>);
    expect(body(container).style.visibility).toBe('');
    expect(body(container).style.maskImage).toBe('');
    expect(body(container).style.transform).toBe('');
    expect(body(container).style.filter).toBe('');
  });
});

describe('a journey on the 3D model', () => {
  function model() {
    const genome = genomeOf(toBlobbiVisual(labBlobbi('e'.repeat(64), '0000000002', 'x', 'adult')))!;
    return buildBlobbiModel(morphologyOf(genome, 'adult'), genome.seed);
  }
  const materialsOf = (m: ReturnType<typeof model>) => {
    const out: THREE.Material[] = [];
    m.figure.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) out.push(mat);
    });
    return [...new Set(out)];
  };

  it('cuts every material with one plane, draws motes and a cap at the cut, and puts everything back after', () => {
    const m = model();
    const effect = createTeleport3D({ root: m.root, figure: m.figure }, new THREE.Color(m.tint));
    const materials = materialsOf(m);
    const lit = materials.find((x) => (x as THREE.MeshStandardMaterial).emissive) as THREE.MeshStandardMaterial;
    const emissiveBefore = lit.emissive.clone();
    const scaleBefore = m.figure.scale.clone();
    const t = DEPART.gather + (DEPART.dissolve - DEPART.gather) / 2;
    effect.apply(journeyFrame('depart', t), 'depart', t);
    for (const mat of materials) expect(mat.clippingPlanes?.length).toBe(1);
    const plane = materials[0].clippingPlanes![0];
    for (const mat of materials) expect(mat.clippingPlanes![0]).toBe(plane);
    const motes = m.root.getObjectByName('teleport-motes') as THREE.Points;
    expect(motes.visible).toBe(true);
    expect(motes.geometry.drawRange.count).toBeGreaterThan(10);
    expect(m.root.getObjectByName('teleport-cap')!.visible).toBe(true);
    // Whole again: no cut, no glow, the body its own size
    effect.rest();
    for (const mat of materials) expect(mat.clippingPlanes ?? null).toBeNull();
    expect(lit.emissive.equals(emissiveBefore)).toBe(true);
    expect(m.figure.scale.equals(scaleBefore)).toBe(true);
    expect(motes.visible).toBe(false);
    effect.dispose();
    expect(m.root.getObjectByName('teleport-motes')).toBeUndefined();
    expect(m.root.getObjectByName('teleport-cap')).toBeUndefined();
    m.dispose();
  });

  it('leaving keeps the part below the cut: the plane faces down the body, at the cut\'s height', () => {
    const m = model();
    const effect = createTeleport3D({ root: m.root, figure: m.figure }, new THREE.Color(m.tint));
    const t = DEPART.gather + (DEPART.dissolve - DEPART.gather) * 0.3;
    effect.apply(journeyFrame('depart', t), 'depart', t);
    const plane = materialsOf(m)[0].clippingPlanes![0];
    // Kept is where the plane's distance is positive: the feet are kept, the top of the head is not
    expect(plane.distanceToPoint(new THREE.Vector3(0, 0.01, 0))).toBeGreaterThan(0);
    expect(plane.distanceToPoint(new THREE.Vector3(0, m.bounds.height, 0))).toBeLessThan(0);
    effect.dispose();
    m.dispose();
  });
});
