import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { parseModernBlobbiEvent, type BlobbiCompanion } from '@blobbi-kit/core';
import { blobbiEvent } from '@/test/fixtures';
import { BlobbiHero } from './BlobbiHero';

function companion(extra: string[][] = [], stage: 'egg' | 'baby' | 'adult' = 'baby', state: 'active' | 'sleeping' = 'active'): BlobbiCompanion {
  const parsed = parseModernBlobbiEvent(blobbiEvent('0000000042', { name: 'Brook', stage, state, extra }));
  if (!parsed) throw new Error('fixture must be modern');
  return parsed;
}

function renderer() {
  return document.querySelector('[data-blobbi-renderer]') as HTMLElement | null;
}

describe('BlobbiHero', () => {
  it('renders a V1 Blobbi through the canonical renderer', () => {
    render(<BlobbiHero blobbi={companion()} />);
    const el = renderer();
    expect(el).not.toBeNull();
    expect(el).toHaveAttribute('data-blobbi-generation', 'v1');
    expect(el?.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('img', { name: 'Brook' })).toBeInTheDocument();
    expect(screen.getByText('Brook')).toBeInTheDocument();
  });

  it('renders a V2 event as V2', () => {
    render(<BlobbiHero blobbi={companion([['adult_type', 'catti'], ['visual_generation', 'v2']], 'adult')} />);
    expect(renderer()).toHaveAttribute('data-blobbi-generation', 'v2');
  });

  it('renders an event with an invalid visual_generation as V1', () => {
    render(<BlobbiHero blobbi={companion([['visual_generation', 'nope']])} />);
    expect(renderer()).toHaveAttribute('data-blobbi-generation', 'v1');
  });

  it('faces front and only the standalone decides sleeping', () => {
    const { rerender } = render(<BlobbiHero blobbi={companion()} />);
    expect(renderer()).toHaveAttribute('data-blobbi-facing', 'front');
    const awakeSvg = renderer()?.innerHTML;
    rerender(<BlobbiHero blobbi={companion([], 'baby', 'sleeping')} />);
    expect(renderer()?.innerHTML).not.toBe(awakeSvg);
  });
});
