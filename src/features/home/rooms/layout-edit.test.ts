/**
 * The pure layout operations behind the (dormant) room editor. They stay
 * covered so the engineering keeps working while no screen uses it.
 */
import { describe, expect, it } from 'vitest';
import { MAX_FURNITURE_PER_ROOM, type Placement } from './layout-schema';
import { addPlacement, cyclePlacementLayer, flipPlacement, movePlacement, nudgePlacement, removePlacement, sameLayout, scalePlacement } from './layout-edit';

const rug: Placement = { id: 'official:rug-round', x: 0.5, y: 0.88, layer: 'floor' };
const plant: Placement = { id: 'official:plant-tall', x: 0.8, y: 0.8, layer: 'front' };
const draft = [rug, plant];

describe('layout edits', () => {
  it('move and nudge keep the piece legal (clamped to the canvas, rounded)', () => {
    const moved = movePlacement(draft, 0, { x: 5, y: -5 }, 'home');
    expect(moved[0].x).toBeLessThanOrEqual(1);
    expect(moved[0].y).toBeGreaterThanOrEqual(0);
    expect(moved[1]).toEqual(plant);
    const nudged = nudgePlacement(draft, 1, -0.01, 0, 'home');
    expect(nudged[1].x).toBeCloseTo(0.79, 3);
    expect(nudgePlacement(draft, 9, 0.1, 0, 'home')).toEqual(draft);
  });

  it('cycles layers among the ones the piece allows, keeping it in view', () => {
    const cycled = cyclePlacementLayer(draft, 1, 'home');
    expect(cycled[1].layer).toBe('floor');
    expect(cyclePlacementLayer(draft, 0, 'home')[0].layer).toBe(rug.layer); // a rug only lies on the floor
  });

  it('scales within bounds and flips only what may flip', () => {
    const up = scalePlacement(draft, 1, 0.1, 'home');
    expect(up[1].scale).toBeCloseTo(1.1, 2);
    let big = draft;
    for (let i = 0; i < 30; i += 1) big = scalePlacement(big, 1, 0.1, 'home');
    expect(big[1].scale).toBeLessThanOrEqual(2);
    expect(flipPlacement(draft, 1, 'home')[1].flip).toBe(true);
  });

  it('adds at the default spot until the room is full, and never a piece that may not stand here', () => {
    const added = addPlacement(draft, 'official:plant-small', 'home');
    expect(added).toHaveLength(3);
    expect(addPlacement(draft, 'home:tub', 'home')).toBeNull();
    let full = draft;
    while (full.length < MAX_FURNITURE_PER_ROOM) full = addPlacement(full, 'official:plant-small', 'home') ?? full;
    expect(addPlacement(full, 'official:plant-small', 'home')).toBeNull();
  });

  it('removes by index and compares layouts by what they paint', () => {
    expect(removePlacement(draft, 0)).toEqual([plant]);
    expect(sameLayout(draft, [rug, plant])).toBe(true);
    expect(sameLayout(draft, [plant, rug])).toBe(false);
    expect(sameLayout(draft, [rug, { ...plant, scale: 1 }])).toBe(true);
    expect(sameLayout(draft, [rug, { ...plant, flip: true }])).toBe(false);
  });
});
