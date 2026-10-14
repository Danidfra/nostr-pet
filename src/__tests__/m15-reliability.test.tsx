/**
 * M15, Track B: reliability and onboarding UX, end to end through the real
 * router, the real login store, the guest store over this origin's storage
 * and the guest transport (a relay that records, underneath).
 *
 * One blocking layer at a time: in the room, a first visit's introduction
 * and the word about a guest Blobbi for another account are shown one after
 * the other, never together. The word itself is in a child's words, with the
 * Blobbi's name and no protocol terms; closing it is "Decide later" and
 * writes nothing, so it is asked again next time; Keep is remembered for
 * that account; Remove is a separate, confirmed flow that warns when the
 * Blobbi was never saved, and removes everything of the guest's and nothing
 * of anyone else's. The invitation to save waits for five active minutes
 * and real care, in both homes; "Don't ask again" turns it off for good and
 * the menu keeps the way. The stylesheet and the page keep iPhone Safari
 * from zooming on its own.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_INTERACTION, KIND_BLOBBI_STATE, getSelectedBlobbiKey, getTagValue, updateBlobbiTags } from '@blobbi-kit/core';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

import AppRouter from '@/AppRouter';
import { SceneSettingsProvider } from '@/features/home/scene';
import { GuestProvider, GuestTransport, createGuestStore, readGuestDocument } from '@/features/guest';
import { createGuestDocument, writeGuestDocument, type StoredGuestDocument } from '@/features/guest/guest-store';
import { localRecordSigner } from '@/features/guest/guest-signer';
import { applyGuestEvent } from '@/features/guest/guest-world';
import { withActiveTime, withEvents, withLanded, withMigrationStage } from '@/features/guest/guest-context';
import { INVITE_ACTIVE_MS, INVITE_DELAY_MS } from '@/features/guest/guest-session';
import { eggTemplate, newEggPreview, profileTemplate } from '@/features/adoption/adoption-plan';
import { finalizeTemplate } from '@/features/care/usePublishAdapter';
import { EXPERIENCE_STORAGE_KEY, ROOM_INTRO_STORAGE_KEY } from '@/lib/home-experience';
import { roomStorageKey } from '@/features/home/rooms/rooms';
import { journeyStoreKey } from '@/features/journey/useJourney';
import { roomNavKey } from '@/features/room/lib/room-memory';
import { blockingHolder } from '@/lib/blocking-layer';

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
const logins = () => JSON.parse(window.localStorage.getItem(LOGIN_KEY) ?? '[]') as { type: string; pubkey: string }[];
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));
const dialogs = () => document.querySelectorAll('[role="dialog"]').length;

const babyTags = (tags: string[][], now: string) => updateBlobbiTags(tags, { stage: 'baby', state: 'active', progression_state: 'none', last_interaction: now, last_decay_at: now });

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

/** Another account, signed in, with a hatched Blobbi of its own on the relays. */
async function seedAccount(name = 'Brook'): Promise<{ pubkey: string; d: string }> {
  const sk = generateSecretKey();
  const pubkey = getPublicKey(sk);
  window.localStorage.setItem(LOGIN_KEY, JSON.stringify([{ id: `nsec:${pubkey}`, type: 'nsec', pubkey, createdAt: new Date().toISOString(), data: { nsec: nip19.nsecEncode(sk) } }]));
  const preview = newEggPreview(pubkey, name, Math.floor(Date.now() / 1000) - 6000);
  const signer = localRecordSigner(pubkey);
  const now = String(Math.floor(Date.now() / 1000) - 60);
  const eggTpl = eggTemplate(preview);
  const state = await signer.signEvent(finalizeTemplate({ ...eggTpl, tags: babyTags(eggTpl.tags, now), content: '', created_at: Number(now) }));
  const profile = await signer.signEvent(finalizeTemplate(profileTemplate({ ownerPubkey: pubkey, profile: null, d: preview.d, suggestedName: 'Blobbonaut' })));
  relay.all = [{ ...state, sig: '0'.repeat(128) }, { ...profile, sig: '0'.repeat(128) }];
  return { pubkey, d: preview.d };
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

describe('M15: one blocking layer at a time', () => {
  it("the word about a guest Blobbi and the room's first-visit introduction come one after the other, never together", async () => {
    const doc = await seedGuest();
    await seedAccount();
    window.localStorage.setItem(EXPERIENCE_STORAGE_KEY, 'room');
    expect(window.localStorage.getItem(ROOM_INTRO_STORAGE_KEY)).toBeNull();
    renderApp('/room');
    // The room's chunk loads while the word is already due: the word comes first, alone
    const conflict = await screen.findByTestId('guest-conflict', {}, { timeout: 8000 });
    expect(dialogs()).toBe(1);
    // The room is up underneath, its introduction due too, and it waits: still one dialog
    await screen.findByTestId('room-shell', {}, { timeout: 12_000 });
    await wait(300);
    expect(screen.queryByTestId('mode-intro')).toBeNull();
    expect(dialogs()).toBe(1);
    expect(screen.getByTestId('guest-conflict')).toBeInTheDocument();
    // Answered, the word makes room for the introduction; nothing was dismissed on the other's behalf
    await userEvent.click(within(conflict).getByTestId('guest-conflict-later'));
    const intro = await screen.findByTestId('mode-intro', {}, { timeout: 8000 });
    expect(screen.queryByTestId('guest-conflict')).toBeNull();
    expect(dialogs()).toBe(1);
    expect(intro).toHaveTextContent(/Let’s explore/);
    await userEvent.click(within(intro).getByText('Let’s explore'));
    await waitFor(() => expect(screen.queryByTestId('mode-intro')).toBeNull());
    expect(dialogs()).toBe(0);
    expect(guestDoc()?.identity.pubkey).toBe(doc.identity.pubkey);
    expect(guestDoc()?.conflicts).toEqual([]);
    nothingLeaked(doc);
  }, 40_000);
});

describe('M15: the word about a guest Blobbi for another account', () => {
  it("is in a child's words with the Blobbi's name and no protocol terms; Keep is remembered for this account only; the guest and its key are untouched", async () => {
    const doc = await seedGuest();
    const account = await seedAccount();
    renderApp('/');
    const conflict = await screen.findByTestId('guest-conflict', {}, { timeout: 8000 });
    const text = within(conflict).getByTestId('guest-conflict-text').textContent ?? '';
    expect(text).toMatch(/Pip lives on this device/);
    expect(text).toMatch(/Nothing has changed and nothing was deleted/);
    expect(text).toMatch(/sign out and choose Save Pip/);
    for (const word of [/nostr/i, /relay/i, /pubkey/i, /npub/i, /nsec/i, /canonical/i, /protocol/i, /event/i, /kind \d/i]) expect(text).not.toMatch(word);
    expect(text).not.toContain(doc.identity.pubkey.slice(0, 12));
    // The honest reason waits under Why, still without protocol words
    const why = within(conflict).getByTestId('guest-conflict-why');
    expect(why).toHaveTextContent(/born from its own key/);
    expect(why.textContent).not.toMatch(/nostr|relay|pubkey/i);
    await userEvent.click(within(conflict).getByTestId('guest-conflict-keep'));
    await waitFor(() => expect(screen.queryByTestId('guest-conflict')).toBeNull());
    expect(guestDoc()?.conflicts).toEqual([account.pubkey]);
    expect(guestDoc()?.identity.pubkey).toBe(doc.identity.pubkey);
    expect(guestDoc()?.identity.nsec).toBe(doc.identity.nsec);
    expect(guestDoc()?.events.length).toBe(doc.events.length);
    expect(relay.published).toEqual([]);
    expect(logins().map((l) => l.pubkey)).toEqual([account.pubkey]);
    nothingLeaked(doc);
  }, 30_000);

  it('closing it (the X, Escape, Decide later) means decide later: nothing is written, it stays away for the visit and is asked again on the next', async () => {
    const doc = await seedGuest();
    await seedAccount();
    const first = renderApp('/');
    let conflict = await screen.findByTestId('guest-conflict', {}, { timeout: 8000 });
    await userEvent.click(within(conflict).getByTestId('guest-conflict-close'));
    await waitFor(() => expect(screen.queryByTestId('guest-conflict')).toBeNull());
    expect(guestDoc()?.conflicts).toEqual([]);
    expect(blockingHolder()).toBeNull();
    // Not back on this visit, whatever happens on the page
    await wait(500);
    expect(screen.queryByTestId('guest-conflict')).toBeNull();
    first.unmount();

    // A fresh visit: asked again; Decide later (the button) is the same answer
    const second = renderApp('/');
    conflict = await screen.findByTestId('guest-conflict', {}, { timeout: 8000 });
    await userEvent.click(within(conflict).getByTestId('guest-conflict-later'));
    await waitFor(() => expect(screen.queryByTestId('guest-conflict')).toBeNull());
    expect(guestDoc()?.conflicts).toEqual([]);
    second.unmount();

    // Escape too
    renderApp('/');
    conflict = await screen.findByTestId('guest-conflict', {}, { timeout: 8000 });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('guest-conflict')).toBeNull());
    expect(guestDoc()?.conflicts).toEqual([]);
    expect(guestDoc()?.identity.pubkey).toBe(doc.identity.pubkey);
    expect(relay.published).toEqual([]);
  }, 40_000);
});

