import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NeedBubbles } from './NeedBubbles';
import type { StatItem } from '../BlobbiStatusPanel';

const items: StatItem[] = [
  { stat: 'hunger', value: 12, status: 'critical' },
  { stat: 'happiness', value: 40, status: 'warning' },
  { stat: 'hygiene', value: 90, status: 'normal' },
  { stat: 'energy', value: 30, status: 'warning' },
  { stat: 'health', value: 95, status: 'normal' },
];

describe('NeedBubbles', () => {
  it('shows nothing when every stat is fine', () => {
    render(<NeedBubbles items={items.map((i) => ({ ...i, status: 'normal' }))} />);
    expect(screen.queryByTestId('need-bubbles')).toBeNull();
  });

  it('shows the worst two needs, critical first, as accessible list items', () => {
    render(<NeedBubbles items={items} />);
    const list = screen.getByRole('list', { name: 'Needs' });
    const bubbles = list.querySelectorAll('[role="listitem"]');
    expect(bubbles).toHaveLength(2);
    expect(bubbles[0]).toHaveAttribute('data-testid', 'need-hunger');
    expect(bubbles[0]).toHaveAttribute('aria-label', 'hungry, urgently');
    expect(bubbles[1]).toHaveAttribute('data-testid', 'need-energy'); // 30 is lower than 40
    expect(screen.queryByTestId('need-happiness')).toBeNull();
  });
});
