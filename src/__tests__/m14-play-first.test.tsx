/**
 * M14: play first, save later. End to end through the real router, the real
 * login store, the guest store over this origin's storage, the guest
 * transport and the real signing path (a relay that records, underneath).
 *
 * A newcomer meets their Blobbi with no account: the egg at once, the
 * theatre, four taps, the baby, care, all on the device, with no login
 * stored, nothing signed and nothing offered to a relay. A refresh brings
 * the same Blobbi back. After real care, one invitation; Maybe later rests
 * it. Saving: the reserved key (the facts, the backup, the acknowledgement),
 * a profile that may be skipped, then the Blobbi and the profile published
 * under that very key, the same `d` and the same look; the guest record let
 * go only once the relays hold both; a refusal leaves everything in place
 * for Try again; a refresh in the middle resumes. Signing into another
 * account keeps the guest Blobbi apart and says so once. A browser that
 * remembers nothing still plays, and says so.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_INTERACTION, KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, deriveBlobbiV3Seed, getTagValue, updateBlobbiTags } from '@blobbi-kit/core';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

import AppRouter from '@/AppRouter';
import { SceneSettingsProvider } from '@/features/home/scene';
import { GuestProvider, GuestTransport, createGuestStore, GUEST_STORAGE_KEY, readGuestDocument, NO_STORAGE_LINE, DEVICE_ONLY_LINE } from '@/features/guest';
import { createGuestDocument, writeGuestDocument, type StoredGuestDocument } from '@/features/guest/guest-store';
import { localRecordSigner } from '@/features/guest/guest-signer';
import { applyGuestEvent } from '@/features/guest/guest-world';
import { withEvents, withMigrationStage } from '@/features/guest/guest-context';
import { INVITE_DELAY_MS } from '@/features/guest/guest-session';
import { eggTemplate, newEggPreview, profileTemplate } from '@/features/adoption/adoption-plan';
import { finalizeTemplate } from '@/features/care/usePublishAdapter';
import { TAPS_TO_HATCH, TAP_SETTLE_MS } from '@/features/room/lib/hatch-theater';
import { chooseCare } from '@/test/care-ui';

const LOGIN_KEY = 'nostr:login';

/* ─── The relays underneath: everything offered to them is recorded ─────── */
const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[], refuse: new Set<number>(), queried: [] as NostrFilter[] };
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
  relay.queried.push(...filters);
  const seen = new Set<string>();
  return relay.all.filter((e) => filters.some((f) => matches(e, f)) && !seen.has(e.id) && seen.add(e.id));
});
const event = vi.fn(async (ev: NostrEvent) => {
  if (relay.refuse.has(ev.kind)) throw new AggregateError([new Error('blocked: no')], `relay refused kind ${ev.kind}`);
  relay.published.push(ev);
  if (ev.kind === 0) relay.all = [...relay.all.filter((e) => !(e.kind === 0 && e.pubkey === ev.pubkey))];
  else if (ev.kind === KIND_BLOBBI_STATE || ev.kind === KIND_BLOBBONAUT_PROFILE) relay.all = relay.all.filter((e) => !(e.kind === ev.kind && e.pubkey === ev.pubkey && getTagValue(e.tags, 'd') === getTagValue(ev.tags, 'd')));
  relay.all.push(ev);
});
async function* nothing() {}
const upstream = { query, event, req: () => nothing(), group: () => upstream } as unknown as NPool;

function renderApp(path = '/', storage: Storage | null = window.localStorage) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = createGuestStore(storage);
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
const published = (kind: number) => relay.published.filter((e) => e.kind === kind);
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));
const homeStage = () => screen.getByTestId('blobbi-actor').querySelector('[data-blobbi-renderer]')?.getAttribute('data-blobbi-stage');
async function tapTheShell(times: number = TAPS_TO_HATCH) {
  for (let i = 0; i < times; i++) {
    await userEvent.click(screen.getByTestId('hatch-theater-egg'));
    await wait(TAP_SETTLE_MS + 30);
  }
}
const consoleSpies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error'), vi.spyOn(console, 'info'), vi.spyOn(console, 'debug')];

