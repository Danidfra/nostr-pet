/**
 * The paper textures are painted inside React's commit (a room change), so
 * a canvas the browser gives no 2D context (Chrome, once its canvas budget
 * is spent) must not throw there: the painters return null and say so, and
 * the scene draws the surface flat instead.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawSurface, paperBump } from './paper-textures';

const SURFACE = { style: 'planks', palette: ['#c8a070', '#b08050'], variant: undefined, angle: undefined } as unknown as Parameters<typeof drawSurface>[0];

afterEach(() => vi.restoreAllMocks());

describe('paper textures without a 2D context', () => {
  it('return null and warn instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(() => drawSurface(SURFACE, 8, 8, 1, 2)).not.toThrow();
    expect(drawSurface(SURFACE, 8, 8, 1, 2)).toBeNull();
    expect(paperBump()).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/no 2D context/));
  });
});
