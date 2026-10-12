/**
 * The egg on the naming screen must be there the first time, every time.
 *
 * Before M12.1 the preview was made in an effect after the screen mounted: the
 * first frame of the egg screen had no egg, and if the egg ever failed to
 * appear the pedestal stayed empty with Adopt enabled and no way on. Now the
 * egg is made with the screen, and an egg that cannot be made or drawn says
 * so, offers another, and keeps Adopt off.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { fireEvent, render, screen } from '@testing-library/react';
import { PUBKEY } from '@/test/fixtures';

const plan = vi.hoisted(() => ({ failCompanion: 0 }));
vi.mock('./useAdoptEgg', () => ({
  useAdoptEgg: () => ({ isPending: false, error: null, result: null, step: 'idle', reset: () => {}, adopt: vi.fn() }),
}));
vi.mock('./adoption-plan', async (importOriginal) => {
  const real = await importOriginal<typeof import('./adoption-plan')>();
  return {
    ...real,
    previewCompanion: (p: Parameters<typeof real.previewCompanion>[0]) => {
      if (plan.failCompanion > 0) {
        plan.failCompanion -= 1;
        return null;
      }
      return real.previewCompanion(p);
    },
  };
});

import { AdoptionFlow } from './AdoptionFlow';

afterEach(() => {
  plan.failCompanion = 0;
});

const noop = () => {};

describe('the egg on the naming screen', () => {
  it('is drawn in the very first render, before any effect runs', () => {
    // Server rendering runs no effects: what it returns is exactly the first frame
    const html = renderToStaticMarkup(<AdoptionFlow pubkey={PUBKEY} updateCompanionEvent={noop} refresh={noop} brief />);
    expect(html).toContain('data-drawn="true"');
    expect(html).toMatch(/data-testid="adoption-egg-art"[^>]*>.*<svg/s);
    expect(html).not.toContain('adoption-egg-missing');
  });

  it('is drawn on the first render after "Adopt an egg" from the full intro', () => {
    render(<AdoptionFlow pubkey={PUBKEY} updateCompanionEvent={noop} refresh={noop} />);
    fireEvent.click(screen.getByTestId('adoption-start'));
    const stage = screen.getByTestId('adoption-preview');
    expect(stage.dataset.drawn).toBe('true');
    expect(stage.querySelector('svg')).not.toBeNull();
    expect(screen.getByTestId('adoption-adopt')).not.toBeDisabled();
  });

  it('that cannot be drawn says so, keeps Adopt off, and offers another egg that is drawn', () => {
    plan.failCompanion = 1;
    render(<AdoptionFlow pubkey={PUBKEY} updateCompanionEvent={noop} refresh={noop} brief />);
    expect(screen.getByTestId('adoption-preview').dataset.drawn).toBe('false');
    expect(screen.getByTestId('adoption-egg-missing')).toHaveTextContent('did not appear');
    expect(screen.getByTestId('adoption-adopt')).toBeDisabled();
    const before = screen.getByTestId('adoption-preview').dataset.d;
    expect(before).toBeUndefined();
    fireEvent.click(screen.getByTestId('adoption-egg-retry'));
    expect(screen.queryByTestId('adoption-egg-missing')).toBeNull();
    expect(screen.getByTestId('adoption-preview').dataset.drawn).toBe('true');
    expect(screen.getByTestId('adoption-adopt')).not.toBeDisabled();
  });

  it('keeps the same egg while the name is typed (the picture is the event)', () => {
    render(<AdoptionFlow pubkey={PUBKEY} updateCompanionEvent={noop} refresh={noop} brief />);
    const d = screen.getByTestId('adoption-preview').dataset.d;
    expect(d).toMatch(/^blobbi-/);
    fireEvent.change(screen.getByTestId('adoption-name'), { target: { value: 'Mochi' } });
    expect(screen.getByTestId('adoption-preview').dataset.d).toBe(d);
  });
});
