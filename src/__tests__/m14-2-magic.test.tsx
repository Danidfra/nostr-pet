/**
 * M14.2: the magical account experience, end to end through the real
 * router, the real login store and the guest store over this origin's
 * storage (the M14 harness).
 *
 * The words are a child's and name the Blobbi; the ceremony is one screen at
 * a time, its profile three short steps with Continue, Skip and Back, one
 * kind 0 at the end or none; an unfriendly word is refused gently and the
 * field left to edit; the Blobbi is alive through it (it breathes, watches
 * the field, hops with hearts when a step is passed, celebrates when the
 * account is made) and reduced motion keeps the faces and drops the moves;
 * the room greets a first visit once and says where the look is chosen; the
 * stylesheet keeps the ceremony to the visible viewport.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
import { withEvents } from '@/features/guest/guest-context';
import { eggTemplate, newEggPreview, profileTemplate } from '@/features/adoption/adoption-plan';
import { finalizeTemplate } from '@/features/care/usePublishAdapter';
import { UNFRIENDLY_LINE } from '@/features/onboarding/profile-guard';
import { SURPRISE_MS } from '@/features/guest/ceremony-life';
import { EXPERIENCE_STORAGE_KEY, ROOM_INTRO_STORAGE_KEY } from '@/lib/home-experience';

const LOGIN_KEY = 'nostr:login';

const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[] };
function matches(event: NostrEvent, f: NostrFilter): boolean {
  if (f.kinds && !f.kinds.includes(event.kind)) return false;
  if (f.authors && !f.authors.includes(event.pubkey)) return false;
  return true;
}
const query = vi.fn(async (filters: NostrFilter[]): Promise<NostrEvent[]> => {
  const seen = new Set<string>();
  return relay.all.filter((e) => filters.some((f) => matches(e, f)) && !seen.has(e.id) && seen.add(e.id));
});
const event = vi.fn(async (ev: NostrEvent) => {
  relay.published.push(ev);
  if (ev.kind === 0) relay.all = relay.all.filter((e) => !(e.kind === 0 && e.pubkey === ev.pubkey));
  else relay.all = relay.all.filter((e) => !(e.kind === ev.kind && e.pubkey === ev.pubkey && getTagValue(e.tags, 'd') === getTagValue(ev.tags, 'd')));
  relay.all.push(ev);
});
async function* nothing() {}
const upstream = { query, event, req: () => nothing(), group: () => upstream } as unknown as NPool;

function renderApp(path = '/', { reduced = true }: { reduced?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = createGuestStore(window.localStorage);
  return render(
    <SceneSettingsProvider value={{ reducedMotion: reduced, idleEnabled: false, walkSpeed: 4 }}>
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
const published = (kind: number) => relay.published.filter((e) => e.kind === kind);
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));
const portrait = () => screen.getByTestId('save-portrait');
/** The V3 drawing's live motion (on its rig, `data-blobbi-rig-motion`); null when still. */
const rigMotion = () => portrait().querySelector('[data-blobbi-rig-motion]')?.getAttribute('data-blobbi-rig-motion') ?? null;
const effectsShown = () => [...new Set(Array.from(portrait().querySelectorAll('[data-blobbi-effect]')).map((el) => el.getAttribute('data-blobbi-effect')))];

async function seedGuest({ cared = 1, name = 'Pip' }: { cared?: number; name?: string } = {}): Promise<StoredGuestDocument> {
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
  for (let i = 0; i < cared; i += 1) {
    const receipt = await signer.signEvent({ kind: KIND_BLOBBI_INTERACTION, tags: [['a', `${KIND_BLOBBI_STATE}:${identity.pubkey}:${preview.d}`], ['action', 'feed']], content: '', created_at: Number(now) + i });
    doc = withEvents(doc, applyGuestEvent(doc.events, receipt), receipt);
  }
  writeGuestDocument(doc, window.localStorage);
  return doc;
}