describe('M15: removing a guest Blobbi from this device', () => {
  it('is a separate sheet that warns when the Blobbi was never saved, needs an explicit acknowledgement, and can be left three ways with nothing removed', async () => {
    const doc = await seedGuest();
    await seedAccount();
    renderApp('/');
    const conflict = await screen.findByTestId('guest-conflict', {}, { timeout: 8000 });
    await userEvent.click(within(conflict).getByTestId('guest-conflict-remove'));
    let remove = await screen.findByTestId('guest-remove');
    expect(screen.queryByTestId('guest-conflict')).toBeNull();
    expect(dialogs()).toBe(1);
    expect(remove).toHaveTextContent(/Remove Pip from this device\?/);
    expect(within(remove).getByTestId('guest-remove-warning')).toHaveTextContent(/Pip has never been saved/);
    expect(within(remove).getByTestId('guest-remove-warning')).toHaveTextContent(/no way to bring Pip back/);
    expect(remove).toHaveTextContent(/Your signed-in account is not touched/);
    expect(within(remove).getByTestId('guest-remove-confirm')).toBeDisabled();
    // Cancel: back to the word, nothing removed
    await userEvent.click(within(remove).getByTestId('guest-remove-cancel'));
    await screen.findByTestId('guest-conflict');
    expect(screen.queryByTestId('guest-remove')).toBeNull();
    expect(guestDoc()?.identity.pubkey).toBe(doc.identity.pubkey);
    // The X: the same
    await userEvent.click(screen.getByTestId('guest-conflict-remove'));
    remove = await screen.findByTestId('guest-remove');
    await userEvent.click(within(remove).getByTestId('guest-remove-close'));
    await screen.findByTestId('guest-conflict');
    expect(guestDoc()?.identity.pubkey).toBe(doc.identity.pubkey);
    // Escape: the same; and the acknowledgement does not survive a cancel
    await userEvent.click(screen.getByTestId('guest-conflict-remove'));
    remove = await screen.findByTestId('guest-remove');
    await userEvent.click(within(remove).getByTestId('guest-remove-ack'));
    expect(within(remove).getByTestId('guest-remove-confirm')).toBeEnabled();
    await userEvent.keyboard('{Escape}');
    await screen.findByTestId('guest-conflict');
    await userEvent.click(screen.getByTestId('guest-conflict-remove'));
    remove = await screen.findByTestId('guest-remove');
    expect(within(remove).getByTestId('guest-remove-confirm')).toBeDisabled();
    expect(guestDoc()?.identity.pubkey).toBe(doc.identity.pubkey);
    expect(guestDoc()?.conflicts).toEqual([]);
    expect(relay.published).toEqual([]);
    nothingLeaked(doc);
  }, 40_000);

  it("confirmed, it removes the guest's record and every key the device kept under its identity, and nothing of the account's or the device's", async () => {
    const doc = await seedGuest();
    const account = await seedAccount();
    const pk = doc.identity.pubkey;
    const d = doc.blobbiD!;
    // What the device kept about the guest Blobbi while it played
    window.localStorage.setItem(roomStorageKey(pk, d), '"kitchen"');
    window.localStorage.setItem(journeyStoreKey(pk), '{"v":1}');
    window.localStorage.setItem(roomNavKey(pk, d), '{"room":"kitchen"}');
    window.localStorage.setItem(getSelectedBlobbiKey(pk), d);
    // What is not the guest's
    window.localStorage.setItem(roomStorageKey(account.pubkey, account.d), '"bedroom"');
    window.localStorage.setItem(journeyStoreKey(account.pubkey), '{"v":1,"account":true}');
    window.localStorage.setItem('blobbi:room:appearance', '2d');
    window.localStorage.setItem(ROOM_INTRO_STORAGE_KEY, 'seen');
    renderApp('/');
    const conflict = await screen.findByTestId('guest-conflict', {}, { timeout: 8000 });
    await userEvent.click(within(conflict).getByTestId('guest-conflict-remove'));
    const remove = await screen.findByTestId('guest-remove');
    await userEvent.click(within(remove).getByTestId('guest-remove-ack'));
    await userEvent.click(within(remove).getByTestId('guest-remove-confirm'));
    await waitFor(() => expect(guestDoc()).toBeNull());
    await waitFor(() => expect(screen.queryByTestId('guest-remove')).toBeNull());
    expect(screen.queryByTestId('guest-conflict')).toBeNull();
    for (const key of [roomStorageKey(pk, d), journeyStoreKey(pk), roomNavKey(pk, d), getSelectedBlobbiKey(pk)]) expect(window.localStorage.getItem(key)).toBeNull();
    expect(window.localStorage.getItem(roomStorageKey(account.pubkey, account.d))).toBe('"bedroom"');
    // (the account's Journey rewrites its own record as it mounts; what matters is that it is still there)
    expect(window.localStorage.getItem(journeyStoreKey(account.pubkey))).not.toBeNull();
    expect(window.localStorage.getItem('blobbi:room:appearance')).toBe('2d');
    expect(window.localStorage.getItem(ROOM_INTRO_STORAGE_KEY)).toBe('seen');
    expect(logins().map((l) => l.pubkey)).toEqual([account.pubkey]);
    for (const key of Object.keys(window.localStorage)) {
      expect(key).not.toContain(pk);
      expect(window.localStorage.getItem(key)).not.toContain(doc.identity.nsec);
    }
    // The account's home is what it was: its own Blobbi, nothing published on anyone's behalf
    expect(relay.published).toEqual([]);
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    nothingLeaked(doc);
  }, 40_000);

  it("a guest Blobbi whose save was read back is removed without the warning, but still only once its key is said to be kept: only this device's copy goes", async () => {
    let doc = await seedGuest();
    doc = withLanded(withMigrationStage(doc, 'done'), 'blobbi', 'f'.repeat(64));
    writeGuestDocument(doc, window.localStorage);
    await seedAccount();
    renderApp('/');
    const conflict = await screen.findByTestId('guest-conflict', {}, { timeout: 8000 });
    await userEvent.click(within(conflict).getByTestId('guest-conflict-remove'));
    const remove = await screen.findByTestId('guest-remove');
    expect(within(remove).getByTestId('guest-remove-saved')).toHaveTextContent(/Pip was saved to an account.*the key you kept/);
    expect(within(remove).queryByTestId('guest-remove-warning')).toBeNull();
    expect(within(remove).getByTestId('guest-remove-confirm')).toBeDisabled();
    await userEvent.click(within(remove).getByTestId('guest-remove-ack'));
    await userEvent.click(within(remove).getByTestId('guest-remove-confirm'));
    await waitFor(() => expect(guestDoc()).toBeNull());
  }, 30_000);

  it('a save that landed but never finished (published, not read back) is not "saved": it warns and needs the acknowledgement, since the key here may be the only one', async () => {
    let doc = await seedGuest();
    doc = withLanded(withMigrationStage(doc, 'verifying'), 'blobbi', 'f'.repeat(64));
    writeGuestDocument(doc, window.localStorage);
    await seedAccount();
    renderApp('/');
    const conflict = await screen.findByTestId('guest-conflict', {}, { timeout: 8000 });
    await userEvent.click(within(conflict).getByTestId('guest-conflict-remove'));
    const remove = await screen.findByTestId('guest-remove');
    expect(within(remove).getByTestId('guest-remove-unfinished')).toHaveTextContent(/Pip’s save did not finish/);
    expect(within(remove).queryByTestId('guest-remove-saved')).toBeNull();
    expect(within(remove).getByTestId('guest-remove-confirm')).toBeDisabled();
    await userEvent.click(within(remove).getByTestId('guest-remove-cancel'));
    expect(await screen.findByTestId('guest-conflict')).toBeInTheDocument();
    expect(guestDoc()?.identity.nsec).toBe(doc.identity.nsec);
  }, 30_000);
});

