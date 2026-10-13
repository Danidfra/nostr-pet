/**
 * The way in, end to end, with the real login store and real signing:
 * WELCOME → THE KEY (a scene: the facts, the key, a way to keep it, the
 * confirmation) → THE EGG (no profile step, M12.3) → home; the first egg
 * with slow relays, a refresh, a refused write and a lagging relay; the
 * returning player's doors; the profile in the menu; and the secret never in
 * a relay payload, a URL or a log.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The classic home (legacy since M11, when the room became the home): these tests follow the way in to it; `m11-way-in.test.tsx` follows it into the room
vi.mock('@/lib/home-experience', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/home-experience')>()), readExperience: () => 'classic' as const }));
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NLogin, NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import { nip19, getPublicKey } from 'nostr-tools';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, getTagValue } from '@blobbi-kit/core';

import Home from '@/pages/Home';
import { SceneSettingsProvider } from '@/features/home/scene';
import { createNewAccount } from '@/features/onboarding';
import { blobbiEvent, PUBKEY } from '@/test/fixtures';

const STORAGE_KEY = 'test:login';
const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[], failKinds: new Set<number>(), delayMs: 0, lagging: false };
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
  if (relay.delayMs) await new Promise((r) => setTimeout(r, relay.delayMs));
  const seen = new Set<string>();
  // A lagging relay has accepted what was published but does not serve it back yet
  const served = relay.lagging ? relay.all.filter((e) => !relay.published.includes(e)) : relay.all;
  return served.filter((e) => filters.some((f) => matches(e, f)) && !seen.has(e.id) && seen.add(e.id));
});
const event = vi.fn(async (ev: NostrEvent) => {
  if (relay.failKinds.has(ev.kind)) throw new Error(`relay refused kind ${ev.kind}`);
  relay.published.push(ev);
  if (ev.kind === 0) relay.all = [...relay.all.filter((e) => !(e.kind === 0 && e.pubkey === ev.pubkey)), ev];
  else if (ev.kind === KIND_BLOBBI_STATE || ev.kind === KIND_BLOBBONAUT_PROFILE) relay.all = [...relay.all.filter((e) => !(e.kind === ev.kind && getTagValue(e.tags, 'd') === getTagValue(ev.tags, 'd'))), ev];
  else relay.all.push(ev);
});
const pool = { query, event, group: () => pool } as unknown as NPool;

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <SceneSettingsProvider value={{ reducedMotion: true, idleEnabled: false }}>
      <NostrLoginProvider storageKey={STORAGE_KEY}>
        <NostrContext.Provider value={{ nostr: pool }}>
          <QueryClientProvider client={client}>
            <MemoryRouter>
              <Home />
            </MemoryRouter>
          </QueryClientProvider>
        </NostrContext.Provider>
      </NostrLoginProvider>
    </SceneSettingsProvider>,
  );
}

const published = (kind: number) => relay.published.filter((e) => e.kind === kind);
const clipboard = { text: '' };
const consoleSpy = { log: vi.spyOn(console, 'log'), warn: vi.spyOn(console, 'warn'), error: vi.spyOn(console, 'error'), info: vi.spyOn(console, 'info'), debug: vi.spyOn(console, 'debug') };

/** Everything that left the app: relay payloads, the URL, and what was logged. */
function nothingLeaked(secret: string) {
  for (const ev of relay.published) expect(JSON.stringify(ev)).not.toContain(secret.slice(5));
  for (const [filters] of query.mock.calls) expect(JSON.stringify(filters)).not.toContain(secret.slice(5));
  expect(window.location.href).not.toContain(secret.slice(5));
  for (const spy of Object.values(consoleSpy)) for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(secret.slice(5));
}

beforeEach(() => {
  relay.all = [];
  relay.published = [];
  relay.failKinds = new Set();
  relay.delayMs = 0;
  relay.lagging = false;
  window.localStorage.clear();
  query.mockClear();
  event.mockClear();
  for (const spy of Object.values(consoleSpy)) spy.mockClear();
  clipboard.text = '';
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => void (clipboard.text = t) } });
  Object.assign(URL, { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} });
  HTMLAnchorElement.prototype.click = () => {};
});
afterEach(() => {
  delete (window as { nostr?: unknown }).nostr;
});

