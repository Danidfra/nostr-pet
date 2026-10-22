/**
 * The Worlds door, end to end through the real router, the real login store,
 * the guest store and the save's ceremony (a relay that records,
 * underneath; the same harness as m14-play-first).
 *
 * A guest sees the globe at the top left of both homes, locked: a tap says
 * why and offers the save's own ceremony, never the worlds. The menu has no
 * Worlds tile any more. A save confirmed on the relays opens the door, and
 * the button wears the look guide's glow and bubble once; a reload finds it
 * open and quiet. A save refused halfway leaves it locked, and says nothing.
 * A save confirmed only on the next visit opens it then, with the word.
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
import { withActiveTime, withEvents, withMigrationStage } from '@/features/guest/guest-context';
import { eggTemplate, newEggPreview, profileTemplate } from '@/features/adoption/adoption-plan';
import { finalizeTemplate } from '@/features/care/usePublishAdapter';
import { EXPERIENCE_STORAGE_KEY, ROOM_INTRO_STORAGE_KEY } from '@/lib/home-experience';
import { WORLDS_GUIDE_STORAGE_PREFIX, resetWorldsAccessSeen } from '@/features/worlds/worlds-access';

const LOGIN_KEY = 'nostr:login';

/* ─── The relays underneath: everything offered to them is recorded ─────── */
const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[], refuse: new Set<number>() };
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
  if (relay.refuse.has(ev.kind)) throw new AggregateError([new Error('blocked: no')], `relay refused kind ${ev.kind}`);
  relay.published.push(ev);
  if (ev.kind === KIND_BLOBBI_STATE || ev.kind === KIND_BLOBBONAUT_PROFILE) relay.all = relay.all.filter((e) => !(e.kind === ev.kind && e.pubkey === ev.pubkey && getTagValue(e.tags, 'd') === getTagValue(ev.tags, 'd')));
  relay.all.push(ev);
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
const wordShownFor = (pubkey: string) => window.localStorage.getItem(WORLDS_GUIDE_STORAGE_PREFIX + pubkey);
const globe = () => screen.getByTestId('worlds-button');

/** A guest who adopted, hatched and cared once (the record as the app writes it). */
async function seedGuest(name = 'Pip'): Promise<StoredGuestDocument> {
  const sk = generateSecretKey();
  const identity = { nsec: nip19.nsecEncode(sk), pubkey: getPublicKey(sk) };
  const signer = localRecordSigner(identity.pubkey);
  const preview = newEggPreview(identity.pubkey, name, Math.floor(Date.now() / 1000) - 600);
  const eggTpl = eggTemplate(preview);
  const now = String(Math.floor(Date.now() / 1000) - 60);
  const tpl = { ...eggTpl, tags: updateBlobbiTags(eggTpl.tags, { stage: 'baby', state: 'active', progression_state: 'none', last_interaction: now, last_decay_at: now }), content: '' };
  const blobbi = await signer.signEvent(finalizeTemplate({ ...tpl, created_at: Number(now) }));
  const profile = await signer.signEvent(finalizeTemplate(profileTemplate({ ownerPubkey: identity.pubkey, profile: null, d: preview.d, suggestedName: 'Blobbonaut' })));
  let doc = createGuestDocument(identity);
  doc = withEvents(doc, applyGuestEvent(doc.events, blobbi), blobbi);
  doc = withEvents(doc, applyGuestEvent(doc.events, profile), profile);
  const receipt = await signer.signEvent({ kind: KIND_BLOBBI_INTERACTION, tags: [['a', `${KIND_BLOBBI_STATE}:${identity.pubkey}:${preview.d}`]], content: '', created_at: Number(now) });
  doc = withEvents(doc, applyGuestEvent(doc.events, receipt), receipt);
  // No invitation in these tests: the save is asked for from the locked door
  doc = withActiveTime(doc, 0);
  writeGuestDocument(doc, window.localStorage);
  return doc;
}

async function skipProfile() {
  const scene = await screen.findByTestId('save-profile');
  for (let i = 0; i < 3; i += 1) await userEvent.click(within(scene).getByTestId('save-profile-skip'));
}

