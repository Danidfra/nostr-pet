import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sheet } from './Sheet';

function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div>
      <button type="button">outside</button>
      <Sheet open={open} onClose={onClose} title="Details" testId="sheet">
        <button type="button">first</button>
        <a href="#x">second</a>
      </Sheet>
    </div>
  );
}

describe('Sheet', () => {
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
});