describe('Creating an account', () => {
  it('the key as a scene: the facts before anything, the key readable, no npub; a way to keep it, then the confirmation; signed in; the egg at once, no profile step; the secret never leaves', async () => {
    renderHome();
    await screen.findByTestId('onboarding-welcome');
    await userEvent.click(screen.getByTestId('onboarding-create'));
    const scene = await screen.findByTestId('onboarding-create-account');
    expect(within(scene).getByRole('heading', { level: 2 })).toHaveTextContent('A little key, just for you.');
    // What it is, before any action: secret, anyone with it gets in, losing it can be for good, no recovery
    const facts = within(scene).getByTestId('key-warning');
    expect(facts).toHaveTextContent(/secret key/);
    expect(facts).toHaveTextContent(/Anyone who gets it can open your account/);
    expect(facts).toHaveTextContent(/lose your Blobbi for good/);
    expect(facts).toHaveTextContent(/Blobbi cannot recover it/);
    const nsec = within(scene).getByTestId('nsec-box').textContent!;
    expect(nsec).toMatch(/^nsec1[a-z0-9]{58}$/);
    const pubkey = getPublicKey(nip19.decode(nsec).data as Uint8Array);
    // No public identity on the way in: the menu has it
    expect(scene.textContent).not.toContain('npub1');
    expect(scene.textContent).not.toContain(nip19.npubEncode(pubkey));

    // No confirmation, and no way on, until a way to keep the key was chosen
    expect(screen.queryByTestId('key-saved')).toBeNull();
    expect(screen.queryByTestId('onboarding-continue')).toBeNull();
    await userEvent.click(screen.getByTestId('nsec-copy'));
    expect(clipboard.text).toBe(nsec);
    expect(screen.getByTestId('nsec-copy')).toHaveTextContent('Copied');
    await userEvent.click(screen.getByTestId('nsec-download'));
    // A download is only asked of the browser: never reported as done
    expect(screen.getByTestId('nsec-note')).toHaveTextContent(/browser was asked to save blobbi-nostr-key-backup-[a-z0-9]{8}\.txt/);
    expect(screen.getByTestId('nsec-note')).not.toHaveTextContent(/Downloaded/);
    const confirm = screen.getByTestId('key-confirm');
    expect(within(confirm).getByText('I saved my secret key somewhere safe.')).toBeInTheDocument();
    const go = within(confirm).getByTestId('onboarding-continue');
    expect(go).toHaveTextContent('Continue to my egg!');
    expect(go).toBeDisabled();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(0);
    await userEvent.click(screen.getByTestId('key-saved'));
    expect(go).toBeEnabled();
    await userEvent.click(go);

    // Signed in with the new key, kept by the ecosystem's login store; then the egg, straight away
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')[0]?.pubkey).toBe(pubkey));
    const egg = await screen.findByTestId('adoption-egg');
    expect(screen.queryByTestId('onboarding-profile')).toBeNull();
    expect(screen.queryByText(/How should your Blobbi know you/)).toBeNull();
    expect(screen.queryByText(/No Blobbi lives here yet/)).toBeNull();
    expect(egg).toHaveTextContent(/Here is your egg/);
    expect(screen.getByTestId('adoption-preview')).toHaveAttribute('data-drawn', 'true');
    expect(screen.getByTestId('adoption-adopt')).toBeEnabled();
    // Nothing published to get here: no empty profile, no kind 0
    expect(published(0)).toHaveLength(0);
    await userEvent.click(screen.getByTestId('adoption-adopt'));
    await waitFor(() => expect(published(KIND_BLOBBI_STATE)).toHaveLength(1));
    await waitFor(() => expect(published(KIND_BLOBBONAUT_PROFILE)).toHaveLength(1));
    expect(published(KIND_BLOBBI_STATE)[0].pubkey).toBe(pubkey);
    expect(getTagValue(published(KIND_BLOBBONAUT_PROFILE)[0].tags, 'name')).toBe('Blobbonaut');
    expect(published(0)).toHaveLength(0);
    await screen.findByRole('group', { name: /care for your blobbi/i }, { timeout: 5000 });

    nothingLeaked(nsec);
    // The menu can show the key again for a backup; hidden until asked. The public id is there.
    await userEvent.click(screen.getByTestId('menu-button'));
    await userEvent.click(await screen.findByTestId('menu-account'));
    const backup = await screen.findByTestId('key-backup-section');
    expect(screen.getByTestId('login-type')).toHaveTextContent(/secret key kept on this device/);
    expect(within(backup).getByTestId('nsec-box')).toHaveAttribute('data-shown', 'false');
    await userEvent.click(within(backup).getByTestId('nsec-toggle'));
    expect(within(backup).getByTestId('nsec-box')).toHaveTextContent(nsec);
  }, 20_000);

  it('writing it down is a way to keep it too; going back discards the key; Continue twice signs in once', async () => {
    renderHome();
    await screen.findByTestId('onboarding-welcome');
    await userEvent.click(screen.getByTestId('onboarding-create'));
    const first = (await screen.findByTestId('nsec-box')).textContent;
    await userEvent.click(screen.getByTestId('onboarding-back'));
    await screen.findByTestId('onboarding-welcome');
    await userEvent.click(screen.getByTestId('onboarding-create'));
    const second = (await screen.findByTestId('nsec-box')).textContent;
    expect(second).not.toBe(first);
    await userEvent.click(screen.getByTestId('nsec-written'));
    expect(screen.getByTestId('nsec-note')).toHaveTextContent(/Write every character/);
    await userEvent.click(screen.getByTestId('key-saved'));
    const go = screen.getByTestId('onboarding-continue');
    await userEvent.dblClick(go);
    await screen.findByTestId('adoption-egg');
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(1);
    expect(published(0)).toHaveLength(0);
  });

  it('a copy the browser refuses is said plainly and keeps the confirmation hidden', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => Promise.reject(new Error('denied')) } });
    renderHome();
    await userEvent.click(await screen.findByTestId('onboarding-create'));
    await userEvent.click(await screen.findByTestId('nsec-copy'));
    expect(screen.getByTestId('nsec-note')).toHaveTextContent(/Copying is not available here/);
    expect(screen.queryByTestId('key-confirm')).toBeNull();
  });
});

