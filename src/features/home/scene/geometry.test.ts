import { describe, expect, it } from 'vitest';
import {
  DEPTH_SCALE,
  DEPTH_WEIGHT,
  FLOOR_BAND,
  FLOOR_BOUNDS,
  clampToFloor,
  depthScale,
  facingFromDirection,
  floorDirection,
  floorDistance,
  floorPointFromScene,
  isAtPoint,
  placeOnFloor,
} from './geometry';

describe('scene geometry', () => {
  describe('clampToFloor', () => {
    it('keeps points inside the bounds', () => {
      expect(clampToFloor({ x: 0.5, y: 0.5 })).toEqual({ x: 0.5, y: 0.5 });
      expect(clampToFloor({ x: -1, y: 2 })).toEqual({ x: FLOOR_BOUNDS.minX, y: FLOOR_BOUNDS.maxY });
      expect(clampToFloor({ x: 1.5, y: -0.2 })).toEqual({ x: FLOOR_BOUNDS.maxX, y: FLOOR_BOUNDS.minY });
    });
    it('turns non-finite input into the nearest edge instead of NaN', () => {
      expect(clampToFloor({ x: Number.NaN, y: Number.POSITIVE_INFINITY })).toEqual({ x: FLOOR_BOUNDS.minX, y: FLOOR_BOUNDS.maxY });
    });
  });

  describe('distance and direction', () => {
    it('weighs depth so a step in y covers less than the same step in x', () => {
      expect(floorDistance({ x: 0, y: 0 }, { x: 0.5, y: 0 })).toBeCloseTo(0.5);
      expect(floorDistance({ x: 0, y: 0 }, { x: 0, y: 0.5 })).toBeCloseTo(0.5 * DEPTH_WEIGHT);
    });
    it('gives a unit-per-travel direction and zero for the same point', () => {
      const dir = floorDirection({ x: 0.2, y: 0.5 }, { x: 0.7, y: 0.5 });
      expect(dir).toEqual({ x: 1, y: 0 });
      expect(floorDirection({ x: 0.3, y: 0.3 }, { x: 0.3, y: 0.3 })).toEqual({ x: 0, y: 0 });
      // Moving straight along y: the step in floor units is larger than one because y is compressed on screen.
      const down = floorDirection({ x: 0.5, y: 0 }, { x: 0.5, y: 1 });
      expect(down.x).toBe(0);
      expect(down.y).toBeCloseTo(1 / DEPTH_WEIGHT);
    });
  });

  describe('facingFromDirection', () => {
    it('faces the side it moves towards', () => {
      expect(facingFromDirection({ x: 1, y: 0 })).toBe('right');
      expect(facingFromDirection({ x: -1, y: 0 })).toBe('left');
      expect(facingFromDirection({ x: -0.6, y: 0.4 })).toBe('left');
    });
    it('faces the viewer coming forward and away going back, only for mostly-depthwise moves', () => {
      expect(facingFromDirection({ x: 0, y: 1 })).toBe('front');
      expect(facingFromDirection({ x: 0, y: -1 })).toBe('back');
      expect(facingFromDirection({ x: 0.05, y: 2 })).toBe('front');
    });
    it('keeps the current facing when there is no direction', () => {
      expect(facingFromDirection({ x: 0, y: 0 }, 'left')).toBe('left');
    });
  });

  describe('depth scale', () => {
    it('is subtle and grows towards the front', () => {
      expect(depthScale(0)).toBe(DEPTH_SCALE.back);
      expect(depthScale(1)).toBe(DEPTH_SCALE.front);
      expect(depthScale(0.5)).toBeCloseTo((DEPTH_SCALE.back + DEPTH_SCALE.front) / 2);
      expect(DEPTH_SCALE.front - DEPTH_SCALE.back).toBeLessThanOrEqual(0.15);
      expect(depthScale(4)).toBe(DEPTH_SCALE.front);
    });
  });

  describe('placement', () => {
    it('places a point by percentage inside the floor band, feet on the line, nearer things on top', () => {
      const back = placeOnFloor({ x: 0.25, y: 0 });
      const front = placeOnFloor({ x: 0.75, y: 1 });
      expect(back.left).toBe('25.000%');
      expect(back.top).toBe(`${(FLOOR_BAND.top * 100).toFixed(3)}%`);
      expect(front.top).toBe(`${(FLOOR_BAND.bottom * 100).toFixed(3)}%`);
      expect(front.zIndex).toBeGreaterThan(back.zIndex);
      expect(front.scale).toBeGreaterThan(back.scale);
    });
    it('round-trips a scene fraction to a floor point and back', () => {
      const fraction = { x: 0.6, y: FLOOR_BAND.top + 0.3 * (FLOOR_BAND.bottom - FLOOR_BAND.top) };
      const point = floorPointFromScene(fraction);
      expect(point.x).toBeCloseTo(0.6);
      expect(point.y).toBeCloseTo(0.3);
      expect(placeOnFloor(point).top).toBe(`${(fraction.y * 100).toFixed(3)}%`);
    });
    it('clamps a tap above the horizon or beyond the edges onto the floor', () => {
      expect(floorPointFromScene({ x: 0.5, y: 0.1 }).y).toBe(FLOOR_BOUNDS.minY);
      expect(floorPointFromScene({ x: 1.2, y: 0.99 })).toEqual({ x: FLOOR_BOUNDS.maxX, y: FLOOR_BOUNDS.maxY });
    });
  });

  it('isAtPoint tolerates a hair of distance', () => {
    expect(isAtPoint({ x: 0.5, y: 0.5 }, { x: 0.502, y: 0.5 })).toBe(true);
    expect(isAtPoint({ x: 0.5, y: 0.5 }, { x: 0.52, y: 0.5 })).toBe(false);
  });
});