/** A guest who already adopted (and, hatched, cared once): the record as the app would have written it. */
async function seedGuest({ hatched = true, cared = 1, name = 'Pip' }: { hatched?: boolean; cared?: number; name?: string } = {}): Promise<StoredGuestDocument> {
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
    const receipt = await signer.signEvent({ kind: KIND_BLOBBI_INTERACTION, tags: [['a', `${KIND_BLOBBI_STATE}:${identity.pubkey}:${preview.d}`]], content: '', created_at: Number(now) + i });
    doc = withEvents(doc, applyGuestEvent(doc.events, receipt), receipt);
  }
  writeGuestDocument(doc, window.localStorage);
  return doc;
}

async function saveThroughTheKey(name: string) {
  await screen.findByTestId('save-intro');
  await userEvent.click(screen.getByTestId('save-go'));
  const nsecShown = (await screen.findByTestId('nsec-box')).textContent ?? '';
  expect(screen.getByTestId('save-key-intro')).toHaveTextContent(/born from this key/);
  expect(screen.getByTestId('key-warning')).toHaveTextContent(/secret key/);
  expect(screen.queryByTestId('key-confirm')).toBeNull();
  await userEvent.click(screen.getByTestId('nsec-copy'));
  await userEvent.click(screen.getByTestId('key-saved'));
  expect(screen.getByTestId('onboarding-continue')).toHaveTextContent(`Save ${name}!`);
  await userEvent.click(screen.getByTestId('onboarding-continue'));
  return nsecShown;
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
beforeEach(() => {
  relay.all = [];
  relay.published = [];
  relay.refuse = new Set();
  relay.queried = [];
  window.localStorage.clear();
  query.mockClear();
  event.mockClear();
  for (const spy of consoleSpies) spy.mockClear();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
  Object.assign(URL, { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} });
  HTMLAnchorElement.prototype.click = () => {};
});
afterEach(() => {
  cleanup();
});