describe('The first egg, straight after the key (M12.3)', () => {
  it('with relays slow to answer, the way in never leaves its world nor starts again: the egg comes, drawn, with Adopt ready, and one adoption is written', async () => {
    relay.delayMs = 900;
    renderHome();
    await userEvent.click(await screen.findByTestId('onboarding-create'));
    await userEvent.click(await screen.findByTestId('nsec-copy'));
    await userEvent.click(screen.getByTestId('key-saved'));
    await userEvent.click(screen.getByTestId('onboarding-continue'));
    // While the collection is read: the welcome's world says one moment, never the empty room behind it
    expect(await screen.findByTestId('welcome-panel')).toHaveTextContent(/Just a moment/);
    expect(screen.getByTestId('welcome-stage')).toBeInTheDocument();
    expect(screen.queryByTestId('onboarding-welcome')).toBeNull();
    const egg = await screen.findByTestId('adoption-egg', undefined, { timeout: 4000 });
    expect(egg).toHaveAttribute('data-ready', 'true');
    expect(screen.getByTestId('adoption-egg-art').querySelector('[data-blobbi-renderer]')).not.toBeNull();
    // Repeated taps on Adopt: one adoption
    const adopt = screen.getByTestId('adoption-adopt');
    await userEvent.tripleClick(adopt);
    await waitFor(() => expect(published(KIND_BLOBBI_STATE)).toHaveLength(1), { timeout: 4000 });
    await waitFor(() => expect(published(KIND_BLOBBONAUT_PROFILE)).toHaveLength(1), { timeout: 4000 });
    await screen.findByRole('group', { name: /care for your blobbi/i }, { timeout: 8000 });
    expect(published(KIND_BLOBBI_STATE)).toHaveLength(1);
  }, 20_000);

  it('a refresh after the key, before adopting, opens on the egg itself: no "No Blobbi lives here yet", no second key', async () => {
    const account = createNewAccount();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: `nsec:${account.pubkey}`, type: 'nsec', pubkey: account.pubkey, createdAt: new Date().toISOString(), data: { nsec: account.nsec } }]));
    renderHome();
    const egg = await screen.findByTestId('adoption-egg');
    expect(egg).toHaveAttribute('data-ready', 'true');
    expect(screen.queryByText(/No Blobbi lives here yet/)).toBeNull();
    expect(screen.queryByTestId('onboarding-create-account')).toBeNull();
  });

  it('an adoption the relays refuse says so and is tried again with the same egg; nothing else is written', async () => {
    relay.failKinds = new Set([KIND_BLOBBI_STATE]);
    const account = createNewAccount();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: `nsec:${account.pubkey}`, type: 'nsec', pubkey: account.pubkey, createdAt: new Date().toISOString(), data: { nsec: account.nsec } }]));
    renderHome();
    await screen.findByTestId('adoption-egg');
    const d = screen.getByTestId('adoption-preview').getAttribute('data-d');
    await userEvent.click(screen.getByTestId('adoption-adopt'));
    expect(await screen.findByTestId('adoption-error')).toHaveTextContent(/refused kind 31124/);
    expect(screen.getByTestId('adoption-adopt')).toHaveTextContent('Try again');
    expect(screen.getByTestId('adoption-preview')).toHaveAttribute('data-d', d!);
    expect(published(KIND_BLOBBONAUT_PROFILE)).toHaveLength(0);
    relay.failKinds = new Set();
    await userEvent.click(screen.getByTestId('adoption-adopt'));
    await waitFor(() => expect(published(KIND_BLOBBI_STATE)).toHaveLength(1));
    expect(getTagValue(published(KIND_BLOBBI_STATE)[0].tags, 'd')).toBe(d);
  });

  it('a successful adoption is not erased by a relay that is a moment behind: no re-read sends the player back to the way in', async () => {
    const account = createNewAccount();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: `nsec:${account.pubkey}`, type: 'nsec', pubkey: account.pubkey, createdAt: new Date().toISOString(), data: { nsec: account.nsec } }]));
    renderHome();
    await screen.findByTestId('adoption-egg');
    // The relays accept the writes but do not serve them back yet
    relay.lagging = true;
    await userEvent.click(screen.getByTestId('adoption-adopt'));
    await screen.findByRole('group', { name: /care for your blobbi/i }, { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 400));
    expect(screen.queryByTestId('adoption-egg')).toBeNull();
    expect(screen.getByRole('group', { name: /care for your blobbi/i })).toBeInTheDocument();
  });
});

