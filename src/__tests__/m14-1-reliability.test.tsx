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
import { serializeEvolutionContent } from '@blobbi-kit/core/missions';
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
import { GUEST_STATUS_LINE, SAVED_STATUS_LINE } from '@/features/guest/GuestStatus';
import { createEvolveMissions } from '@blobbi-kit/react';
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
  // M15: one blocking layer at a time. The room's first-visit introduction is a sheet; the sheets these tests open
  // would wait behind it (as a player's taps cannot reach the dock under its backdrop), so the introduction counts as seen.
  window.localStorage.setItem('blobbi:home:3d-intro:v1', 'seen');
  query.mockClear();
  event.mockClear();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
  Object.assign(URL, { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} });
  HTMLAnchorElement.prototype.click = () => {};
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

describe('M14.1: the top, the dock, the menus', () => {
  it('the name stands in the middle of the top, display only; the Blobbi button is the dock\'s; the top has no second door to the details', async () => {
    await seedGuest();
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    const name = screen.getByTestId('hud-name');
    expect(name.tagName).toBe('P');
    expect(name).toHaveTextContent('Pip');
    expect(name.querySelector('button')).toBeNull();
    expect(within(screen.getByTestId('hud-top')).queryByRole('button', { name: /open details/i })).toBeNull();
    // The dock's Blobbi button (bottom left) is the door, with the name, the mood and the needs
    const chip = screen.getByTestId('blobbi-chip');
    expect(chip.tagName).toBe('BUTTON');
    expect(screen.getByTestId('action-bar')).toContainElement(chip);
    expect(within(chip).getByTestId('condition-dots')).toBeInTheDocument();
    await userEvent.click(chip);
    const sheet = await screen.findByTestId('blobbi-sheet');
    expect(within(sheet).getByTestId('stage-track')).toHaveAttribute('data-stage', 'baby');
    // The Journey is the Blobbi's (its sheet); the worlds are the globe at the top left, locked for a guest, not the menu's
    await userEvent.click(within(sheet).getByTestId('sheet-journey'));
    expect(await screen.findByTestId('journey-sheet')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByTestId('menu-button'));
    const menu = await screen.findByTestId('menu-sheet');
    expect(within(menu).queryByTestId('enter-island')).toBeNull();
    expect(within(menu).getByTestId('menu-about')).toBeInTheDocument();
    expect(within(menu).queryByTestId('menu-worlds')).toBeNull();
    await userEvent.keyboard('{Escape}');
    const globe = within(screen.getByTestId('hud-top')).getByTestId('worlds-button');
    expect(globe).toHaveAttribute('data-locked', 'true');
    await userEvent.click(globe);
    expect(screen.queryByTestId('worlds-sheet')).toBeNull();
    expect(screen.getByTestId('worlds-locked-word')).toHaveTextContent('Worlds open once Pip is saved to an account.');
  }, 30_000);

  it('in the room the name is centred and display only too; worlds and journey are reached the same way; no top buttons for them', async () => {
    await seedGuest();
    window.localStorage.setItem(EXPERIENCE_STORAGE_KEY, 'room');
    renderApp('/room');
    await screen.findByTestId('room-shell', {}, { timeout: 8000 });
    const name = screen.getByTestId('room-header-name');
    expect(name.tagName).toBe('P');
    expect(name).toHaveTextContent('Pip');
    expect(screen.queryByTestId('room-worlds')).toBeNull();
    expect(screen.queryByTestId('room-journey')).toBeNull();
    // The worlds' globe stands at the left of the room's header too, locked for a guest
    expect(within(screen.getByTestId('room-header')).getByTestId('worlds-button')).toHaveAttribute('data-locked', 'true');
    await userEvent.click(screen.getByTestId('room-bar-blobbi'));
    const sheet = await screen.findByTestId('room-blobbi-sheet');
    expect(within(sheet).getByTestId('stage-track')).toBeInTheDocument();
    await userEvent.click(within(sheet).getByTestId('sheet-journey'));
    expect(await screen.findByTestId('journey-sheet')).toBeInTheDocument();
  }, 30_000);
});

