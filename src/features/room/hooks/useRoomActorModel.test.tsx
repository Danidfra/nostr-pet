/**
 * The room's 3D model is the same Blobbi as its 2D drawing: built from the
 * identity the kit draws (`genomeOf` over `toBlobbiVisual`, the drawing's own
 * visual), for its stage; built only when wanted, kept while 2D is shown,
 * and disposed when the Blobbi it was built for is no longer the one shown.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { parseModernBlobbiEvent, type BlobbiCompanion } from '@blobbi-kit/core';

const built = vi.hoisted(() => ({ calls: [] as { morphology: unknown; seed: string }[], disposed: 0, fail: false }));
vi.mock('../lib/blobbi3d/model', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/blobbi3d/model')>();
  return {
    ...real,
    buildBlobbiModel: (morphology: Parameters<typeof real.buildBlobbiModel>[0], seed: string) => {
      built.calls.push({ morphology, seed });
      if (built.fail) throw new Error('no GPU memory');
      const model = real.buildBlobbiModel(morphology, seed);
      const dispose = model.dispose;
      model.dispose = () => {
        built.disposed += 1;
        dispose();
      };
      return model;
    },
  };
});

import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { blobbiEvent } from '@/test/fixtures';
import { genomeOf, morphologyOf } from '../lib/blobbi3d/identity';
import { FAILED_3D, useRoomActorModel, unavailable3dReason } from './useRoomActorModel';
import type { BlobbiAppearance } from '../lib/blobbi-appearance';

function blobbi(stage: 'egg' | 'baby' | 'adult', generation: 'v1' | 'v2' | 'v3' = 'v3', extra: [string, string][] = []): BlobbiCompanion {
  return parseModernBlobbiEvent(blobbiEvent('0000000007', { name: 'Fern', stage, visualGeneration: generation, extra }))!;
}

beforeEach(() => {
  built.calls = [];
  built.disposed = 0;
  built.fail = false;
});

describe('the room\'s 3D model', () => {
  it('is built from the identity the 2D drawing is drawn from, for its stage, and only when 3D is wanted', () => {
    const fern = blobbi('adult');
    const { result, rerender } = renderHook(({ a }: { a: BlobbiAppearance }) => useRoomActorModel(fern, a), { initialProps: { a: '2d' as BlobbiAppearance } });
    expect(result.current.model).toBeNull();
    expect(built.calls).toHaveLength(0);
    rerender({ a: '3d' });
    expect(result.current.model).not.toBeNull();
    const genome = genomeOf(toBlobbiVisual(fern))!;
    expect(built.calls).toHaveLength(1);
    expect(built.calls[0].seed).toBe(genome.seed);
    expect(built.calls[0].morphology).toEqual(morphologyOf(genome, 'adult'));
  });

  it('is kept while 2D is shown and handed back without a rebuild; a newer event of the same Blobbi keeps it too', () => {
    const fern = blobbi('baby');
    const { result, rerender } = renderHook(({ b, a }: { b: BlobbiCompanion; a: BlobbiAppearance }) => useRoomActorModel(b, a), { initialProps: { b: fern, a: '3d' as BlobbiAppearance } });
    const first = result.current.model;
    rerender({ b: fern, a: '2d' });
    expect(result.current.model).toBeNull();
    rerender({ b: fern, a: '3d' });
    expect(result.current.model).toBe(first);
    // Care changed its stats: a new object, the same identity
    rerender({ b: { ...fern, stats: { ...fern.stats, hunger: 10 } }, a: '3d' });
    expect(result.current.model).toBe(first);
    expect(built.calls).toHaveLength(1);
    expect(built.disposed).toBe(0);
  });

  it('is disposed and rebuilt when the Blobbi grows up, and disposed when the room goes', () => {
    const { result, rerender, unmount } = renderHook(({ b }: { b: BlobbiCompanion }) => useRoomActorModel(b, '3d'), { initialProps: { b: blobbi('baby') } });
    const baby = result.current.model;
    rerender({ b: blobbi('adult') });
    expect(result.current.model).not.toBe(baby);
    expect(built.disposed).toBe(1);
    unmount();
    expect(built.disposed).toBe(2);
  });

  it('an egg and V1/V2 art have no 3D model: 2D is drawn whatever is chosen, and why is said', () => {
    for (const b of [blobbi('egg'), blobbi('adult', 'v1'), blobbi('adult', 'v2')]) {
      const { result } = renderHook(() => useRoomActorModel(b, '3d'));
      expect(result.current.model).toBeNull();
      expect(result.current.unavailable3d).toMatch(/2D|V3/);
    }
    expect(built.calls).toHaveLength(0);
    expect(unavailable3dReason({ stage: 'adult', visualGeneration: 'v3' }, true)).toBeNull();
  });
});

describe('a 3D model that cannot be built', () => {
  it('is reported as failed (the page falls back to 2D and says why), once, without a crash or a rebuild on every render', () => {
    built.fail = true;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fern = blobbi('adult');
    const { result, rerender } = renderHook(({ a }: { a: BlobbiAppearance }) => useRoomActorModel(fern, a), { initialProps: { a: '3d' as BlobbiAppearance } });
    expect(result.current.model).toBeNull();
    expect(result.current.failed).toBe(true);
    expect(result.current.unavailable3d).toBe(FAILED_3D);
    rerender({ a: '3d' });
    rerender({ a: '2d' });
    expect(built.calls).toHaveLength(1);
    expect(result.current.failed).toBe(true);
    errors.mockRestore();
  });
});