describe('M15: the invitation to save', () => {
  it('comes in the room too, after real care and five active minutes, in a quiet moment; Don’t ask again turns it off for good; the menu keeps Save', async () => {
    const doc = await seedGuest();
    window.localStorage.setItem(EXPERIENCE_STORAGE_KEY, 'room');
    window.localStorage.setItem(ROOM_INTRO_STORAGE_KEY, 'seen');
    const first = renderApp('/room');
    await screen.findByTestId('room-shell', {}, { timeout: 10_000 });
    const invite = await screen.findByTestId('guest-invite', {}, { timeout: INVITE_DELAY_MS + 8_000 });
    expect(invite).toHaveTextContent(/Pip loves being with you/);
    expect(within(invite).getByTestId('guest-invite-never')).toHaveTextContent(/Don’t ask again/);
    // A sheet over the room: the bubble steps aside, and is back when the sheet closes
    await userEvent.click(await screen.findByTestId('room-menu'));
    await screen.findByTestId('menu-sheet');
    expect(screen.queryByTestId('guest-invite')).toBeNull();
    await userEvent.click(screen.getByTestId('menu-sheet-close'));
    await screen.findByTestId('guest-invite');
    await userEvent.click(screen.getByTestId('guest-invite-never'));
    expect(screen.queryByTestId('guest-invite')).toBeNull();
    expect(guestDoc()?.invite.optOut).toBe(true);
    expect(guestDoc()?.identity.pubkey).toBe(doc.identity.pubkey);
    expect(guestDoc()?.identity.nsec).toBe(doc.identity.nsec);
    first.unmount();

    // The next visit: no bubble, but the menu still saves
    renderApp('/room');
    await screen.findByTestId('room-shell', {}, { timeout: 10_000 });
    await wait(INVITE_DELAY_MS + 800);
    expect(screen.queryByTestId('guest-invite')).toBeNull();
    await userEvent.click(await screen.findByTestId('room-menu'));
    expect(await screen.findByTestId('menu-save-blobbi')).toHaveTextContent('Save Pip');
    expect(relay.published).toEqual([]);
    nothingLeaked(doc);
  }, 60_000);

  it('does not come before five active minutes, even after care, in the 2D home', async () => {
    await seedGuest({ cared: 3, activeMs: INVITE_ACTIVE_MS - 60_000 });
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    await wait(INVITE_DELAY_MS + 1_000);
    expect(screen.queryByTestId('guest-invite')).toBeNull();
    // Time played on this visit is being written to the record
    expect(guestDoc()?.invite.activeMs).toBeGreaterThanOrEqual(INVITE_ACTIVE_MS - 60_000);
  }, 30_000);
});