describe('An existing account', () => {
  it('signs in with a NIP-07 extension and goes straight home when a Blobbi exists; no profile step', async () => {
    relay.all = [blobbiEvent('0000000001', { name: 'Brook' })];
    (window as { nostr?: unknown }).nostr = {
      getPublicKey: async () => PUBKEY,
      signEvent: async (t: { kind: number; content: string; tags: string[][]; created_at: number }) => ({ ...t, id: 'f'.repeat(64), pubkey: PUBKEY, sig: '0'.repeat(128) }),
    };
    renderHome();
    await userEvent.click(await screen.findByTestId('onboarding-existing'));
    await userEvent.click(await screen.findByTestId('login-extension'));
    await screen.findByRole('group', { name: /care for your blobbi/i }, { timeout: 5000 });
    expect(relay.published).toHaveLength(0);
    await userEvent.click(screen.getByTestId('menu-button'));
    await userEvent.click(await screen.findByTestId('menu-account'));
    expect(await screen.findByTestId('login-type')).toHaveTextContent(/browser extension/);
    expect(screen.queryByTestId('key-backup-section')).toBeNull();
  });

  it('a secret key brought back as a file signs in; with no Blobbi yet, the egg follows, its kind 0 name kept for the Blobbonaut profile', async () => {
    const account = createNewAccount();
    relay.all = [{ id: 'k'.repeat(64), pubkey: account.pubkey, created_at: 1_700_000_000, kind: 0, tags: [], content: JSON.stringify({ name: 'Dana' }), sig: '0'.repeat(128) }];
    renderHome();
    await userEvent.click(await screen.findByTestId('onboarding-existing'));
    const file = new File([`${account.nsec}\n`], 'blobbi-nostr-key-backup-abcdefgh.txt', { type: 'text/plain' });
    await userEvent.upload(screen.getByTestId('login-nsec-file-input'), file);
    await waitFor(() => expect(screen.getByTestId('login-nsec-input')).toHaveValue(account.nsec));
    await userEvent.click(screen.getByTestId('login-nsec'));
    await screen.findByTestId('adoption-egg');
    await waitFor(() => expect(screen.getByTestId('adoption-adopt')).toBeEnabled());
    await userEvent.click(screen.getByTestId('adoption-adopt'));
    await waitFor(() => expect(published(KIND_BLOBBONAUT_PROFILE)).toHaveLength(1));
    expect(getTagValue(published(KIND_BLOBBONAUT_PROFILE)[0].tags, 'name')).toBe('Dana');
    nothingLeaked(account.nsec);
  });

  it('the profile is the menu\'s now: prefilled with what exists, nothing written until Save, the other fields kept', async () => {
    const account = createNewAccount();
    relay.all = [
      { id: 'k'.repeat(64), pubkey: account.pubkey, created_at: 1_700_000_000, kind: 0, tags: [], content: JSON.stringify({ nip05: 'dana@x.test', picture: 'https://x.test/p.png' }), sig: '0'.repeat(128) },
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: `nsec:${account.pubkey}`, type: 'nsec', pubkey: account.pubkey, createdAt: new Date().toISOString(), data: { nsec: account.nsec } }]));
    renderHome();
    await screen.findByTestId('adoption-egg');
    await userEvent.click(screen.getByTestId('menu-button'));
    await userEvent.click(await screen.findByTestId('menu-account'));
    const section = await screen.findByTestId('profile-section');
    await waitFor(() => expect(within(section).getByTestId('profile-picture')).toHaveValue('https://x.test/p.png'));
    expect(published(0)).toHaveLength(0);
    await userEvent.type(within(section).getByTestId('profile-name'), 'Dana');
    await userEvent.click(within(section).getByTestId('profile-save'));
    await waitFor(() => expect(published(0)).toHaveLength(1));
    expect(JSON.parse(published(0)[0].content)).toEqual({ nip05: 'dana@x.test', picture: 'https://x.test/p.png', name: 'Dana', display_name: 'Dana' });
    expect(published(0)[0].pubkey).toBe(account.pubkey);
    expect(await within(section).findByTestId('profile-saved')).toBeInTheDocument();
  });

  it('a failed profile publish from the menu says so; nothing else moves', async () => {
    relay.failKinds = new Set([0]);
    const account = createNewAccount();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: `nsec:${account.pubkey}`, type: 'nsec', pubkey: account.pubkey, createdAt: new Date().toISOString(), data: { nsec: account.nsec } }]));
    renderHome();
    await screen.findByTestId('adoption-egg');
    await userEvent.click(screen.getByTestId('menu-button'));
    await userEvent.click(await screen.findByTestId('menu-account'));
    const section = await screen.findByTestId('profile-section');
    await userEvent.type(within(section).getByTestId('profile-name'), 'Dana');
    await userEvent.click(within(section).getByTestId('profile-save'));
    expect(await within(section).findByTestId('profile-error')).toHaveTextContent(/refused kind 0/);
    expect(published(KIND_BLOBBI_STATE)).toHaveLength(0);
  });
});

