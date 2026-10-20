/**
 * The world cards show each app's own icon; an icon that cannot load leaves the card's sky with the globe, as before.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorldCardIcon, WorldsSheet } from './WorldsSheet';
import { worldById, worlds } from './worlds';
import type { BlobbiCompanion } from '@blobbi-kit/core';

vi.mock('@blobbi-kit/renderer', () => ({ BlobbiRenderer: () => null }));
vi.mock('@/lib/blobbi-visual', () => ({ toBlobbiVisual: () => ({}) }));
vi.mock('@/features/home/shell/GameOverlay', () => ({
  GameOverlay: ({ children, open }: { children: React.ReactNode; open: boolean }) => (open ? <div>{children}</div> : null),
}));

const blobbi = { name: 'Dotado', d: 'blobbi-1' } as unknown as BlobbiCompanion;

describe('the world cards', () => {
  it('each open card shows its world icon, from this origin', () => {
    render(<WorldsSheet open onClose={() => {}} blobbi={blobbi} onTravel={() => {}} />);
    for (const w of worlds()) {
      const img = screen.getByTestId(`world-icon-${w.id}`).querySelector('img');
      expect(img, w.id).not.toBeNull();
      expect(img!.getAttribute('src')).toBe(w.icon);
      expect(img!.getAttribute('alt')).toBe('');
    }
  });

  it('an icon that cannot load falls back to the globe on the sky; a closed door shows the lock', () => {
    const island = worldById('island')!;
    const { rerender } = render(<WorldCardIcon world={island} open />);
    const tile = screen.getByTestId('world-icon-island');
    expect(tile.getAttribute('data-fallback')).toBeNull();
    fireEvent.error(tile.querySelector('img')!);
    expect(tile.getAttribute('data-fallback')).toBe('true');
    expect(tile.querySelector('img')).toBeNull();
    expect(tile.querySelector('svg')).not.toBeNull();
    rerender(<WorldCardIcon world={island} open={false} />);
    expect(screen.getByTestId('world-icon-island').querySelector('img')).toBeNull();
  });
});
