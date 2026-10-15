/**
 * M15 integration: the two tracks meeting. The bath (Track A) is a busy
 * moment, and the invitation to save and the blocking-layer queue (Track B)
 * must read it: the invitation never rises over a bath, its celebration
 * included, and comes in the first quiet moment after; a sheet the player
 * opens during a bath is one layer over it, and closing it gives the bath
 * back as it was. Real router, a guest's world, fake relays, nothing
 * published.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_INTERACTION, KIND_BLOBBI_STATE, getTagValue, updateBlobbiTags } from '@blobbi-kit/core';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

import AppRouter from '@/AppRouter';
import { SceneSettingsProvider } from '@/features/home/scene';
import { GuestProvider, GuestTransport, createGuestStore, readGuestDocument } from '@/features/guest';
import { createGuestDocument, writeGuestDocument, type StoredGuestDocument } from '@/features/guest/guest-store';
import { localRecordSigner } from '@/features/guest/guest-signer';
import { applyGuestEvent } from '@/features/guest/guest-world';
import { withActiveTime, withEvents } from '@/features/guest/guest-context';
import { INVITE_ACTIVE_MS, INVITE_DELAY_MS } from '@/features/guest/guest-session';
import { eggTemplate, newEggPreview, profileTemplate } from '@/features/adoption/adoption-plan';
import { finalizeTemplate } from '@/features/care/usePublishAdapter';
import { blockingHolder } from '@/lib/blocking-layer';
import { chooseCare, playBath } from '@/test/care-ui';

const LOGIN_KEY = 'nostr:login';

/* ─── The relays underneath ─────────────────────────────────────────────── */
const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[] };
function matches(event: NostrEvent, f: NostrFilter): boolean {
  if (f.kinds && !f.kinds.includes(event.kind)) return false;
  if (f.authors && !f.authors.includes(event.pubkey)) return false;
  for (const [key, values] of Object.entries(f)) {
    if (!key.startsWith('#')) continue;
    if (!event.tags.some((t) => t[0] === key.slice(1) && (values as string[]).includes(t[1]))) return false;
  }
  return true;
}
const query = vi.fn(async (filters: NostrFilter[]): Promise<NostrEvent[]> => {
  const seen = new Set<string>();
  return relay.all.filter((e) => filters.some((f) => matches(e, f)) && !seen.has(e.id) && seen.add(e.id));
});
const event = vi.fn(async (ev: NostrEvent) => {
  relay.published.push(ev);
  relay.all = [...relay.all.filter((e) => !(e.kind === ev.kind && e.pubkey === ev.pubkey && getTagValue(e.tags, 'd') === getTagValue(ev.tags, 'd'))), ev];
});
async function* nothing() {}
const upstream = { query, event, req: () => nothing(), group: () => upstream } as unknown as NPool;

function renderApp(path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = createGuestStore(window.localStorage);
  const view = render(
    <SceneSettingsProvider value={{ reducedMotion: true, idleEnabled: false, walkSpeed: 4 }}>
      <NostrLoginProvider storageKey={LOGIN_KEY}>
        <GuestProvider store={store}>
          <QueryClientProvider client={client}>
            <NostrContext.Provider value={{ nostr: upstream }}>
              <GuestTransport>
                <MemoryRouter initialEntries={[path]}>
                  <AppRouter />
                </MemoryRouter>
              </GuestTransport>
            </NostrContext.Provider>
          </QueryClientProvider>
        </GuestProvider>
      </NostrLoginProvider>
    </SceneSettingsProvider>,
  );
  return { ...view, store };
}

const guestDoc = () => {
  const read = readGuestDocument(window.localStorage);
  return read.kind === 'guest' ? read.doc : null;
};
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

/** A baby that wants a bath: hygiene at 45, so the bath is not refused as squeaky clean already. */
const babyTags = (tags: string[][], now: string) =>
  [...updateBlobbiTags(tags, { stage: 'baby', state: 'active', progression_state: 'none', last_interaction: now, last_decay_at: now }).filter((t) => t[0] !== 'hygiene'), ['hygiene', '45']];

/** A guest who adopted, hatched, cared once and (unless said otherwise) played the invitation's five minutes. */
async function seedGuest({ cared = 1, name = 'Pip', activeMs = INVITE_ACTIVE_MS }: { cared?: number; name?: string; activeMs?: number } = {}): Promise<StoredGuestDocument> {
  const sk = generateSecretKey();
  const identity = { nsec: nip19.nsecEncode(sk), pubkey: getPublicKey(sk) };
  const signer = localRecordSigner(identity.pubkey);
  const preview = newEggPreview(identity.pubkey, name, Math.floor(Date.now() / 1000) - 600);
  const eggTpl = eggTemplate(preview);
  const now = String(Math.floor(Date.now() / 1000) - 60);
  const blobbi = await signer.signEvent(finalizeTemplate({ ...eggTpl, tags: babyTags(eggTpl.tags, now), content: '', created_at: Number(now) }));
  const profile = await signer.signEvent(finalizeTemplate(profileTemplate({ ownerPubkey: identity.pubkey, profile: null, d: preview.d, suggestedName: 'Blobbonaut' })));
  let doc = createGuestDocument(identity);
  doc = withEvents(doc, applyGuestEvent(doc.events, blobbi), blobbi);
  doc = withEvents(doc, applyGuestEvent(doc.events, profile), profile);
  for (let i = 0; i < cared; i += 1) {
    const receipt = await signer.signEvent({ kind: KIND_BLOBBI_INTERACTION, tags: [['a', `${KIND_BLOBBI_STATE}:${identity.pubkey}:${preview.d}`]], content: '', created_at: Number(now) + i });
    doc = withEvents(doc, applyGuestEvent(doc.events, receipt), receipt);
  }
  doc = withActiveTime(doc, activeMs);
  writeGuestDocument(doc, window.localStorage);
  return doc;
}