describe('M14: play first', () => {
  it('a newcomer meets their Blobbi with no account: the egg at once, four taps, the baby, nothing stored but the guest record, nothing offered to a relay; a refresh brings it back', async () => {
    const first = renderApp('/');
    await screen.findByTestId('onboarding-welcome');
    expect(screen.getByTestId('onboarding-create')).toHaveTextContent('Meet your Blobbi!');
    await userEvent.click(screen.getByTestId('onboarding-create'));
    // No key screen: the egg, kept on this device
    expect(await screen.findByTestId('adoption-egg')).toHaveAttribute('data-ready', 'true');
    expect(screen.queryByTestId('onboarding-create-account')).toBeNull();
    expect(screen.getByTestId('adoption-footnote')).toHaveTextContent(/stays on this device/);
    const doc = guestDoc();
    expect(doc).not.toBeNull();
    expect(doc!.identity.pubkey).toMatch(/^[0-9a-f]{64}$/);
    const d = screen.getByTestId('adoption-preview').getAttribute('data-d')!;
    expect(d).toBe(`blobbi-${doc!.identity.pubkey.slice(0, 12)}-${d.slice(-10)}`);
    await userEvent.type(screen.getByTestId('adoption-name'), 'Pip');
    await userEvent.click(screen.getByTestId('adoption-adopt'));
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    expect(homeStage()).toBe('egg');
    // The record holds the egg and the profile; the login store nothing; the relays were never offered anything
    await waitFor(() => expect(guestDoc()?.blobbiD).toBe(d));
    expect(guestDoc()!.events.map((e) => e.kind).sort()).toEqual([KIND_BLOBBONAUT_PROFILE, KIND_BLOBBI_STATE].sort());
    expect(guestDoc()!.events.every((e) => e.sig === '')).toBe(true);
    expect(logins()).toEqual([]);
    expect(relay.published).toEqual([]);
    // The theatre opens by itself; four taps hatch it, on this device
    const theater = await screen.findByTestId('hatch-theater', {}, { timeout: 8000 });
    expect(theater).toHaveAttribute('data-beat', 'stirring');
    await tapTheShell();
    // A local write lands in a blink: the note under the light is the device's (seen when it is there at all)
    const note = screen.queryByTestId('hatch-theater-writing');
    if (note) expect(note).toHaveTextContent(/on this device/);
    await waitFor(() => expect(screen.queryByTestId('hatch-theater')).toBeNull(), { timeout: 8000 });
    expect(homeStage()).toBe('baby');
    const hatchedRecord = guestDoc()!.events.find((e) => e.kind === KIND_BLOBBI_STATE)!;
    expect(getTagValue(hatchedRecord.tags, 'stage')).toBe('baby');
    expect(getTagValue(hatchedRecord.tags, 'd')).toBe(d);
    expect(relay.published).toEqual([]);
    // The guest's own pubkey was never asked of a relay
    expect(relay.queried.some((f) => f.authors?.includes(doc!.identity.pubkey))).toBe(false);
    // The secret never left the record
    const nsec = doc!.identity.nsec;
    for (const spy of consoleSpies) for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(nsec.slice(5));
    expect(JSON.stringify(relay)).not.toContain(nsec.slice(5));

    // A refresh: the same Blobbi, the same stage, no welcome
    first.unmount();
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    expect(homeStage()).toBe('baby');
    expect(screen.queryByTestId('onboarding-welcome')).toBeNull();
    expect(screen.queryByTestId('hatch-theater')).toBeNull();
  }, 60_000);

  it('care lands on the device and counts; the invitation comes once the home is quiet; Maybe later rests it; the menu keeps the way', async () => {
    await seedGuest({ hatched: true, cared: 0 });
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    expect(screen.queryByTestId('guest-invite')).toBeNull();
    await chooseCare('feed');
    await waitFor(() => expect(guestDoc()?.care.count).toBe(1), { timeout: 10_000 });
    expect(relay.published).toEqual([]);
    const invite = await screen.findByTestId('guest-invite', {}, { timeout: INVITE_DELAY_MS + 6_000 });
    expect(invite).toHaveTextContent(/Pip loves being with you/);
    await userEvent.click(within(invite).getByTestId('guest-invite-later'));
    expect(screen.queryByTestId('guest-invite')).toBeNull();
    expect(guestDoc()?.invite.dismissedAt).not.toBeNull();
    await wait(INVITE_DELAY_MS + 500);
    expect(screen.queryByTestId('guest-invite')).toBeNull();
    // The menu: where the Blobbi lives, said plainly; the way to save; no sign out, no key
    await userEvent.click(screen.getByTestId('menu-button'));
    const menu = await screen.findByTestId('menu-sheet');
    expect(within(menu).getByTestId('menu-guest-line')).toHaveTextContent(DEVICE_ONLY_LINE);
    expect(within(menu).getByTestId('menu-save-blobbi')).toHaveTextContent('Save my Blobbi');
    expect(within(menu).queryByTestId('sign-out')).toBeNull();
    expect(within(menu).queryByTestId('key-backup-section')).toBeNull();
    expect(within(menu).queryByTestId('enter-island')).toBeNull();
  }, 60_000);

  it('saving: the reserved key, a skipped profile, the Blobbi and the profile published under that key with the same d and look; the record let go; the same Blobbi at home', async () => {
    const doc = await seedGuest({ hatched: true, cared: 1 });
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    const invite = await screen.findByTestId('guest-invite', {}, { timeout: INVITE_DELAY_MS + 6_000 });
    await userEvent.click(within(invite).getByTestId('guest-invite-save'));
    const shown = await saveThroughTheKey('Pip');
    expect(shown).toBe(doc.identity.nsec);
    // Signed in with the reserved key; the stage remembered before the sign-in
    await waitFor(() => expect(logins().map((l) => l.pubkey)).toEqual([doc.identity.pubkey]));
    expect(guestDoc()?.migration?.stage).toBe('profile');
    expect(await screen.findByTestId('save-profile')).toBeInTheDocument();
    expect(screen.queryByTestId('adoption-egg')).toBeNull();
    await userEvent.click(screen.getByTestId('save-profile-skip'));
    await screen.findByTestId('save-connect');
    await screen.findByTestId('save-done', {}, { timeout: 10_000 });
    // Published: the very same address, signed for real, in Island's order
    expect(relay.published.map((e) => e.kind)).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE]);
    const [blobbi, profile] = relay.published;
    expect(blobbi.pubkey).toBe(doc.identity.pubkey);
    expect(blobbi.sig).toMatch(/^[0-9a-f]{128}$/);
    expect(getTagValue(blobbi.tags, 'd')).toBe(doc.blobbiD);
    expect(getTagValue(blobbi.tags, 'name')).toBe('Pip');
    expect(getTagValue(blobbi.tags, 'stage')).toBe('baby');
    expect(deriveBlobbiV3Seed(blobbi.pubkey, getTagValue(blobbi.tags, 'd')!)).toBe(deriveBlobbiV3Seed(doc.identity.pubkey, doc.blobbiD!));
    expect(getTagValue(profile.tags, 'current_companion')).toBe(doc.blobbiD);
    expect(screen.getByTestId('save-step-blobbi')).toHaveAttribute('data-state', 'landed');
    expect(screen.getByTestId('save-step-profile')).toHaveAttribute('data-state', 'landed');
    expect(screen.getByTestId('save-portrait')).toHaveAttribute('data-progress', '2');
    // Confirmed on the relays: the record says so and stays for the celebration; it goes as the player leaves the scene
    await waitFor(() => expect(guestDoc()?.migration?.stage).toBe('done'));
    await userEvent.click(screen.getByTestId('save-done'));
    await waitFor(() => expect(screen.queryByTestId('save-connect')).toBeNull());
    expect(guestDoc()).toBeNull();
    expect(window.localStorage.getItem(GUEST_STORAGE_KEY)).toBeNull();
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    expect(homeStage()).toBe('baby');
    expect(screen.getByTestId('blobbi-chip')).toHaveAccessibleName(/^Pip:/);
    // A signed-in player now: the menu has the account, not the guest block
    await userEvent.click(screen.getByTestId('menu-button'));
    const menu = await screen.findByTestId('menu-sheet');
    expect(within(menu).queryByTestId('menu-guest')).toBeNull();
    await userEvent.click(within(menu).getByTestId('menu-account'));
    const account = await screen.findByTestId('account-sheet');
    expect(within(account).getByTestId('sign-out')).toBeInTheDocument();
    expect(within(account).getByTestId('login-type')).toHaveTextContent(/secret key/);
    // The secret never went to a relay or the console
    for (const spy of consoleSpies) for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(doc.identity.nsec.slice(5));
    expect(JSON.stringify(relay.published)).not.toContain(doc.identity.nsec.slice(5));
  }, 60_000);

  it('a refusal mid-save leaves the record in place and offers Try again; the second run publishes only what is missing', async () => {
    const doc = await seedGuest({ hatched: true, cared: 1 });
    relay.refuse.add(KIND_BLOBBONAUT_PROFILE);
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    await userEvent.click(screen.getByTestId('menu-button'));
    await userEvent.click(await screen.findByTestId('menu-save-blobbi'));
    await saveThroughTheKey('Pip');
    await userEvent.click(await screen.findByTestId('save-profile-skip'));
    const failed = await screen.findByTestId('save-failed', {}, { timeout: 10_000 });
    expect(failed).toHaveTextContent(/profile did not reach the relays/);
    expect(failed).toHaveTextContent(/still safe on this device/);
    expect(published(KIND_BLOBBI_STATE)).toHaveLength(1);
    expect(guestDoc()).not.toBeNull();
    expect(guestDoc()?.migration?.landed.blobbi).toBe(published(KIND_BLOBBI_STATE)[0].id);
    relay.refuse.clear();
    await userEvent.click(screen.getByTestId('save-retry'));
    await screen.findByTestId('save-done', {}, { timeout: 10_000 });
    expect(published(KIND_BLOBBI_STATE)).toHaveLength(1);
    expect(published(KIND_BLOBBONAUT_PROFILE)).toHaveLength(1);
    expect(screen.getByTestId('save-step-blobbi')).toHaveAttribute('data-state', 'found');
    await waitFor(() => expect(guestDoc()?.migration?.stage).toBe('done'));
    await userEvent.click(screen.getByTestId('save-done'));
    await waitFor(() => expect(guestDoc()).toBeNull());
    expect(getTagValue(published(KIND_BLOBBI_STATE)[0].tags, 'd')).toBe(doc.blobbiD);
  }, 60_000);

  it('a refresh after the key resumes the save at the profile; no egg is offered to the new account meanwhile', async () => {
    const doc = await seedGuest({ hatched: true, cared: 1 });
    const first = renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    await userEvent.click(screen.getByTestId('menu-button'));
    await userEvent.click(await screen.findByTestId('menu-save-blobbi'));
    await saveThroughTheKey('Pip');
    await screen.findByTestId('save-profile');
    first.unmount();
    renderApp('/');
    expect(await screen.findByTestId('save-profile', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByTestId('adoption-egg')).toBeNull();
    expect(screen.queryByTestId('onboarding-welcome')).toBeNull();
    await userEvent.click(screen.getByTestId('save-profile-skip'));
    await screen.findByTestId('save-done', {}, { timeout: 10_000 });
    expect(published(KIND_BLOBBI_STATE)).toHaveLength(1);
    expect(getTagValue(published(KIND_BLOBBI_STATE)[0].tags, 'd')).toBe(doc.blobbiD);
  }, 60_000);

  it('a save that landed but could not be read back keeps the record, and the next home visit confirms it', async () => {
    const doc = await seedGuest({ hatched: true, cared: 1 });
    writeGuestDocument(withMigrationStage(doc, 'verifying'), window.localStorage);
    // Signed in with the reserved key, the events on the relays (the save landed)
    const signer = localRecordSigner(doc.identity.pubkey);
    const held = await signer.signEvent(finalizeTemplate({ kind: KIND_BLOBBI_STATE, tags: doc.events.find((e) => e.kind === KIND_BLOBBI_STATE)!.tags, content: '' }));
    relay.all = [{ ...held, sig: 'f'.repeat(128) }, { ...(await signer.signEvent(finalizeTemplate({ kind: KIND_BLOBBONAUT_PROFILE, tags: doc.events.find((e) => e.kind === KIND_BLOBBONAUT_PROFILE)!.tags, content: '' }))), sig: 'f'.repeat(128) }];
    window.localStorage.setItem(LOGIN_KEY, JSON.stringify([{ id: 'nsec1', type: 'nsec', pubkey: doc.identity.pubkey, createdAt: new Date().toISOString(), data: { nsec: doc.identity.nsec } }]));
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    await waitFor(() => expect(guestDoc()).toBeNull());
    expect(relay.published).toEqual([]);
  }, 30_000);

  it('signing into an account one already has keeps the guest Blobbi apart: said once, never merged; removing it is explicit and confirmed', async () => {
    const doc = await seedGuest({ hatched: true, cared: 1 });
    const other = generateSecretKey();
    const otherPubkey = getPublicKey(other);
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    await userEvent.click(screen.getByTestId('menu-button'));
    await userEvent.click(await screen.findByTestId('menu-sign-in'));
    const sheet = await screen.findByTestId('guest-sign-in');
    await userEvent.click(within(sheet).getByText('Sign in with a secret key'));
    await userEvent.type(within(sheet).getByTestId('login-nsec-input'), nip19.nsecEncode(other));
    await userEvent.click(within(sheet).getByTestId('login-nsec'));
    await waitFor(() => expect(logins().map((l) => l.pubkey)).toEqual([otherPubkey]));
    // The account's own home (it has nothing: its egg is offered), the guest record untouched, the conflict said
    const conflict = await screen.findByTestId('guest-conflict', {}, { timeout: 8000 });
    expect(conflict).toHaveTextContent(/Pip was raised here as a guest/);
    expect(conflict).toHaveTextContent(/cannot be moved into this account/);
    expect(guestDoc()?.identity.pubkey).toBe(doc.identity.pubkey);
    expect(relay.published).toEqual([]);
    await userEvent.click(within(conflict).getByTestId('guest-conflict-keep'));
    await waitFor(() => expect(screen.queryByTestId('guest-conflict')).toBeNull());
    expect(guestDoc()?.conflicts).toEqual([otherPubkey]);
    expect(await screen.findByTestId('adoption-egg', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByTestId('adoption-footnote')).toHaveTextContent(/saves the egg to your account/);
    // Signing out brings the guest back
    await userEvent.click(screen.getByTestId('menu-button'));
    await userEvent.click(await screen.findByTestId('menu-account'));
    await userEvent.click(await screen.findByTestId('sign-out'));
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    expect(homeStage()).toBe('baby');
    expect(guestDoc()).not.toBeNull();
  }, 60_000);

  it('removing the guest Blobbi for another account is asked twice', async () => {
    await seedGuest({ hatched: true, cared: 1 });
    const other = generateSecretKey();
    window.localStorage.setItem(LOGIN_KEY, JSON.stringify([{ id: 'other', type: 'nsec', pubkey: getPublicKey(other), createdAt: new Date().toISOString(), data: { nsec: nip19.nsecEncode(other) } }]));
    renderApp('/');
    const conflict = await screen.findByTestId('guest-conflict', {}, { timeout: 8000 });
    await userEvent.click(within(conflict).getByTestId('guest-conflict-remove'));
    expect(guestDoc()).not.toBeNull();
    await userEvent.click(within(conflict).getByTestId('guest-conflict-cancel'));
    expect(guestDoc()).not.toBeNull();
    await userEvent.click(within(conflict).getByTestId('guest-conflict-remove'));
    await userEvent.click(within(conflict).getByTestId('guest-conflict-remove-confirm'));
    await waitFor(() => expect(guestDoc()).toBeNull());
  }, 30_000);

  it('a browser that remembers nothing still plays, in memory, and says so', async () => {
    renderApp('/', null);
    await screen.findByTestId('onboarding-welcome');
    await userEvent.click(screen.getByTestId('onboarding-create'));
    expect(await screen.findByTestId('adoption-egg')).toHaveAttribute('data-ready', 'true');
    expect(window.localStorage.getItem(GUEST_STORAGE_KEY)).toBeNull();
    await userEvent.click(screen.getByTestId('adoption-adopt'));
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    await userEvent.click(screen.getByTestId('menu-button'));
    expect(within(await screen.findByTestId('menu-sheet')).getByTestId('menu-guest-line')).toHaveTextContent(NO_STORAGE_LINE);
    expect(relay.published).toEqual([]);
  }, 30_000);

  it('a guest\'s Blobbi grows up here: evolution is offered on this device, and the details say saving keeps every step', async () => {
    await seedGuest({ hatched: true, cared: 0 });
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    await userEvent.click(screen.getByTestId('blobbi-chip'));
    const sheet = await screen.findByTestId('blobbi-sheet');
    expect(within(sheet).getByTestId('lifecycle-guest-note')).toHaveTextContent(/saving Pip/i);
    // Since M14.1 a guest's Blobbi grows up here too: evolution is offered, on this device
    expect(within(sheet).getByTestId('lifecycle-start-evolution')).toBeEnabled();
  }, 30_000);
});
