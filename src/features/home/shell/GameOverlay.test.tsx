import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameOverlay } from './GameOverlay';

function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div>
      <button type="button">outside</button>
      <GameOverlay open={open} onClose={onClose} title="Details" testId="sheet">
        <button type="button">first</button>
        <a href="#x">second</a>
      </GameOverlay>
    </div>
  );
}

describe('GameOverlay', () => {
  it('renders nothing while closed', () => {
    render(<Harness open={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a labelled modal dialog that takes focus, locks the page, and restores focus on close', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<Harness open={false} onClose={onClose} />);
    screen.getByRole('button', { name: 'outside' }).focus();
    rerender(<Harness open onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Details' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toHaveAccessibleName('Close');
    rerender(<Harness open={false} onClose={onClose} />);
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'outside' }));
  });

  it('Escape, the close button and the backdrop all close it', async () => {
    const onClose = vi.fn();
    render(<Harness open onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('keeps Tab inside the panel', async () => {
    render(<Harness open onClose={() => {}} />);
    // jsdom has no layout, so the trap treats every focusable as visible only
    // when it is the active element; wrapping from the last to the first is
    // what a keyboard user must never lose.
    const items = screen.getByRole('dialog').querySelectorAll<HTMLElement>('button, a[href]');
    items[items.length - 1].focus();
    await userEvent.keyboard('{Tab}');
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('is a game screen, not a drawer: one root over everything, a fixed header with the close control first, a scrolling body', () => {
    render(<Harness open onClose={() => {}} />);
    const root = screen.getByTestId('sheet');
    expect(root).toHaveAttribute('data-overlay', 'true');
    expect(root.querySelector('.overlay-backdrop')).not.toBeNull();
    const panel = screen.getByRole('dialog');
    expect(panel.firstElementChild).toHaveClass('overlay-handle');
    expect(panel.children[1]).toHaveClass('overlay-head');
    expect(panel).toHaveAttribute('data-size', 'medium');
    expect(panel.querySelector('.overlay-body')).not.toBeNull();
    expect(document.querySelector('.sheet-panel, .sheet-root')).toBeNull();
  });
});