describe('A signer app (NIP-46, nostrconnect://)', () => {
  it('shows a QR and a deep link for a session made of an ephemeral client key and a secret, waits, and signs in when the signer answers; the client secret never reaches the page', async () => {
    let captured: { params: { clientPubkey: string; clientSecretKey: Uint8Array; secret: string; relays: string[] }; opts: { signal?: AbortSignal; onStatus?: (s: 'awaiting-connect' | 'getting-public-key') => void } } | null = null;
    const spy = vi.spyOn(NLogin, 'fromNostrConnect').mockImplementation(async (params, _pool, opts) => {
      captured = { params, opts: opts ?? {} };
      opts?.onStatus?.('getting-public-key');
      await new Promise((r) => setTimeout(r, 400));
      // A real (throwaway) client key: the login must resolve to a signer for the home to open.
      return new NLogin('bunker', PUBKEY, { bunkerPubkey: 'b'.repeat(64), clientNsec: createNewAccount().nsec as `nsec1${string}`, relays: ['wss://relay.ditto.pub'] }) as ReturnType<typeof NLogin.fromBunker> extends Promise<infer L> ? L : never;
    });
    relay.all = [blobbiEvent('0000000001', { name: 'Brook' })];
    renderHome();
    await userEvent.click(await screen.findByTestId('onboarding-existing'));
    await userEvent.click(screen.getByTestId('login-signer-app'));
    const session = await screen.findByTestId('signer-app-session');
    await waitFor(() => expect(within(session).getByTestId('signer-app-qr').getAttribute('src')).toMatch(/^data:image\/png/));
    expect(within(session).getByTestId('signer-app-status')).toHaveTextContent(/Signer found/);
    expect(captured).not.toBeNull();
    const { params } = captured!;
    const uri = screen.getByTestId('signer-app-open').getAttribute('href')!;
    expect(uri.startsWith(`nostrconnect://${params.clientPubkey}?`)).toBe(true);
    expect(uri).toContain('relay=wss%3A%2F%2Frelay.ditto.pub');
    expect(uri).toContain(`secret=${params.secret}`);
    expect(uri).toContain('name=Blobbi');
    const secretHex = Array.from(params.clientSecretKey, (b) => b.toString(16).padStart(2, '0')).join('');
    expect(document.documentElement.innerHTML).not.toContain(secretHex);
    await screen.findByRole('group', { name: /care for your blobbi/i }, { timeout: 5000 });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')[0]).toMatchObject({ type: 'bunker', pubkey: PUBKEY });
    await userEvent.click(screen.getByTestId('menu-button'));
    await userEvent.click(await screen.findByTestId('menu-account'));
    expect(await screen.findByTestId('login-type')).toHaveTextContent(/remote signer/);
    spy.mockRestore();
  });

  it('cancelling aborts the wait and clears the session; a signer that fails is reported and the door stays open', async () => {
    const signals: AbortSignal[] = [];
    const spy = vi.spyOn(NLogin, 'fromNostrConnect').mockImplementation((_params, _pool, opts) => {
      signals.push(opts!.signal!);
      return new Promise((_resolve, reject) => opts!.signal!.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    });
    renderHome();
    await userEvent.click(await screen.findByTestId('onboarding-existing'));
    await userEvent.click(screen.getByTestId('login-signer-app'));
    await screen.findByTestId('signer-app-session');
    await userEvent.click(screen.getByTestId('signer-app-cancel'));
    expect(signals[0].aborted).toBe(true);
    expect(screen.queryByTestId('signer-app-session')).toBeNull();
    expect(screen.queryByTestId('signer-app-error')).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(0);
    spy.mockImplementation(async () => {
      throw new Error('signer refused');
    });
    await userEvent.click(screen.getByTestId('login-signer-app'));
    expect(await screen.findByTestId('signer-app-error')).toHaveTextContent(/signer refused/);
    expect(screen.getByTestId('login-signer-app')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('a refresh in the middle drops the session: nothing of it is stored', async () => {
    const spy = vi.spyOn(NLogin, 'fromNostrConnect').mockImplementation((_params, _pool, opts) => new Promise((_r, reject) => opts!.signal!.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))));
    const first = renderHome();
    await userEvent.click(await screen.findByTestId('onboarding-existing'));
    await userEvent.click(screen.getByTestId('login-signer-app'));
    await screen.findByTestId('signer-app-session');
    first.unmount();
    expect(Object.keys(window.localStorage).filter((k) => k !== STORAGE_KEY)).toEqual([]);
    expect(window.localStorage.getItem(STORAGE_KEY) ?? '[]').toBe('[]');
    spy.mockRestore();
  });
});