async function throughTheKey() {
  await screen.findByTestId('save-intro');
  await userEvent.click(screen.getByTestId('save-go'));
  await screen.findByTestId('nsec-box');
  await userEvent.click(screen.getByTestId('nsec-copy'));
  await userEvent.click(screen.getByTestId('key-saved'));
  await userEvent.click(screen.getByTestId('onboarding-continue'));
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
beforeEach(() => {
  relay.all = [];
  relay.published = [];
  relay.refuse = new Set();
  window.localStorage.clear();
  resetWorldsAccessSeen();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
  Object.assign(URL, { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} });
  HTMLAnchorElement.prototype.click = () => {};
});
afterEach(() => cleanup());

describe('the Worlds door for a guest', () => {
  it('top left, locked: a tap says why and offers the save, never the worlds; the menu no longer has a Worlds tile', async () => {
    await seedGuest();
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    const top = screen.getByTestId('hud-top');
    expect(within(top).getByTestId('worlds-button')).toBe(globe());
    expect(globe()).toHaveAttribute('data-locked', 'true');
    expect(within(globe()).getByTestId('worlds-button-lock')).toBeInTheDocument();
    expect(globe()).toHaveAccessibleName(/locked: they open once Pip is saved/);
    // The globe comes first on the left, before the guest's word
    expect(globe().compareDocumentPosition(screen.getByTestId('guest-status')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await userEvent.click(globe());
    expect(screen.queryByTestId('worlds-sheet')).toBeNull();
    const word = screen.getByTestId('worlds-locked-word');
    expect(word).toHaveTextContent('Worlds open once Pip is saved to an account.');
    expect(globe()).toHaveAttribute('aria-expanded', 'true');
    // Put away with Escape, and with a tap anywhere else
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByTestId('worlds-locked-word')).toBeNull();
    await userEvent.click(globe());
    await userEvent.click(screen.getByTestId('hud-name'));
    expect(screen.queryByTestId('worlds-locked-word')).toBeNull();

    await userEvent.click(screen.getByTestId('menu-button'));
    const menu = await screen.findByTestId('menu-sheet');
    expect(within(menu).queryByTestId('menu-worlds')).toBeNull();
    expect(within(menu).queryByText('Worlds')).toBeNull();
    await userEvent.keyboard('{Escape}');

    // The word's Save is the one ceremony every other Save opens
    await userEvent.click(globe());
    await userEvent.click(screen.getByTestId('worlds-locked-save'));
    expect(await screen.findByTestId('save-intro')).toBeInTheDocument();
    expect(relay.published).toEqual([]);
  }, 30_000);

  it('in the room too: the globe at the left of the header, locked the same way', async () => {
    await seedGuest();
    window.localStorage.setItem(EXPERIENCE_STORAGE_KEY, 'room');
    // The room's first-visit introduction holds the surface; seen, the menu opens at once
    window.localStorage.setItem(ROOM_INTRO_STORAGE_KEY, 'seen');
    renderApp('/room');
    await screen.findByTestId('room-shell', {}, { timeout: 8000 });
    const header = screen.getByTestId('room-header');
    expect(within(header).getByTestId('worlds-button')).toHaveAttribute('data-locked', 'true');
    await userEvent.click(globe());
    expect(screen.queryByTestId('worlds-sheet')).toBeNull();
    expect(screen.getByTestId('worlds-locked-word')).toHaveTextContent(/Pip is saved/);
    await userEvent.click(screen.getByTestId('room-menu'));
    expect(within(await screen.findByTestId('menu-sheet')).queryByTestId('menu-worlds')).toBeNull();
  }, 30_000);

  it('a confirmed save opens the door, and the button glows with the look guide\'s bubble once; a reload finds it open and quiet', async () => {
    const doc = await seedGuest();
    const first = renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    await userEvent.click(globe());
    await userEvent.click(screen.getByTestId('worlds-locked-save'));
    await throughTheKey();
    await skipProfile();
    await screen.findByTestId('save-done', {}, { timeout: 10_000 });
    await waitFor(() => expect(guestDoc()?.migration?.stage).toBe('done'));
    // Nothing said while the celebration is on screen
    expect(screen.queryByTestId('worlds-guide')).toBeNull();
    expect(wordShownFor(doc.identity.pubkey)).toBeNull();
    await userEvent.click(screen.getByTestId('save-done'));
    await waitFor(() => expect(guestDoc()).toBeNull());
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });

    // Open, the lock gone, and the word: the look guide's bubble and glow (still, for reduced motion)
    await waitFor(() => expect(globe()).toHaveAttribute('data-locked', 'false'));
    expect(screen.queryByTestId('worlds-button-lock')).toBeNull();
    const bubble = await screen.findByTestId('worlds-guide');
    expect(bubble).toHaveClass('look-guide');
    expect(bubble).toHaveAttribute('data-reduced', 'true');
    expect(bubble).toHaveTextContent('Worlds are open!');
    expect(globe()).toHaveAttribute('data-guide', 'true');
    expect(globe()).toHaveClass('worlds-button--guide', 'worlds-button--still');
    expect(wordShownFor(doc.identity.pubkey)).toBe('shown');

    // The bubble is the door: the worlds, open for the very same Blobbi
    await userEvent.click(bubble);
    const sheet = await screen.findByTestId('worlds-sheet');
    expect(within(sheet).getByTestId('world-island')).toHaveAttribute('data-open', 'true');
    expect(within(sheet).getByTestId('world-island')).not.toHaveAttribute('data-guest');
    expect(screen.queryByTestId('worlds-guide')).toBeNull();

    // A reload: open from the start, and the word is not said again
    first.unmount();
    resetWorldsAccessSeen();
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    expect(globe()).toHaveAttribute('data-locked', 'false');
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(screen.queryByTestId('worlds-guide')).toBeNull();
    expect(globe()).not.toHaveAttribute('data-guide');
  }, 60_000);

  it('a save refused halfway leaves the door locked and says nothing', async () => {
    const doc = await seedGuest();
    relay.refuse.add(KIND_BLOBBONAUT_PROFILE);
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    await userEvent.click(globe());
    await userEvent.click(screen.getByTestId('worlds-locked-save'));
    await throughTheKey();
    await skipProfile();
    await screen.findByTestId('save-failed', {}, { timeout: 10_000 });
    expect(guestDoc()?.migration?.stage).toBe('publishing');
    // Whatever is under the ceremony: locked, no word due or remembered
    for (const button of screen.queryAllByTestId('worlds-button')) expect(button).toHaveAttribute('data-locked', 'true');
    expect(screen.queryByTestId('worlds-guide')).toBeNull();
    expect(wordShownFor(doc.identity.pubkey)).toBeNull();
  }, 60_000);

  it('a save that landed but was read back only on the next visit opens the door then, with the word', async () => {
    const doc = await seedGuest();
    writeGuestDocument(withMigrationStage(doc, 'verifying'), window.localStorage);
    const signer = localRecordSigner(doc.identity.pubkey);
    const blobbi = await signer.signEvent(finalizeTemplate({ kind: KIND_BLOBBI_STATE, tags: doc.events.find((e) => e.kind === KIND_BLOBBI_STATE)!.tags, content: '' }));
    const profile = await signer.signEvent(finalizeTemplate({ kind: KIND_BLOBBONAUT_PROFILE, tags: doc.events.find((e) => e.kind === KIND_BLOBBONAUT_PROFILE)!.tags, content: '' }));
    relay.all = [{ ...blobbi, sig: 'f'.repeat(128) }, { ...profile, sig: 'f'.repeat(128) }];
    window.localStorage.setItem(LOGIN_KEY, JSON.stringify([{ id: 'nsec1', type: 'nsec', pubkey: doc.identity.pubkey, createdAt: new Date().toISOString(), data: { nsec: doc.identity.nsec } }]));
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    await waitFor(() => expect(guestDoc()).toBeNull());
    await waitFor(() => expect(globe()).toHaveAttribute('data-locked', 'false'));
    expect(await screen.findByTestId('worlds-guide')).toBeInTheDocument();
    expect(relay.published).toEqual([]);
  }, 30_000);
});