/** From the home to the profile's first step: the menu, the intro, the key given and acknowledged. */
async function throughTheKey() {
  await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
  await userEvent.click(screen.getByTestId('menu-button'));
  await userEvent.click(await screen.findByTestId('menu-save-blobbi'));
  await screen.findByTestId('save-intro');
  await userEvent.click(screen.getByTestId('save-go'));
  await screen.findByTestId('nsec-box');
  await userEvent.click(screen.getByTestId('nsec-copy'));
  await userEvent.click(screen.getByTestId('key-saved'));
  await userEvent.click(screen.getByTestId('onboarding-continue'));
  return await screen.findByTestId('save-profile');
}
const step = () => screen.getByTestId('profile-progress').getAttribute('data-step');

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});
beforeEach(() => {
  relay.all = [];
  relay.published = [];
  window.localStorage.clear();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
  Object.assign(URL, { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} });
  HTMLAnchorElement.prototype.click = () => {};
});
afterEach(() => cleanup());

describe('M14.2: the words', () => {
  it('the guest surfaces speak of the Blobbi by name, in short sentences without semicolons, and never of relays', async () => {
    await seedGuest();
    renderApp('/');
    await screen.findByTestId('blobbi-actor', {}, { timeout: 8000 });
    await userEvent.click(screen.getByTestId('menu-button'));
    const menu = await screen.findByTestId('menu-sheet');
    const guestBlock = within(menu).getByTestId('menu-guest');
    expect(within(menu).getByTestId('menu-guest-line')).toHaveTextContent(/Right now, Pip lives only on this device\. If its data disappears, Pip could disappear too\./);
    expect(within(menu).getByTestId('menu-save-blobbi')).toHaveTextContent('Save Pip');
    expect(within(menu).getByTestId('menu-save-blobbi')).toHaveTextContent(/return to from other devices/);
    expect(guestBlock.textContent).not.toMatch(/relay|Nostr/i);
    expect(guestBlock.textContent).not.toContain(';');
    await userEvent.click(within(menu).getByTestId('menu-worlds'));
    const worlds = await screen.findByTestId('worlds-sheet');
    expect(within(worlds).getByTestId('worlds-note')).toHaveTextContent(/Save Pip and these doors open/);
    expect(within(worlds).getByTestId('worlds-note').textContent).not.toContain(';');
    await userEvent.keyboard('{Escape}');
    // The invitation to save: the little world, other devices, the key said simply; no relays
    await userEvent.click(screen.getByTestId('menu-button'));
    await userEvent.click(await screen.findByTestId('menu-save-blobbi'));
    const intro = await screen.findByTestId('save-intro');
    expect(intro).toHaveTextContent('Ready to explore beyond this little world?');
    expect(within(intro).getByTestId('save-intro-benefit')).toHaveTextContent('Give Pip a home you can return to from other devices. Your adventures can continue wherever you sign in.');
    expect(intro).toHaveTextContent(/little key that opens Pip’s home/);
    expect(intro.textContent).not.toMatch(/relay/i);
    expect(intro.textContent).not.toContain(';');
    expect(within(intro).getByTestId('save-go')).toHaveTextContent('Let’s go');
    expect(within(intro).getByTestId('save-later')).toHaveTextContent('Maybe later');
  }, 30_000);
});