describe('M15: no zoom of its own on iPhone Safari', () => {
  const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
  const html = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  const rule = (selector: string) => {
    const at = css.indexOf(selector);
    expect(at, selector).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf('}', at));
  };

  it('every text field is at least 16px: the shared field, the egg name, the graphics select, and the net under them all', () => {
    expect(rule('.onboard-input {')).toMatch(/font-size: 1rem/);
    expect(rule('.room-settings-select {')).toMatch(/font-size: 1rem/);
    expect(rule("input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='file']),")).toMatch(/font-size: 1rem/);
    const adoption = readFileSync(path.resolve(process.cwd(), 'src/features/adoption/AdoptionFlow.tsx'), 'utf8');
    expect(adoption).toMatch(/id="egg-name"[\s\S]{0,600}text-base/);
    expect(adoption).not.toMatch(/id="egg-name"[\s\S]{0,600}text-sm placeholder/);
  });

  it('the 2D shell and the hatch egg refuse the double-tap zoom, as the room does; pinch is never disabled', () => {
    expect(rule('.game-shell {')).toMatch(/touch-action: manipulation/);
    expect(rule('.hatch-theater__tap {')).toMatch(/touch-action: manipulation/);
    expect(rule('.room-shell {')).toMatch(/touch-action: manipulation/);
    expect(css).not.toMatch(/touch-action:\s*none/);
  });

  it('the viewport is device-width at scale 1 with the safe areas the stylesheet pads for, and never user-scalable=no', () => {
    const viewport = html.match(/<meta name="viewport" content="([^"]*)"/)?.[1] ?? '';
    expect(viewport).toContain('width=device-width');
    expect(viewport).toContain('initial-scale=1');
    expect(viewport).toContain('viewport-fit=cover');
    expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)/);
    expect(viewport).not.toMatch(/maximum-scale/);
  });
});
