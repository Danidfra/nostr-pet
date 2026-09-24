import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FLOOR_FRONT, FLOOR_LINE, ROOM_ASPECT, clampPlacement, fitCanvas, floorFromRoom, roomFromFloor, roomFromViewport, roomRegion, roomToCss, roomToViewport, roundRoomPoint } from './room-space';
import { FLOOR_BAND } from '../scene/geometry';

const PHONE_S = { width: 360, height: 560 };
const PHONE_L = { width: 430, height: 700 };
const TABLET = { width: 768, height: 900 };
const DESKTOP = { width: 1000, height: 650 };
const WIDE = { width: 1800, height: 900 };

describe('fitCanvas', () => {
  it('is the largest 4:5 box that fits, resting on the bottom, centred', () => {
    expect(fitCanvas(PHONE_S)).toEqual({ left: 0, top: 110, width: 360, height: 450 }); // width-limited: wall bleeds above
    expect(fitCanvas(DESKTOP)).toEqual({ left: 240, top: 0, width: 520, height: 650 }); // height-limited: floor bleeds to the sides
    expect(fitCanvas({ width: 400, height: 500 })).toEqual({ left: 0, top: 0, width: 400, height: 500 });
    for (const box of [fitCanvas(PHONE_S), fitCanvas(PHONE_L), fitCanvas(TABLET), fitCanvas(DESKTOP), fitCanvas(WIDE)]) {
      expect(box.width / box.height).toBeCloseTo(ROOM_ASPECT, 2);
    }
  });

  it('never stretches: a taller or wider viewport only adds bleed', () => {
    const tall = fitCanvas({ width: 360, height: 900 });
    expect(tall.width).toBe(360);
    expect(tall.top).toBe(450);
    const wide = fitCanvas({ width: 2000, height: 500 });
    expect(wide.height).toBe(500);
    expect(wide.width).toBe(400);
  });

  it('gives a zero box for a degenerate viewport instead of NaN', () => {
    expect(fitCanvas({ width: 0, height: 500 })).toEqual({ left: 0, top: 0, width: 0, height: 0 });
    expect(roomFromViewport({ x: 10, y: 10 }, fitCanvas({ width: 0, height: 0 }))).toEqual({ x: 0.5, y: FLOOR_LINE });
  });
});

describe('the same room point is the same place at every size', () => {
  const bed = { x: 0.78, y: 0.86 };
  const picture = { x: 0.2, y: 0.3 };
  it('maps to the same fraction of the canvas on a small phone, a large phone, a tablet, a desktop and a wide screen', () => {
    for (const viewport of [PHONE_S, PHONE_L, TABLET, DESKTOP, WIDE]) {
      const box = fitCanvas(viewport);
      for (const point of [bed, picture]) {
        const px = roomToViewport(point, box);
        expect((px.x - box.left) / box.width).toBeCloseTo(point.x, 6);
        expect((px.y - box.top) / box.height).toBeCloseTo(point.y, 6);
        const back = roomFromViewport(px, box);
        expect(back.x).toBeCloseTo(point.x, 6);
        expect(back.y).toBeCloseTo(point.y, 6);
      }
    }
  });

  it('keeps the bed the same distance below the horizon relative to the room, whatever the screen', () => {
    for (const viewport of [PHONE_S, DESKTOP, WIDE]) {
      const box = fitCanvas(viewport);
      const horizonPx = box.top + FLOOR_LINE * box.height;
      const bedPx = roomToViewport(bed, box);
      expect((bedPx.y - horizonPx) / box.height).toBeCloseTo(bed.y - FLOOR_LINE, 6);
    }
  });

  it('renders as canvas percentages, so CSS needs no pixels at all', () => {
    expect(roomToCss(bed)).toEqual({ left: '78.000%', top: '86.000%' });
  });
});

describe('floor and room points', () => {
  it('the walking space is the floor band of the canvas, and the scene geometry agrees', () => {
    expect(FLOOR_BAND).toEqual({ top: FLOOR_LINE, bottom: FLOOR_FRONT });
    expect(roomFromFloor({ x: 0.5, y: 0 })).toEqual({ x: 0.5, y: FLOOR_LINE });
    expect(roomFromFloor({ x: 0.5, y: 1 })).toEqual({ x: 0.5, y: FLOOR_FRONT });
    expect(floorFromRoom({ x: 0.3, y: FLOOR_LINE + 0.5 * (FLOOR_FRONT - FLOOR_LINE) }).y).toBeCloseTo(0.5);
    expect(floorFromRoom({ x: 0.3, y: 0.1 }).y).toBe(0); // a wall point lands on the wall line
    expect(floorFromRoom({ x: 0.3, y: 1 }).y).toBe(1);
  });

  it('knows which region a point is in', () => {
    expect(roomRegion(0.3)).toBe('wall');
    expect(roomRegion(FLOOR_LINE)).toBe('floor');
    expect(roomRegion(0.9)).toBe('floor');
  });
});

describe('clampPlacement', () => {
  it('keeps a floor object on the floor band with its whole width inside the canvas', () => {
    expect(clampPlacement({ x: 0.02, y: 0.2 }, { layer: 'floor', width: 0.2 })).toEqual({ x: 0.1, y: FLOOR_LINE });
    expect(clampPlacement({ x: 1.2, y: 2 }, { layer: 'front', width: 0.3 })).toEqual({ x: 0.85, y: FLOOR_FRONT });
    expect(clampPlacement({ x: 0.5, y: 0.8 }, { layer: 'floor', width: 0.2 })).toEqual({ x: 0.5, y: 0.8 });
  });

  it('keeps a wall object on the wall, hanging no higher than its own height allows', () => {
    expect(clampPlacement({ x: 0.5, y: 0.9 }, { layer: 'back', width: 0.1, height: 0.1 })).toEqual({ x: 0.5, y: FLOOR_LINE });
    expect(clampPlacement({ x: 0.5, y: 0.02 }, { layer: 'back', width: 0.1, height: 0.1 })).toEqual({ x: 0.5, y: 0.1 });
    expect(clampPlacement({ x: -1, y: 0.4 }, { layer: 'back', width: 0.3 })).toEqual({ x: 0.15, y: 0.4 });
  });

  it('is idempotent and survives junk', () => {
    const once = clampPlacement({ x: Number.NaN, y: Number.POSITIVE_INFINITY }, { layer: 'floor', width: 0.2 });
    expect(clampPlacement(once, { layer: 'floor', width: 0.2 })).toEqual(once);
    expect(once).toEqual({ x: 0.1, y: FLOOR_FRONT });
  });

  it('rounds stored coordinates to three decimals', () => {
    expect(roundRoomPoint({ x: 0.123456, y: 0.98765 })).toEqual({ x: 0.123, y: 0.988 });
  });
});

describe('the stylesheet agrees with the space', () => {
  it('declares the same aspect and floor line the transform uses', () => {
    const css = readFileSync(resolve(__dirname, '../../../index.css'), 'utf8');
    expect(css).toContain(`--room-aspect: ${ROOM_ASPECT};`);
    expect(css).toContain(`--floor-line: ${FLOOR_LINE};`);
  });
});
