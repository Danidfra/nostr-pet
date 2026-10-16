/**
 * The 2D home's "Clean" is "Care" (M15 care refinement): the verb's word and
 * its options' name say Care, the id stays `clean`; its carousel offers the
 * hygiene items first and then the health ones (medicine), and a thin
 * "Health" divider names the health group while one of them is in the
 * middle. The status panel's hygiene stat keeps its own word, "Clean".
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { parseModernBlobbiEvent } from '@blobbi-kit/core';
import { availableCareActions } from '@/features/care';
import { verbEntries, type CareEntry } from '@/features/care-ui/care-entries';
import { buildGameItemAddress } from '@nostr-games/inventory';
import { OFFICIAL_ITEM_ISSUER } from '@/features/inventory/issuers';
import { blobbiEvent } from '@/test/fixtures';
import { BlobbiStatusPanel } from '../BlobbiStatusPanel';
import { CareOptions } from './CareOptions';

const item = (itemId: string, name: string, action: string) => ({ itemId, name, address: `30078:x:${itemId}`, glyph: { type: 'emoji', text: '•' }, care: { action, effects: {} } });
const starter = (itemId: string, name: string, action: string) => ({ item: item(itemId, name, action), usability: { ok: true } }) as never;
const owned = (itemId: string, name: string, action: string, quantity = 1) => ({ item: item(itemId, name, action), usability: { ok: true }, quantity, inventoryAddress: 'inv:1' }) as never;

describe('Care', () => {
  it('the verb reads "Care" with the id clean', () => {
    const blobbi = parseModernBlobbiEvent(blobbiEvent('0000000042', { name: 'Brook', stage: 'baby', state: 'active' }))!;
    const clean = availableCareActions(blobbi).find((a) => a.action === 'clean');
    expect(clean).toMatchObject({ action: 'clean', label: 'Care', available: true });
  });

  it('hygiene first, then health: starters then owned within each group (an owned medicine never jumps ahead of the hygiene)', () => {
    const entries = verbEntries('clean', {
      starters: [starter('blobbi:hygiene:soap', 'Soap', 'clean'), starter('blobbi:medicine:bandage', 'Bandage', 'medicine'), starter('blobbi:hygiene:shampoo', 'Shampoo', 'clean')],
      items: [owned('blobbi:medicine:vitamins', 'A Vitamin', 'medicine'), owned('blobbi:hygiene:soap', 'Soap', 'clean')],
    });
    expect(entries.map((e) => `${e.action}:${e.name}:${e.choice.source}`)).toEqual(['clean:Soap:starter', 'clean:Shampoo:starter', 'clean:Soap:owned', 'medicine:Bandage:starter', 'medicine:A Vitamin:owned']);
  });

  it('the official Shampoo and Soft Towel are not care actions of their own (M15 cleanup): never offered, as a starter or owned; another issuer\'s item of the same name is', () => {
    const official = (d: string, name: string) => ({ ...item(d, name, 'clean'), address: buildGameItemAddress(OFFICIAL_ITEM_ISSUER, d) });
    const entries = verbEntries('clean', {
      starters: [starter('blobbi:hygiene:soap', 'Soap', 'clean'), { item: official('blobbi:hygiene:shampoo', 'Shampoo'), usability: { ok: true } } as never, { item: official('blobbi:hygiene:soft-towel', 'Soft Towel'), usability: { ok: true } } as never],
      items: [{ item: official('blobbi:hygiene:shampoo', 'Shampoo'), usability: { ok: true }, quantity: 3, inventoryAddress: 'inv:1' } as never, owned('blobbi:hygiene:shampoo', 'Shampoo', 'clean')],
    });
    // Only the soap, and the other issuer's "Shampoo" (its own item, not the official one)
    expect(entries.map((e) => `${e.name}:${e.choice.source}`)).toEqual(['Soap:starter', 'Shampoo:owned']);
    expect(entries[1].choice.source === 'owned' && entries[1].choice.entry.item.address).toBe('30078:x:blobbi:hygiene:shampoo');
  });

  it('other verbs keep their order: their starters, then what the player owns', () => {
    const entries = verbEntries('feed', {
      starters: [starter('blobbi:food:apple', 'Apple', 'feed'), starter('blobbi:drink:juice', 'Juice', 'boost')],
      items: [owned('blobbi:food:cake', 'Cake', 'feed')],
    });
    expect(entries.map((e) => e.name)).toEqual(['Apple', 'Juice', 'Cake']);
  });

  it('a thin "Health" divider while a health item is in the middle; none on the hygiene ones; the group is named Care', () => {
    const entries: CareEntry[] = verbEntries('clean', { starters: [starter('blobbi:hygiene:soap', 'Soap', 'clean'), starter('blobbi:medicine:bandage', 'Bandage', 'medicine')], items: [] });
    const { rerender } = render(<CareOptions verb="clean" entries={entries} focusedKey={entries[0].key} onFocus={() => {}} onChoose={() => {}} />);
    expect(screen.getByRole('group', { name: 'Care: choose an item' })).toBeInTheDocument();
    expect(screen.queryByTestId('care-group')).toBeNull();
    rerender(<CareOptions verb="clean" entries={entries} focusedKey={entries[1].key} onFocus={() => {}} onChoose={() => {}} />);
    expect(screen.getByTestId('care-group')).toHaveTextContent('Health');
  });

  it('the status panel’s hygiene stat keeps "Clean"', () => {
    render(<BlobbiStatusPanel items={[{ stat: 'hygiene', value: 50, status: 'ok' } as never]} />);
    expect(screen.getByText('Clean')).toBeInTheDocument();
  });
});
