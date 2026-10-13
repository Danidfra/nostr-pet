/**
 * M14.1: reliability, mobile controls and the first minutes, end to end
 * through the real router, the real login store and the guest store over
 * this origin's storage (the M14 harness).
 *
 * The two account buttons work from the 3D room too: the room's menu asked
 * for the save and the sign-in but only the 2D home rendered them (the
 * desktop bug); the layers stand above both homes now. A newborn's needs
 * are healthy but not full, so the first care is wanted; the flame lights
 * only once care was really given, never for the hatch alone; a guest's
 * hatch and a registered hatch write the same first needs. The one switch
 * between the homes remembers itself, and the first 3D asks first.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_INTERACTION, KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, getTagValue, updateBlobbiTags } from '@blobbi-kit/core';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

import AppRouter from '@/AppRouter';
import { SceneSettingsProvider } from '@/features/home/scene';
import { GuestProvider, GuestTransport, createGuestStore, readGuestDocument } from '@/features/guest';
import { createGuestDocument, writeGuestDocument, type StoredGuestDocument } from '@/features/guest/guest-store';
import { localRecordSigner } from '@/features/guest/guest-signer';
import { applyGuestEvent } from '@/features/guest/guest-world';
import { withEvents } from '@/features/guest/guest-context';
import { eggTemplate, newEggPreview, profileTemplate } from '@/features/adoption/adoption-plan';
import { finalizeTemplate } from '@/features/care/usePublishAdapter';
import { NEWBORN_STATS } from '@/features/lifecycle/newborn';
import { TAPS_TO_HATCH, TAP_SETTLE_MS } from '@/features/room/lib/hatch-theater';
import { EXPERIENCE_STORAGE_KEY, ROOM_INTRO_STORAGE_KEY } from '@/lib/home-experience';
import { chooseCare } from '@/test/care-ui';

const LOGIN_KEY = 'nostr:login';

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[] };
function matches(event: NostrEvent, f: NostrFilter): boolean {
  if (f.kinds && !f.kinds.includes(event.kind)) return false;
  if (f.authors && !f.authors.includes(event.pubkey)) return false;
  return true;
}
const query = vi.fn(async (filters: NostrFilter[]): Promise<NostrEvent[]> => relay.all.filter((e) => filters.some((f) => matches(e, f))));
const event = vi.fn(async (ev: NostrEvent) => {
  relay.published.push(ev);
  relay.all = [...relay.all.filter((e) => !(e.kind === ev.kind && e.pubkey === ev.pubkey && getTagValue(e.tags, 'd') === getTagValue(ev.tags, 'd'))), ev];
});
async function* nothing() {}
const upstream = { query, event, req: () => nothing(), group: () => upstream } as unknown as NPool;

function renderApp(path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = createGuestStore(window.localStorage);
  return render(
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
}

const guestDoc = () => {
  const read = readGuestDocument(window.localStorage);
  return read.kind === 'guest' ? read.doc : null;
};
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));
const homeStage = () => screen.getByTestId('blobbi-actor').querySelector('[data-blobbi-renderer]')?.getAttribute('data-blobbi-stage');
async function tapTheShell(times: number = TAPS_TO_HATCH) {
  for (let i = 0; i < times; i++) {
    await userEvent.click(screen.getByTestId('hatch-theater-egg'));
    await wait(TAP_SETTLE_MS + 30);
  }
}

/** A guest who already adopted (and, hatched, cared so many times): the record as the app would have written it. */
async function seedGuest({ hatched = true, cared = 0, name = 'Pip' }: { hatched?: boolean; cared?: number; name?: string } = {}): Promise<StoredGuestDocument> {
  const sk = generateSecretKey();
  const identity = { nsec: nip19.nsecEncode(sk), pubkey: getPublicKey(sk) };
  const signer = localRecordSigner(identity.pubkey);
  const preview = newEggPreview(identity.pubkey, name, Math.floor(Date.now() / 1000) - 600);
  const eggTpl = eggTemplate(preview);
  const now = String(Math.floor(Date.now() / 1000) - 60);
  const tpl = hatched ? { ...eggTpl, tags: updateBlobbiTags(eggTpl.tags, { stage: 'baby', state: 'active', progression_state: 'none', last_interaction: now, last_decay_at: now }), content: '' } : eggTpl;
  const blobbi = await signer.signEvent(finalizeTemplate({ ...tpl, created_at: Number(now) }));
  const profile = await signer.signEvent(finalizeTemplate(profileTemplate({ ownerPubkey: identity.pubkey, profile: null, d: preview.d, suggestedName: 'Blobbonaut' })));
  let doc = createGuestDocument(identity);
  doc = withEvents(doc, applyGuestEvent(doc.events, blobbi), blobbi);
  doc = withEvents(doc, applyGuestEvent(doc.events, profile), profile);
  for (let i = 0; i < cared; i += 1) {
    const receipt = await signer.signEvent({ kind: KIND_BLOBBI_INTERACTION, tags: [['a', `${KIND_BLOBBI_STATE}:${identity.pubkey}:${preview.d}`], ['action', 'feed']], content: '', created_at: Number(now) + i });
    doc = withEvents(doc, applyGuestEvent(doc.events, receipt), receipt);
  }
  writeGuestDocument(doc, window.localStorage);
  return doc;
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
beforeEach(() => {
  relay.all = [];
  relay.published = [];
  window.localStorage.clear();
  query.mockClear();
  event.mockClear();
});
afterEach(() => cleanup());

describe('M14.1: the account buttons from the 3D room', () => {
  it('Save my Blobbi in the room\'s menu opens the ceremony over the room, the Blobbi still there; Maybe later closes it and nothing changed', async () => {
    const doc = await seedGuest({ cared: 1 });
    window.localStorage.setItem(EXPERIENCE_STORAGE_KEY, 'room');
    renderApp('/room');
    await screen.findByTestId('room-shell', {}, { timeout: 8000 });
    await userEvent.click(await screen.findByTestId('room-menu'));
    await userEvent.click(await screen.findByTestId('menu-save-blobbi'));
    const intro = await screen.findByTestId('save-intro');
    expect(within(intro).getByTestId('save-portrait')).toBeInTheDocument();
    expect(intro).toHaveTextContent(/Pip/);
    // The room is still underneath, the Blobbi in it
    expect(screen.getByTestId('room-shell')).toBeInTheDocument();
    expect(screen.getByTestId('room-blobbi-anchor')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('save-later'));
    expect(screen.queryByTestId('save-intro')).toBeNull();
    expect(guestDoc()?.migration).toBeNull();
    expect(guestDoc()?.identity.pubkey).toBe(doc.identity.pubkey);
    expect(relay.published).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem(LOGIN_KEY) ?? '[]')).toEqual([]);
  }, 30_000);

  it('I already have an account in the room\'s menu opens the sign-in sheet over the room with every way in; Close returns to the room, the guest untouched', async () => {
    await seedGuest();
    window.localStorage.setItem(EXPERIENCE_STORAGE_KEY, 'room');
    renderApp('/room');
    await screen.findByTestId('room-shell', {}, { timeout: 8000 });
    await userEvent.click(await screen.findByTestId('room-menu'));
    await userEvent.click(await screen.findByTestId('menu-sign-in'));
    const sheet = await screen.findByTestId('guest-sign-in');
    expect(within(sheet).getByTestId('login-extension')).toBeInTheDocument();
    expect(within(sheet).getByTestId('login-signer-app')).toBeInTheDocument();
    expect(within(sheet).getByTestId('login-bunker')).toBeInTheDocument();
    expect(within(sheet).getByTestId('login-nsec-input')).toBeInTheDocument();
    await userEvent.click(within(sheet).getByTestId('guest-sign-in-close'));
    expect(screen.queryByTestId('guest-sign-in')).toBeNull();
    expect(screen.getByTestId('room-shell')).toBeInTheDocument();
    expect(guestDoc()).not.toBeNull();
    expect(JSON.parse(window.localStorage.getItem(LOGIN_KEY) ?? '[]')).toEqual([]);
  }, 30_000);

  it('the switch to 2D from the room, and the save asked for there, both work; the ceremony survives the change of home', async () => {
    await seedGuest({ cared: 1 });
    window.localStorage.setItem(EXPERIENCE_STORAGE_KEY, 'room');
    window.localStorage.setItem(ROOM_INTRO_STORAGE_KEY, 'seen');
    renderApp('/room');
    await screen.findByTestId('room-shell', {}, { timeout: 8000 });
    await userEvent.click(screen.getByTestId('mode-2d'));
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    expect(window.localStorage.getItem(EXPERIENCE_STORAGE_KEY)).toBe('classic');
    await userEvent.click(screen.getByTestId('menu-button'));
    await userEvent.click(await screen.findByTestId('menu-save-blobbi'));
    await screen.findByTestId('save-intro');
    await userEvent.click(screen.getByTestId('save-later'));
    expect(screen.queryByTestId('save-intro')).toBeNull();
  }, 30_000);
});