describe('M14.2: the profile, one step at a time', () => {
  it('three steps with Continue, Skip and Back, the dots counting; the name typed is kept across Back; one kind 0 at the end with what was given', async () => {
    const doc = await seedGuest();
    renderApp('/');
    const scene = await throughTheKey();
    expect(step()).toBe('1');
    expect(within(scene).getByTestId('profile-step-name')).toHaveTextContent('What should Pip call you?');
    expect(within(scene).queryByTestId('profile-back')).toBeNull();
    await userEvent.type(within(scene).getByTestId('profile-name'), 'Dana');
    await userEvent.click(within(scene).getByTestId('profile-next'));
    expect(step()).toBe('2');
    expect(within(scene).getByTestId('profile-step-picture')).toHaveTextContent('A picture of you?');
    await userEvent.click(within(scene).getByTestId('profile-back'));
    expect(step()).toBe('1');
    expect(within(scene).getByTestId('profile-name')).toHaveValue('Dana');
    await userEvent.click(within(scene).getByTestId('profile-next'));
    expect(step()).toBe('2');
    await userEvent.click(within(scene).getByTestId('save-profile-skip'));
    expect(step()).toBe('3');
    expect(within(scene).getByTestId('profile-step-about')).toHaveTextContent('A line about you?');
    await userEvent.type(within(scene).getByTestId('profile-about'), 'I like Blobbis');
    expect(within(scene).getByTestId('profile-next')).toHaveTextContent('Finish');
    await userEvent.click(within(scene).getByTestId('profile-next'));
    // One kind 0, with the name and the line, no picture; then the save goes on
    await waitFor(() => expect(published(0)).toHaveLength(1), { timeout: 8000 });
    const content = JSON.parse(published(0)[0].content) as Record<string, string>;
    expect(content.name).toBe('Dana');
    expect(content.display_name).toBe('Dana');
    expect(content.about).toBe('I like Blobbis');
    expect(content.picture).toBeUndefined();
    expect(published(0)[0].pubkey).toBe(doc.identity.pubkey);
    await screen.findByTestId('save-connect');
    expect(guestDoc()?.migration?.profileDone).toBe(true);
    await screen.findByTestId('save-done', {}, { timeout: 15000 });
    expect(screen.getByTestId('save-connect-title')).toHaveTextContent('Pip has a new home!');
    expect(screen.getByTestId('save-done-text')).toHaveTextContent('Your little friend is now connected to a bigger world. You hold the key to that home.');
    expect(screen.getByTestId('save-done-nostr')).toHaveTextContent(/powered by Nostr, an open network where your identity belongs to you/);
    expect(screen.getByTestId('save-done-nostr')).toHaveTextContent(/Keep your key safe/);
    expect(screen.getByTestId('save-done-text').textContent).not.toContain(';');
  }, 60_000);

  it('every step skipped writes no kind 0; a line alone is written without a name; a refresh in the profile resumes there', async () => {
    await seedGuest();
    const first = renderApp('/');
    let scene = await throughTheKey();
    await userEvent.click(within(scene).getByTestId('save-profile-skip'));
    expect(step()).toBe('2');
    // A refresh in the middle: the save resumes at the profile (its first step), nothing lost but the step
    expect(guestDoc()?.migration?.stage).toBe('profile');
    first.unmount();
    cleanup();
    renderApp('/');
    scene = await screen.findByTestId('save-profile', {}, { timeout: 8000 });
    expect(step()).toBe('1');
    await userEvent.click(within(scene).getByTestId('save-profile-skip'));
    await userEvent.click(within(scene).getByTestId('save-profile-skip'));
    await userEvent.type(within(scene).getByTestId('profile-about'), 'Just here for the Blobbis');
    await userEvent.click(within(scene).getByTestId('profile-next'));
    await waitFor(() => expect(published(0)).toHaveLength(1), { timeout: 8000 });
    const content = JSON.parse(published(0)[0].content) as Record<string, string>;
    expect(content.about).toBe('Just here for the Blobbis');
    expect(content.name).toBeUndefined();
    await screen.findByTestId('save-done', {}, { timeout: 15000 });
  }, 60_000);

  it('an unfriendly name is refused gently: one friendly line, the Blobbi briefly displeased, the field left to edit, nothing written; a kinder name goes through', async () => {
    await seedGuest();
    renderApp('/');
    const scene = await throughTheKey();
    const name = within(scene).getByTestId('profile-name');
    await userEvent.type(name, 'sh1t');
    await userEvent.click(within(scene).getByTestId('profile-next'));
    expect(step()).toBe('1');
    expect(within(scene).getByTestId('profile-reason')).toHaveTextContent(UNFRIENDLY_LINE);
    expect(within(scene).getByTestId('profile-reason').textContent).not.toMatch(/sh1t|shit/i);
    expect(name).toHaveValue('sh1t');
    await wait(SURPRISE_MS + 60);
    expect(portrait()).toHaveAttribute('data-face', 'upset');
    expect(published(0)).toEqual([]);
    await userEvent.clear(name);
    await userEvent.type(name, 'Dana');
    await userEvent.click(within(scene).getByTestId('profile-next'));
    expect(step()).toBe('2');
    expect(within(scene).queryByTestId('profile-reason')).toBeNull();
    // The line about you is checked the same way
    await userEvent.click(within(scene).getByTestId('save-profile-skip'));
    await userEvent.type(within(scene).getByTestId('profile-about'), 'you are all b1tches');
    await userEvent.click(within(scene).getByTestId('profile-next'));
    expect(step()).toBe('3');
    expect(within(scene).getByTestId('profile-reason')).toHaveTextContent(UNFRIENDLY_LINE);
    expect(published(0)).toEqual([]);
  }, 60_000);
});

