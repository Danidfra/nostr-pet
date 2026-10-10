/**
 * Every piece of furniture the room can show has a model, and every model
 * is a well-formed Simple Nostr Object the three.js builder can draw: the
 * payload's arrays agree, every face names real vertices, every colour
 * names a palette entry, and the conversion to the builder's shape keeps
 * the lattice (units × ticks) exactly.
 */
import { describe, expect, it } from 'vitest';

import { OFFICIAL_FURNITURE_3D } from '../furniture-3d';
import { DEFAULT_ROOM_FURNITURE } from '../room-furniture';
import { OFFICIAL_MODEL_IDS, getOfficialModel, missingObjectModel } from './official-models';
import { TICKS_PER_UNIT, expandFaceColors, snoObjectFromPayload } from './sno-object';
import { SnoBuilder } from './sno-builder';

describe('the official furniture models', () => {
  it('every catalog entry has a model, and every model is in the catalog', () => {
    const catalog = OFFICIAL_FURNITURE_3D.map((d) => d.id).sort();
    expect([...OFFICIAL_MODEL_IDS].sort()).toEqual(catalog);
  });

  it('every default placement names a catalog piece on a surface it mounts on', () => {
    for (const [room, placements] of Object.entries(DEFAULT_ROOM_FURNITURE)) {
      for (const p of placements) {
        const def = OFFICIAL_FURNITURE_3D.find((d) => d.id === p.id);
        expect(def, `${room}: ${p.id}`).toBeDefined();
        expect((def!.mount === 'wall') === (p.at !== 'floor'), `${room}: ${p.id} at ${p.at}`).toBe(true);
        if (def!.allowedRooms) expect(def!.allowedRooms, `${room}: ${p.id}`).toContain(room);
      }
    }
  });

  it.each(OFFICIAL_MODEL_IDS)('%s is a well-formed SNO v2 payload the builder can take', (id) => {
    const model = getOfficialModel(id)!;
    const { payload } = model;
    expect(payload.v).toBe(2);
    expect(payload.mode).toBe('solid');
    expect(payload.palette.length).toBeGreaterThanOrEqual(2);
    expect(payload.vertices.length).toBeGreaterThan(0);
    expect(payload.faces.length).toBeGreaterThan(0);
    for (const v of payload.vertices) for (const n of v) expect(Number.isInteger(n)).toBe(true);
    for (const t of payload.ticks) for (const n of t) expect(n >= 0 && n < TICKS_PER_UNIT).toBe(true);
    const object = snoObjectFromPayload(payload);
    expect(object.positions).toHaveLength(payload.vertices.length * 3);
    expect(object.colors).toHaveLength(payload.vertices.length);
    expect(object.faceColorIndices).toHaveLength(payload.faces.length);
    for (const face of object.faces) for (const v of face) expect(v >= 0 && v < payload.vertices.length).toBe(true);
    for (const [r, g, b] of object.colors) expect([r, g, b].every((c) => c >= 0 && c <= 1)).toBe(true);
    // Models are the same object on every read.
    expect(getOfficialModel(id)).toBe(model);
  });

  it('the stand-in for a missing object builds too', () => {
    expect(() => snoObjectFromPayload(missingObjectModel().payload)).not.toThrow();
  });
});

describe('the SNO payload adapter', () => {
  it('positions are the lattice: units times ticks per unit, plus the tick', () => {
    const b = new SnoBuilder();
    // A single triangle with a sub-unit corner: 1.5 units = 1 unit + 60 ticks.
    b.polygon([[0, 0, 0], [1.5, 0, 0], [0, 2, 0]], '#ff0000');
    const payload = b.build('Triangle');
    const object = snoObjectFromPayload(payload);
    expect(object.positions).toEqual([0, 0, 0, 1 * TICKS_PER_UNIT + 60, 0, 0, 0, 2 * TICKS_PER_UNIT, 0]);
    expect(object.faces).toEqual([[0, 1, 2]]);
    expect(object.colors[0]).toEqual([1, 0, 0]);
    expect(object.faceColorIndices).toEqual([0]);
  });

  it('run-length face colours expand as published (-N repeats the previous entry N times)', () => {
    expect(expandFaceColors([2, -3, 1], 5)).toEqual([2, 2, 2, 2, 1]);
    expect(() => expandFaceColors([-1], 1)).toThrow();
    expect(() => expandFaceColors([0, -3], 2)).toThrow();
    expect(() => expandFaceColors([0], 2)).toThrow();
  });
});