describe('M14.1: the first minutes', () => {
  it('a guest\'s hatch writes a newborn with healthy, not full, needs; the flame waits for real care, then lights', async () => {
    await seedGuest({ hatched: false });
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    expect(homeStage()).toBe('egg');
    expect(screen.queryByTestId('streak-pill')).toBeNull();
    await screen.findByTestId('hatch-theater', {}, { timeout: 8000 });
    await tapTheShell();
    await waitFor(() => expect(screen.queryByTestId('hatch-theater')).toBeNull(), { timeout: 8000 });
    expect(homeStage()).toBe('baby');
    const hatched = guestDoc()!.events.find((e) => e.kind === KIND_BLOBBI_STATE)!;
    expect(getTagValue(hatched.tags, 'stage')).toBe('baby');
    for (const [stat, value] of Object.entries(NEWBORN_STATS)) expect(getTagValue(hatched.tags, stat)).toBe(String(value));
    expect(getTagValue(hatched.tags, 'care_streak')).toBe('1');
    // Hatched, not cared for: no flame yet, though the record carries a streak of 1
    expect(screen.queryByTestId('streak-pill')).toBeNull();
    await chooseCare('feed');
    await waitFor(() => expect(guestDoc()!.events.some((e) => e.kind === KIND_BLOBBI_INTERACTION)).toBe(true), { timeout: 8000 });
    await waitFor(() => expect(screen.getByTestId('streak-pill')).toHaveAttribute('data-days', '1'), { timeout: 8000 });
    expect(relay.published).toEqual([]);
  }, 40_000);

  it('a registered hatch writes the same first needs to the relays, once', async () => {
    const sk = generateSecretKey();
    const pubkey = getPublicKey(sk);
    window.localStorage.setItem(LOGIN_KEY, JSON.stringify([{ id: `nsec:${pubkey}`, type: 'nsec', pubkey, createdAt: new Date().toISOString(), data: { nsec: nip19.nsecEncode(sk) } }]));
    const preview = newEggPreview(pubkey, 'Brook', Math.floor(Date.now() / 1000) - 600);
    const signer = localRecordSigner(pubkey);
    const egg = await signer.signEvent(finalizeTemplate({ ...eggTemplate(preview), created_at: Math.floor(Date.now() / 1000) - 600 }));
    const profile = await signer.signEvent(finalizeTemplate(profileTemplate({ ownerPubkey: pubkey, profile: null, d: preview.d, suggestedName: 'Blobbonaut' })));
    relay.all = [{ ...egg, sig: '0'.repeat(128) }, { ...profile, sig: '0'.repeat(128) }];
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    await screen.findByTestId('hatch-theater', {}, { timeout: 8000 });
    await tapTheShell();
    await waitFor(() => expect(screen.queryByTestId('hatch-theater')).toBeNull(), { timeout: 10000 });
    const writes = relay.published.filter((e) => e.kind === KIND_BLOBBI_STATE);
    expect(writes).toHaveLength(1);
    expect(getTagValue(writes[0].tags, 'stage')).toBe('baby');
    for (const [stat, value] of Object.entries(NEWBORN_STATS)) expect(getTagValue(writes[0].tags, stat)).toBe(String(value));
    expect(writes[0].pubkey).toBe(pubkey);
    expect(relay.published.filter((e) => e.kind === KIND_BLOBBONAUT_PROFILE)).toHaveLength(0);
    expect(screen.queryByTestId('streak-pill')).toBeNull();
  }, 40_000);
});