describe('M14.1: the guest\'s status', () => {
  it('a guest sees "On this device" by the name; tapping it explains, offers Save my Blobbi and Maybe later, and never interrupts by itself', async () => {
    await seedGuest();
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    const pill = screen.getByTestId('guest-status');
    expect(pill).toHaveTextContent(GUEST_STATUS_LINE);
    expect(screen.queryByTestId('guest-status-sheet')).toBeNull();
    await userEvent.click(pill);
    const sheet = await screen.findByTestId('guest-status-sheet');
    const text = within(sheet).getByTestId('guest-status-text');
    // A child's words (M14.2): where Pip lives, what could happen, what saving gives; no relays, no jargon
    expect(text).toHaveTextContent(/Pip is still exploring this little world/);
    expect(text).toHaveTextContent(/Pip lives only on this device/);
    expect(text).toHaveTextContent(/Pip could disappear too/);
    expect(text).toHaveTextContent(/visit from other devices and explore new worlds together/);
    expect(text).not.toHaveTextContent(/relay/i);
    expect(text).not.toHaveTextContent(/Nostr/);
    expect(text.textContent).not.toContain(';');
    // The storage warning stays reachable, under Good to know
    expect(text).toHaveTextContent(/can erase Pip/);
    expect(text).toHaveTextContent(/keep playing here without saving/);
    expect(within(sheet).getByTestId('guest-status-save')).toHaveTextContent('Save Pip');
    await userEvent.click(within(sheet).getByTestId('guest-status-later'));
    expect(screen.queryByTestId('guest-status-sheet')).toBeNull();
    await userEvent.click(screen.getByTestId('guest-status'));
    await userEvent.click(within(await screen.findByTestId('guest-status-sheet')).getByTestId('guest-status-save'));
    const intro = await screen.findByTestId('save-intro');
    expect(intro).toHaveTextContent(/Ready to explore beyond this little world/);
    expect(within(intro).getByTestId('save-intro-benefit')).toHaveTextContent(/home you can return to from other devices/);
    expect(intro).not.toHaveTextContent(/relay/i);
    await userEvent.click(screen.getByTestId('save-later'));
    expect(screen.getByTestId('guest-status')).toBeInTheDocument();
    expect(screen.queryByTestId('saved-status')).toBeNull();
    expect(relay.published).toEqual([]);
  }, 30_000);

  it('after a landed save the status becomes "Saved" for the visit, and the connection dot is a different thing', async () => {
    await seedGuest({ cared: 1 });
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    await userEvent.click(screen.getByTestId('guest-status'));
    await userEvent.click(within(await screen.findByTestId('guest-status-sheet')).getByTestId('guest-status-save'));
    await screen.findByTestId('save-intro');
    await userEvent.click(screen.getByTestId('save-go'));
    await screen.findByTestId('nsec-box');
    await userEvent.click(screen.getByTestId('nsec-copy'));
    await userEvent.click(screen.getByTestId('key-saved'));
    await userEvent.click(screen.getByTestId('onboarding-continue'));
    for (let i = 0; i < 3; i += 1) await userEvent.click(await screen.findByTestId('save-profile-skip'));
    await userEvent.click(await screen.findByTestId('save-done', {}, { timeout: 15000 }));
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    expect(screen.queryByTestId('guest-status')).toBeNull();
    expect(await screen.findByTestId('saved-status')).toHaveTextContent(SAVED_STATUS_LINE);
    expect(screen.queryByTestId('connection-chip')).toBeNull();
    expect(relay.published.filter((e) => e.kind === KIND_BLOBBI_STATE)).toHaveLength(1);
  }, 60_000);
});

