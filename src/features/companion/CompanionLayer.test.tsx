import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NostrContext } from '@nostrify/react';
import type { NPool } from '@nostrify/nostrify';
import { blobbiEvent } from '@/test/fixtures';
import { parseBlobbiEvent } from '@blobbi-kit/core';
import type { HomeBlobbi } from '@/hooks/useHomeBlobbi';
import { CompanionLayer } from './CompanionLayer';

const home = vi.hoisted(() => ({ value: null as unknown as HomeBlobbi }));
vi.mock('@/hooks/useHomeBlobbi', () => ({ useHomeBlobbi: () => home.value }));

const BO = parseBlobbiEvent(blobbiEvent('0000000002', { name: 'Bo' }))!;
const CY = parseBlobbiEvent(blobbiEvent('0000000003', { name: 'Cy' }))!;

function homeWith(companion: NonNullable<HomeBlobbi['companion']>): HomeBlobbi {
  return { status: 'ready', pubkey: 'a'.repeat(64), companions: [BO, CY], current: BO, profile: null, error: null, select: vi.fn(), selection: { isPending: false, result: undefined, error: null }, companion, refresh: vi.fn(), updateCompanionEvent: vi.fn() };
}

const renderLayer = () =>
  render(
    <NostrContext.Provider value={{ nostr: {} as NPool }}>
      <CompanionLayer />
    </NostrContext.Provider>,
  );

beforeEach(() => vi.clearAllMocks());

describe('the companion layer', () => {
  it('says nothing while sharing works', () => {
    home.value = homeWith({ status: { kind: 'saved' }, retry: vi.fn(), ambiguity: null, resolve: vi.fn() });
    renderLayer();
    expect(screen.queryByTestId('companion-note')).toBeNull();
    expect(screen.queryByTestId('companion-choice')).toBeNull();
  });

  it('a choice not shared yet: a small card with Try again, which can be put away', async () => {
    const retry = vi.fn();
    home.value = homeWith({ status: { kind: 'waiting', reason: 'failed' }, retry, ambiguity: null, resolve: vi.fn() });
    renderLayer();
    expect(screen.getByTestId('companion-note')).toHaveTextContent("Your other Blobbi games don't know about Bo yet.");
    await userEvent.click(screen.getByTestId('companion-retry'));
    expect(retry).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByTestId('companion-note-close'));
    expect(screen.queryByTestId('companion-note')).toBeNull();
  });

  it('two choices that cannot be ordered: the player picks; closing is not an answer', async () => {
    const resolve = vi.fn();
    home.value = homeWith({ status: { kind: 'idle' }, retry: vi.fn(), ambiguity: { local: BO.d, global: CY.d }, resolve });
    renderLayer();
    expect(screen.getByTestId('companion-choice-text')).toHaveTextContent('You picked Bo here, and Cy in another Blobbi game');
    await userEvent.click(screen.getByTestId('companion-choice-global'));
    expect(resolve).toHaveBeenCalledWith('global');
  });

  it('closing the question writes nothing', async () => {
    const resolve = vi.fn();
    home.value = homeWith({ status: { kind: 'idle' }, retry: vi.fn(), ambiguity: { local: BO.d, global: CY.d }, resolve });
    renderLayer();
    await userEvent.keyboard('{Escape}');
    expect(resolve).not.toHaveBeenCalled();
    expect(screen.queryByTestId('companion-choice-text')).toBeNull();
  });
});