describe('M14.2: the Blobbi is alive through it', () => {
  it('it breathes and watches the field; a step passed is a hop with hearts, a name is a glad face, the account made is the celebration', async () => {
    await seedGuest();
    renderApp('/', { reduced: false });
    const scene = await throughTheKey();
    // Breathing: the renderer's idle on the drawing's rig; nothing moving yet
    expect(rigMotion()).toBe('idle');
    expect(portrait()).not.toHaveAttribute('data-move');
    expect(effectsShown()).toEqual([]);
    // Its eyes on the field the player types in, curious
    const name = within(scene).getByTestId('profile-name');
    await userEvent.click(name);
    await userEvent.type(name, 'Dana');
    // The gaze reaches the drawing as the renderer's eye variables, on its body: down, toward the field below it
    const eyeStyle = () => Array.from(portrait().querySelectorAll<HTMLElement>('[style]')).map((el) => el.getAttribute('style') ?? '').find((v) => v.includes('--blobbi-eye-y')) ?? '';
    expect(eyeStyle()).toMatch(/--blobbi-eye-y: 0\.[1-9]/);
    await waitFor(() => expect(portrait()).toHaveAttribute('data-face', 'curious'));
    // Continue: glad of the name, then the hop and the hearts
    await userEvent.click(within(scene).getByTestId('profile-next'));
    expect(portrait()).toHaveAttribute('data-move', 'hop');
    await waitFor(() => expect(effectsShown()).toContain('love-burst'));
    await waitFor(() => expect(portrait()).toHaveAttribute('data-face', 'excited'));
    await userEvent.click(within(scene).getByTestId('save-profile-skip'));
    await userEvent.click(within(scene).getByTestId('save-profile-skip'));
    await screen.findByTestId('save-done', {}, { timeout: 15000 });
    // The celebration: the cheer, sparkles in the air and a glow around it, an excited face
    expect(portrait()).toHaveAttribute('data-move', 'cheer');
    await waitFor(() => expect(effectsShown()).toEqual(expect.arrayContaining(['golden-sparkles', 'celestial-aura'])));
    await waitFor(() => expect(portrait()).toHaveAttribute('data-face', 'excited'));
    expect(portrait()).toHaveAttribute('data-progress', '2');
  }, 60_000);

  it('reduced motion keeps the faces and the eyes and drops the moves and the sparkles; the breath is still', async () => {
    await seedGuest();
    renderApp('/', { reduced: true });
    const scene = await throughTheKey();
    expect(portrait()).toHaveAttribute('data-reduced', 'true');
    expect(rigMotion()).toBeNull();
    await userEvent.type(within(scene).getByTestId('profile-name'), 'Dana');
    await userEvent.click(within(scene).getByTestId('profile-next'));
    expect(portrait()).not.toHaveAttribute('data-move');
    expect(effectsShown()).toEqual([]);
    await waitFor(() => expect(portrait()).toHaveAttribute('data-face', 'excited'));
    await userEvent.click(within(scene).getByTestId('save-profile-skip'));
    await userEvent.click(within(scene).getByTestId('save-profile-skip'));
    await screen.findByTestId('save-done', {}, { timeout: 15000 });
    expect(portrait()).not.toHaveAttribute('data-move');
    expect(effectsShown()).toEqual([]);
    expect(portrait()).toHaveAttribute('data-face', 'excited');
  }, 60_000);
});

