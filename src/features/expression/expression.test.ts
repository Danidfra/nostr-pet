/**
 * The shared expression system: names in the kit's own vocabulary (blends
 * with a dominant preset, so V1/V2 art draws something too), the same face
 * handed to the 3D model as the kit's procedural face, a priority stack
 * where the strongest moment wins and an interrupted one comes back, faces
 * eased between blendable faces, and the 3D model wearing each face from
 * the kit's own geometry.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveMorphology, generateGenome } from '@blobbi-kit/renderer/procedural';
import { createExpressionController, PRIORITY } from './controller';
import { EXPRESSIONS, faceKey, proceduralFace, type ExpressionName } from './faces';
import { easeFace } from './react/useExpression';
import { buildBlobbiModel } from '@/features/room/lib/blobbi3d/model';
import { poseRig } from '@/features/room/lib/blobbi3d/rig';

describe('the faces', () => {
  it('every name is the kit’s own face: a preset, a blend whose strongest is at least half, or explicit parts', () => {
    for (const [name, face] of Object.entries(EXPRESSIONS) as [ExpressionName, (typeof EXPRESSIONS)[ExpressionName]][]) {
      if (typeof face === 'string') continue;
      if ('blend' in face) {
        const weights = Object.values(face.blend) as number[];
        expect(Math.max(...weights), name).toBeGreaterThanOrEqual(0.5);
        expect(weights.reduce((a, b) => a + b, 0), name).toBeLessThanOrEqual(1.0001);
      } else {
        expect(Object.keys(face).every((k) => ['eyes', 'mouth', 'brows', 'blush'].includes(k)), name).toBe(true);
      }
    }
    for (const name of ['happy', 'curious', 'surprised', 'worried', 'concentrating', 'relieved', 'sleepy', 'affectionate'] as const) expect(EXPRESSIONS[name]).toBeDefined();
  });

  it('hand the 3D model the same face, keyed stably (weights to a quarter) so each is built once', () => {
    expect(proceduralFace('neutral')).toBeNull();
    expect(proceduralFace('happy')).toEqual({ expression: { happy: 1 } });
    expect(proceduralFace(EXPRESSIONS.curious)).toEqual({ expression: { surprised: 0.55, happy: 0.45 } });
    expect(proceduralFace(EXPRESSIONS.affectionate)).toEqual({ expression: {}, face: EXPRESSIONS.affectionate });
    expect(faceKey(proceduralFace({ blend: { happy: 0.51, surprised: 0.49 } }))).toBe(faceKey(proceduralFace({ blend: { surprised: 0.5, happy: 0.5 } })));
    expect(faceKey(null)).toBe('neutral');
    expect(faceKey(proceduralFace('sad'))).not.toBe(faceKey(proceduralFace('happy')));
  });

  it('ease between blendable faces, and change at once to or from explicit parts', () => {
    expect(easeFace('neutral', 'happy', 0.5)).toEqual({ blend: { happy: 0.5 } });
    expect(easeFace('happy', 'surprised', 0.25)).toEqual({ blend: { happy: 0.75, surprised: 0.25 } });
    expect(easeFace('happy', EXPRESSIONS.affectionate, 0.5)).toBe(EXPRESSIONS.affectionate);
    expect(easeFace('happy', 'sad', 1)).toBe('sad');
  });
});

describe('the expression controller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('the strongest moment wins; among equals the latest; an interrupted one comes back underneath', () => {
    const c = createExpressionController();
    const seen: (string | null)[] = [];
    c.subscribe((r) => seen.push(r?.name ?? null));
    c.show('life', 'curious', { priority: PRIORITY.life });
    c.show('care', 'chewing', { priority: PRIORITY.care });
    c.show('reaction', 'happy', { priority: PRIORITY.reaction });
    expect(c.current()?.name).toBe('chewing');
    c.clear('care');
    expect(c.current()?.name).toBe('happy');
    c.show('other', 'surprised', { priority: PRIORITY.reaction });
    expect(c.current()?.name).toBe('surprised');
    c.clear('other');
    c.clear('reaction');
    expect(c.current()?.name).toBe('curious');
    c.clear('life');
    expect(c.current()).toBeNull();
    expect(seen).toEqual(['curious', 'chewing', 'happy', 'surprised', 'happy', 'curious', null]);
  });

  it('a duration ends a face by itself; asking again replaces the source’s own (never stacks); disposed, nothing fires', () => {
    const c = createExpressionController();
    c.show('reaction', 'happy', { durationMs: 500 });
    c.show('reaction', 'surprised', { durationMs: 800 });
    vi.advanceTimersByTime(600);
    expect(c.current()?.name).toBe('surprised');
    vi.advanceTimersByTime(300);
    expect(c.current()).toBeNull();
    c.show('reaction', 'happy', { durationMs: 500 });
    c.dispose();
    expect(c.current()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    c.show('reaction', 'happy');
    expect(c.current()).toBeNull();
  });
});

describe('the 3D model wears the face', () => {
  it('builds each face from the kit’s geometry once, shuts the eyes for a closed-eyed face, and goes back to neutral', () => {
    const m = buildBlobbiModel(deriveMorphology(generateGenome('face-1'), 'adult'), 'face-1');
    const faces = () => m.rig.body.children.filter((c) => c.name === 'face');
    expect(faces()).toHaveLength(1);
    expect(m.setFace(proceduralFace('surprised'))).toBe(false);
    expect(faces()).toHaveLength(2);
    expect(faces().filter((f) => f.visible)).toHaveLength(1);
    // The kit's "wide" eyes: a smaller iris in the white
    expect(m.rig.eyes[0].inner.scale.x).toBeLessThan(1);
    // Closed-eyed: the eyes hidden, the face's own lids drawn
    expect(m.setFace(proceduralFace(EXPRESSIONS.affectionate))).toBe(true);
    poseRig(m, { motion: 'still', phase: 0, faceClosed: true });
    for (const eye of m.rig.eyes) {
      expect(eye.open.visible).toBe(false);
      expect(eye.closed?.visible ?? false).toBe(false);
    }
    // Again: no new build
    m.setFace(proceduralFace('surprised'));
    expect(faces()).toHaveLength(3);
    m.setFace(null);
    expect(m.rig.eyes[0].inner.scale.x).toBe(1);
    poseRig(m, { motion: 'still', phase: 0 });
    for (const eye of m.rig.eyes) expect(eye.open.visible).toBe(true);
    m.dispose();
  }, 30_000);
});