const consoleSpies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error'), vi.spyOn(console, 'info'), vi.spyOn(console, 'debug')];

beforeAll(() => {
  Object.assign(URL, { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} });
  HTMLAnchorElement.prototype.click = () => {};
});
beforeEach(() => {
  window.localStorage.clear();
  relay.all = [];
  relay.published = [];
  consoleSpies.forEach((s) => s.mockClear());
});
afterEach(() => {
  cleanup();
});

/** No secret of the guest's in anything the console was given. */
function nothingLeaked(doc: StoredGuestDocument) {
  for (const spy of consoleSpies) {
    for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(doc.identity.nsec);
  }
}

const guestStates = () => (guestDoc()?.events ?? []).filter((e) => e.kind === KIND_BLOBBI_STATE);

describe('M15 integration: the bath is a busy moment for the invitation and the sheets', () => {
  it('the invitation, due when the bath begins, waits through the whole bath and its celebration, then comes in the first quiet moment; one write, in the guest world, nothing published', async () => {
    const doc = await seedGuest();
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    const before = guestStates().length;
    // Due at once (cared, five active minutes): the bath begins inside the invitation's quiet delay
    await chooseCare('clean');
    expect(await screen.findByTestId('bath-bar')).toBeInTheDocument();
    await wait(INVITE_DELAY_MS + 1_000);
    expect(screen.queryByTestId('guest-invite')).toBeNull();
    await playBath({ through: 'lather' });
    await wait(INVITE_DELAY_MS + 200);
    expect(screen.queryByTestId('guest-invite')).toBeNull();
    await playBath();
    // The celebration: the write landed, the bar still up, still no invitation
    await waitFor(() => expect(screen.getByTestId('bath-bar')).toHaveAttribute('data-status', 'done'), { timeout: 4000 });
    expect(screen.queryByTestId('guest-invite')).toBeNull();
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull(), { timeout: 4000 });
    // Then the quiet moment, and the bubble
    const invite = await screen.findByTestId('guest-invite', {}, { timeout: INVITE_DELAY_MS + 6_000 });
    expect(invite).toHaveTextContent(/Pip/);
    expect(screen.queryByTestId('bath-bar')).toBeNull();
    // The bath's one write went into the guest's world, not to the relays
    // (the guest's world keeps the one current 31124, replaced by the bath's write)
    const states = guestStates();
    expect(states.length).toBe(before);
    expect(Number(getTagValue(states[0].tags, 'hygiene'))).toBeGreaterThan(45);
    expect((guestDoc()?.events ?? []).filter((e) => e.kind === KIND_BLOBBI_INTERACTION).length).toBeGreaterThanOrEqual(2);
    expect(relay.published).toEqual([]);
    nothingLeaked(doc);
  }, 60_000);

  it('a sheet opened during a bath is the one blocking layer over it; closing it gives the bath back where it was, and the invitation still waits', async () => {
    await seedGuest();
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    await chooseCare('clean');
    await playBath({ through: 'lather' });
    expect(screen.getByTestId('bath-bar')).toHaveAttribute('data-tool', 'shower');
    await userEvent.click(screen.getByTestId('menu-button'));
    await screen.findByTestId('menu-sheet');
    expect(blockingHolder()).not.toBeNull();
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1);
    expect(screen.queryByTestId('guest-invite')).toBeNull();
    await userEvent.click(screen.getByTestId('menu-sheet-close'));
    await waitFor(() => expect(screen.queryByTestId('menu-sheet')).toBeNull());
    expect(blockingHolder()).toBeNull();
    expect(screen.getByTestId('bath-bar')).toHaveAttribute('data-tool', 'shower');
    await wait(INVITE_DELAY_MS + 600);
    expect(screen.queryByTestId('guest-invite')).toBeNull();
    // Stop: nothing written, the carousel's verbs back, and only then the invitation
    const before = JSON.stringify(guestStates());
    await userEvent.click(screen.getByTestId('bath-stop'));
    await waitFor(() => expect(screen.queryByTestId('bath-bar')).toBeNull());
    expect(JSON.stringify(guestStates())).toBe(before);
    expect(Number(getTagValue(guestStates()[0].tags, 'hygiene'))).toBe(45);
    expect(screen.getByTestId('care-clean')).toBeEnabled();
    await screen.findByTestId('guest-invite', {}, { timeout: INVITE_DELAY_MS + 6_000 });
    expect(relay.published).toEqual([]);
  }, 60_000);
});