describe('M14.1: the lifecycle lives here, and comes back from the relays', () => {
  it('a guest starts evolution on this device, cares, and a reload finds it still evolving with the care counted, nothing published', async () => {
    await seedGuest();
    const first = renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    await userEvent.click(screen.getByTestId('blobbi-chip'));
    const sheet = await screen.findByTestId('blobbi-sheet');
    await userEvent.click(within(sheet).getByTestId('lifecycle-start-evolution'));
    await waitFor(() => expect(within(sheet).getByTestId('lifecycle-panel')).toHaveAttribute('data-next', 'evolve-tasks'), { timeout: 8000 });
    expect(within(sheet).getByTestId('lifecycle-task-interactions')).toHaveAttribute('data-here', 'true');
    expect(within(sheet).getByTestId('lifecycle-task-create_themes')).toHaveAttribute('data-here', 'false');
    await userEvent.keyboard('{Escape}');
    await chooseCare('feed');
    await waitFor(() => expect(guestDoc()!.events.some((e) => e.kind === KIND_BLOBBI_INTERACTION)).toBe(true), { timeout: 8000 });
    first.unmount();
    cleanup();
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    await userEvent.click(screen.getByTestId('blobbi-chip'));
    const again = await screen.findByTestId('blobbi-sheet');
    await waitFor(() => expect(within(again).getByTestId('lifecycle-panel')).toHaveAttribute('data-next', 'evolve-tasks'), { timeout: 8000 });
    await waitFor(() => expect(within(again).getByTestId('lifecycle-task-interactions')).toHaveTextContent('1/21'), { timeout: 8000 });
    expect(relay.published).toEqual([]);
  }, 60_000);

  it('a registered Blobbi evolving on another device is rebuilt here from its canonical record alone: fresh storage, the relays, the care counted, Evolve open once the care is done', async () => {
    const sk = generateSecretKey();
    const pubkey = getPublicKey(sk);
    window.localStorage.setItem(LOGIN_KEY, JSON.stringify([{ id: `nsec:${pubkey}`, type: 'nsec', pubkey, createdAt: new Date().toISOString(), data: { nsec: nip19.nsecEncode(sk) } }]));
    const preview = newEggPreview(pubkey, 'Brook', Math.floor(Date.now() / 1000) - 6000);
    const signer = localRecordSigner(pubkey);
    const missions = createEvolveMissions().map((m) => (m.id === 'interactions' && 'count' in m ? { ...m, count: 21 } : m));
    const egg = eggTemplate(preview);
    const baby = {
      ...egg,
      tags: updateBlobbiTags(egg.tags, { stage: 'baby', state: 'active', progression_state: 'evolving', progression_started_at: String(Math.floor(Date.now() / 1000) - 3000), hunger: '90', happiness: '90', health: '100', hygiene: '90', energy: '90' }),
      content: serializeEvolutionContent(JSON.stringify({}), missions),
    };
    const state = await signer.signEvent(finalizeTemplate({ ...baby, created_at: Math.floor(Date.now() / 1000) - 60 }));
    const profile = await signer.signEvent(finalizeTemplate(profileTemplate({ ownerPubkey: pubkey, profile: null, d: preview.d, suggestedName: 'Blobbonaut' })));
    relay.all = [{ ...state, sig: '0'.repeat(128) }, { ...profile, sig: '0'.repeat(128) }];
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    await userEvent.click(screen.getByTestId('blobbi-chip'));
    const sheet = await screen.findByTestId('blobbi-sheet');
    const panel = within(sheet).getByTestId('lifecycle-panel');
    await waitFor(() => expect(within(sheet).getByTestId('lifecycle-task-interactions')).toHaveAttribute('data-completed', 'true'), { timeout: 8000 });
    expect(within(sheet).getByTestId('lifecycle-task-interactions')).toHaveTextContent('21/21');
    // The adventures elsewhere are shown, optional; the care done here opens the evolution
    expect(within(sheet).getByTestId('lifecycle-task-create_themes')).toHaveAttribute('data-completed', 'false');
    await waitFor(() => expect(panel).toHaveAttribute('data-ready', 'true'), { timeout: 8000 });
    expect(panel).toHaveAttribute('data-next', 'evolve');
    expect(within(sheet).getByTestId('lifecycle-evolve')).toBeEnabled();
    expect(within(sheet).getByTestId('stage-track')).toHaveAttribute('data-stage', 'baby');
    expect(relay.published).toEqual([]);
  }, 40_000);
});