describe('M14.2: the room\'s first visit and the Blobbi\'s look', () => {
  it('the room greets a first visit once, naming the Blobbi and where its look is chosen; "Don\'t show this again" is remembered; Appearance is the Blobbi sheet\'s', async () => {
    await seedGuest();
    window.localStorage.setItem(EXPERIENCE_STORAGE_KEY, 'room');
    const first = renderApp('/room');
    await screen.findByTestId('room-shell', {}, { timeout: 8000 });
    const intro = await screen.findByTestId('mode-intro');
    expect(intro).toHaveTextContent(/experimental/);
    expect(within(intro).getByTestId('mode-intro-appearance')).toHaveTextContent('You can choose how Pip looks here: the classic drawing or the 3D model. Tap Pip in the dock, then Appearance.');
    expect(within(intro).getByTestId('mode-intro-dismiss')).toBeChecked();
    expect(intro.textContent).not.toContain(';');
    await userEvent.click(within(intro).getByTestId('mode-intro-explore'));
    expect(screen.queryByTestId('mode-intro')).toBeNull();
    expect(window.localStorage.getItem(ROOM_INTRO_STORAGE_KEY)).toBe('seen');
    // Where it said: the Blobbi's sheet, under Appearance; the menu's room settings no longer hold it
    await userEvent.click(screen.getByTestId('room-bar-blobbi'));
    const sheet = await screen.findByTestId('room-blobbi-sheet');
    const section = within(sheet).getByTestId('room-appearance-section');
    expect(section).toHaveTextContent(/Appearance/);
    expect(within(section).getByTestId('room-appearance-panel')).toHaveAttribute('data-appearance', '2d');
    expect(within(section).getByTestId('room-appearance-2d')).toHaveTextContent(/classic drawing/);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByTestId('room-menu'));
    const menu = await screen.findByTestId('menu-sheet');
    expect(within(menu).queryByTestId('room-appearance-panel')).toBeNull();
    expect(within(menu).getByTestId('menu-room-settings')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    first.unmount();
    cleanup();
    renderApp('/room');
    await screen.findByTestId('room-shell', {}, { timeout: 8000 });
    await wait(200);
    expect(screen.queryByTestId('mode-intro')).toBeNull();
  }, 40_000);
});

describe('M14.2: the ceremony fits the visible viewport', () => {
  const css = readFileSync(join(__dirname, '..', 'index.css'), 'utf8');

  it('the scene is the visible viewport (dvh), its column fills and centres, the portrait is sized from the viewport\'s height, and the safe areas are padding', () => {
    expect(css).toMatch(/\.savescene \{[^}]*height: 100dvh;/);
    expect(css).toMatch(/\.savescene__body-col \{[^}]*min-height: 100%;[^}]*\}/);
    expect(css).toMatch(/\.savescene__body-col \{[^}]*justify-content: center;/);
    expect(css).toMatch(/\.savescene__body-col \{[^}]*env\(safe-area-inset-top\)[^}]*env\(safe-area-inset-bottom\)/);
    expect(css).toMatch(/\.savescene__portrait \{[^}]*width: clamp\([^)]*dvh[^)]*\);/);
  });

  it('a short screen scrolls inside the column rather than clipping, and steps the portrait back before anything essential goes', () => {
    expect(css).toMatch(/\.savescene__scroll \{[^}]*overflow-y: auto;/);
    expect(css).toMatch(/@media \(max-height: 600px\) \{\s*\.savescene__portrait \{ width: clamp/);
    expect(css).toMatch(/@media \(max-height: 440px\) \{\s*\.savescene__portrait \{ display: none; \}/);
    // Text is never shrunk below readable sizes to make room
    const small = css.match(/\.savescene__[a-z-]+ \{[^}]*font-size: 0\.(\d)\d*rem/g) ?? [];
    for (const rule of small) expect(Number(rule.match(/font-size: 0\.(\d)/)![1])).toBeGreaterThanOrEqual(7);
  });

  it('the moves play on the portrait\'s box, never on the drawing, and reduced motion stills them', () => {
    expect(css).toMatch(/\.savescene__portrait\[data-move='hop'\]\[data-beat='0'\] \.savescene__body \{ animation: welcome-hop/);
    expect(css).toMatch(/\.savescene__portrait\[data-move='cheer'\]\[data-beat='1'\] \.savescene__body \{ animation: save-cheer-b/);
    expect(css).toMatch(/\.savescene\[data-reduced='true'\] \.savescene__body \{ animation: none !important; \}/);
    expect(css).not.toMatch(/\.savescene[^{]*\[data-blobbi-renderer\][^{]*\{[^}]*animation/);
  });
});
