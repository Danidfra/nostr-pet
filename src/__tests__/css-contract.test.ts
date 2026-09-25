/**
 * The stylesheet is part of the composition, and jsdom does not lay out. The
 * rules that decide whether the room moves, where the door sits and how
 * the shadow follows the walk are pinned here as text, the way the room
 * space constants are pinned in room-space.test.ts.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RENDERER_WALK_CYCLE_S } from '@/features/home/scene/motion-contract';

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
const block = (selector: string) => {
  const start = css.indexOf(`  ${selector} {`);
  expect(start, `a rule for ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
};

describe('the stylesheet contract', () => {
  it('the care chooser is taken out of the flow: absolute, anchored to the top of the dock', () => {
    const rule = block('.care-options');
    expect(rule).toMatch(/position:\s*absolute/);
    expect(rule).toMatch(/bottom:\s*100%/);
    expect(block('.hud-bottom')).toMatch(/position:\s*relative/);
  });

  it('the shadow follows the renderer walk cycle and phase, twice per cycle, and never moves the body', () => {
    const rule = block(".scene-actor[data-motion='walking'] .scene-actor__shadow");
    expect(rule).toMatch(/animation:\s*actor-shadow-walk calc\(var\(--walk-cycle, 0\.56s\) \/ 2\)/);
    expect(rule).toMatch(/animation-delay:\s*calc\(var\(--blobbi-motion-phase, 0\) \* -1 \* var\(--walk-cycle, 0\.56s\)\)/);
    expect(css).not.toMatch(/\.scene-actor__box[^{]*\{[^}]*animation:\s*blobbi-motion/);
    expect(`${RENDERER_WALK_CYCLE_S}s`).toBe('0.56s');
  });

  it('overlays are layers of the game: anchored to the game column, rising from its bottom, sized per screen, never a drawer or a floating modal', () => {
    const root = block('.overlay-root');
    expect(root).toMatch(/position:\s*absolute/);
    expect(root).toMatch(/inset:\s*0/);
    expect(root).toMatch(/align-items:\s*flex-end/);
    const panel = block('.overlay-panel');
    expect(panel).toMatch(/border-radius:\s*1\.75rem 1\.75rem 0 0/);
    expect(panel).toMatch(/animation:\s*overlay-up/);
    expect(block(".overlay-panel[data-size='tall']")).toMatch(/height:\s*92%/);
    expect(block(".overlay-panel[data-size='medium']")).toMatch(/max-height:\s*82%/);
    expect(block('.game-column')).toMatch(/position:\s*relative/);
    expect(css).not.toMatch(/\.sheet-panel/);
    expect(css).not.toMatch(/\.overlay-root \{[^}]*position:\s*fixed/);
  });

  it('the Blobbi has one ground shadow: the old ground glow is gone from the stylesheet', () => {
    expect(css).not.toContain('.scene-actor__ground');
    expect(css).not.toContain('--home-ground-glow');
  });

  it("the window's light is its own width and short", () => {
    const light = block('.decor-window__light');
    expect(light).toMatch(/left:\s*6%/);
    expect(light).toMatch(/right:\s*6%/);
    expect(light).toMatch(/height:\s*70%/);
  });

  it('reduced motion stops the chooser, the overlays and the shadow', () => {
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    for (const selector of ['.care-options', '.overlay-panel', '.overlay-backdrop', ".scene-actor[data-motion='walking'] .scene-actor__shadow"]) expect(reduced).toContain(selector);
  });
});
