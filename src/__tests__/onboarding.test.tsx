/**
 * The way in, end to end, with the real login store and real signing:
 * WELCOME → CREATE ACCOUNT (key shown once, backup, gate) → PROFILE (kind 0)
 * → ADOPT (the existing flow) → home; the returning player's doors; the
 * profile step skipped, or not offered to a named profile; a refresh in the
 * middle; and the secret never in a relay payload, a URL or a log.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { NostrLoginProvider } from '@nostrify/react/login';
import { MemoryRouter } from 'react-router-dom';
import { nip19, getPublicKey } from 'nostr-tools';
import type { NPool, NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, getTagValue } from '@blobbi-kit/core';

import Home from '@/pages/Home';
import { SceneSettingsProvider } from '@/features/home/scene';
import { createNewAccount } from '@/features/onboarding';
import { blobbiEvent, PUBKEY } from '@/test/fixtures';

const STORAGE_KEY = 'test:login';
const relay = { all: [] as NostrEvent[], published: [] as NostrEvent[], failKinds: new Set<number>() };
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
  if (relay.failKinds.has(ev.kind)) throw new Error(`relay refused kind ${ev.kind}`);
  relay.published.push(ev);
  if (ev.kind === 0) relay.all = [...relay.all.filter((e) => !(e.kind === 0 && e.pubkey === ev.pubkey)), ev];
  else if (ev.kind === KIND_BLOBBI_STATE || ev.kind === KIND_BLOBBONAUT_PROFILE) relay.all = [...relay.all.filter((e) => !(e.kind === ev.kind && getTagValue(e.tags, 'd') === getTagValue(ev.tags, 'd'))), ev];
  else relay.all.push(ev);
});
const pool = { query, event } as unknown as NPool;

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
  it('shows the key once behind a plain warning, needs a confirmed backup, signs in, sets up the profile, adopts, and the secret never leaves', async () => {
    renderHome();
    await screen.findByTestId('onboarding-welcome');
    await userEvent.click(screen.getByTestId('onboarding-create'));
    const card = await screen.findByTestId('onboarding-create-account');
    expect(within(card).getByTestId('key-warning')).toHaveTextContent(/controls the account/);
    expect(within(card).getByTestId('key-warning')).toHaveTextContent(/lose access/);
    const nsec = within(card).getByTestId('nsec-box').textContent!;
    expect(nsec).toMatch(/^nsec1[a-z0-9]{58}$/);
    const pubkey = getPublicKey(nip19.decode(nsec).data as Uint8Array);
    expect(within(card).getByTestId('new-npub')).toHaveTextContent(nip19.npubEncode(pubkey));

    // The gate: nothing happens until the backup is confirmed.
    const go = screen.getByTestId('onboarding-continue');
    expect(go).toBeDisabled();
    await userEvent.click(screen.getByTestId('nsec-copy'));
    expect(clipboard.text).toBe(nsec);
    await userEvent.click(screen.getByTestId('nsec-download'));
    expect(screen.getByTestId('nsec-note')).toHaveTextContent(/Downloaded/);
    expect(go).toBeDisabled();
    await userEvent.click(screen.getByTestId('key-saved'));
    expect(go).toBeEnabled();
    await userEvent.click(go);

    // Signed in with the new key, kept by the ecosystem's login store; the profile step next (no kind 0 can exist).
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')[0]?.pubkey).toBe(pubkey));
    const profile = await screen.findByTestId('onboarding-profile');
    expect(published(0)).toHaveLength(0);
    await userEvent.type(within(profile).getByTestId('profile-name'), 'Dana');
    await userEvent.type(within(profile).getByTestId('profile-about'), 'Blobbi keeper');
    await userEvent.type(within(profile).getByTestId('profile-picture'), 'https://x.test/dana.png');
    await userEvent.click(within(profile).getByTestId('profile-save'));

    // One kind 0, really signed by the new key, with exactly what was typed.
    await waitFor(() => expect(published(0)).toHaveLength(1));
    const kind0 = published(0)[0];
    expect(kind0.pubkey).toBe(pubkey);
    expect(kind0.sig).toMatch(/^[0-9a-f]{128}$/);
    expect(JSON.parse(kind0.content)).toEqual({ name: 'Dana', display_name: 'Dana', about: 'Blobbi keeper', picture: 'https://x.test/dana.png' });
    expect(getTagValue(kind0.tags, 'client')).toBe('Blobbi');

    // Then adoption, the existing flow, with the new name suggested for the Blobbonaut profile.
    await screen.findByTestId('adoption-intro');
    await userEvent.click(screen.getByTestId('adoption-start'));
    await screen.findByTestId('adoption-preview');
    await userEvent.click(screen.getByTestId('adoption-adopt'));
    await waitFor(() => expect(published(KIND_BLOBBI_STATE)).toHaveLength(1));
    await waitFor(() => expect(published(KIND_BLOBBONAUT_PROFILE)).toHaveLength(1));
    expect(published(KIND_BLOBBI_STATE)[0].pubkey).toBe(pubkey);
    expect(getTagValue(published(KIND_BLOBBONAUT_PROFILE)[0].tags, 'name')).toBe('Dana');
    await screen.findByRole('group', { name: /care for your blobbi/i }, { timeout: 5000 });

    nothingLeaked(nsec);
    // The menu can show the key again for a backup; hidden until asked.
    await userEvent.click(screen.getByTestId('menu-button'));
    const backup = await screen.findByTestId('key-backup-section');
    expect(screen.getByTestId('login-type')).toHaveTextContent(/secret key kept on this device/);
    expect(within(backup).getByTestId('nsec-box')).toHaveAttribute('data-shown', 'false');
    expect(within(backup).getByTestId('nsec-box').textContent).not.toBe(nsec);
    await userEvent.click(within(backup).getByTestId('nsec-toggle'));
    expect(within(backup).getByTestId('nsec-box')).toHaveTextContent(nsec);
  }, 20_000);

  it('the profile step can be skipped, and going back from the key screen discards it', async () => {
    renderHome();
    await screen.findByTestId('onboarding-welcome');
    await userEvent.click(screen.getByTestId('onboarding-create'));
    const first = (await screen.findByTestId('nsec-box')).textContent;
    await userEvent.click(screen.getByTestId('onboarding-back'));
    await screen.findByTestId('onboarding-welcome');
    await userEvent.click(screen.getByTestId('onboarding-create'));
    const second = (await screen.findByTestId('nsec-box')).textContent;
    expect(second).not.toBe(first);
    await userEvent.click(screen.getByTestId('key-saved'));
    await userEvent.click(screen.getByTestId('onboarding-continue'));
    await screen.findByTestId('onboarding-profile');
    await userEvent.click(screen.getByTestId('profile-skip'));
    await screen.findByTestId('adoption-intro');
    expect(published(0)).toHaveLength(0);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(1);
  });

  it('a failed profile publish stays on the step with the error; nothing else moves', async () => {
    relay.failKinds = new Set([0]);
    renderHome();
    await userEvent.click(await screen.findByTestId('onboarding-create'));
    await userEvent.click(await screen.findByTestId('key-saved'));
    await userEvent.click(screen.getByTestId('onboarding-continue'));
    await userEvent.type(await screen.findByTestId('profile-name'), 'Dana');
    await userEvent.click(screen.getByTestId('profile-save'));
    expect(await screen.findByTestId('profile-error')).toHaveTextContent(/refused kind 0/);
    expect(screen.getByTestId('onboarding-profile')).toBeInTheDocument();
    expect(published(KIND_BLOBBI_STATE)).toHaveLength(0);
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
    expect(screen.queryByTestId('onboarding-profile')).toBeNull();
    expect(relay.published).toHaveLength(0);
    await userEvent.click(screen.getByTestId('menu-button'));
    expect(await screen.findByTestId('login-type')).toHaveTextContent(/browser extension/);
    expect(screen.queryByTestId('key-backup-section')).toBeNull();
  });

  it('a secret key pasted or brought back as a file signs in; a named kind 0 skips the profile step and adoption follows', async () => {
    const account = createNewAccount();
    relay.all = [{ id: 'k'.repeat(64), pubkey: account.pubkey, created_at: 1_700_000_000, kind: 0, tags: [], content: JSON.stringify({ name: 'Dana' }), sig: '0'.repeat(128) }];
    renderHome();
    await userEvent.click(await screen.findByTestId('onboarding-existing'));
    const file = new File([`${account.nsec}\n`], 'blobbi-nostr-key-backup-abcdefgh.txt', { type: 'text/plain' });
    await userEvent.upload(screen.getByTestId('login-nsec-file-input'), file);
    await waitFor(() => expect(screen.getByTestId('login-nsec-input')).toHaveValue(account.nsec));
    await userEvent.click(screen.getByTestId('login-nsec'));
    await screen.findByTestId('adoption-intro');
    expect(screen.queryByTestId('onboarding-profile')).toBeNull();
    nothingLeaked(account.nsec);
  });

  it('a nameless kind 0 gets the profile step with what exists prefilled, and the publish keeps the other fields', async () => {
    const account = createNewAccount();
    relay.all = [{ id: 'k'.repeat(64), pubkey: account.pubkey, created_at: 1_700_000_000, kind: 0, tags: [], content: JSON.stringify({ nip05: 'dana@x.test', picture: 'https://x.test/p.png' }), sig: '0'.repeat(128) }];
    renderHome();
    await userEvent.click(await screen.findByTestId('onboarding-existing'));
    await userEvent.type(await screen.findByTestId('login-nsec-input'), account.nsec);
    await userEvent.click(screen.getByTestId('login-nsec'));
    const profile = await screen.findByTestId('onboarding-profile');
    expect(within(profile).getByTestId('profile-picture')).toHaveValue('https://x.test/p.png');
    await userEvent.type(within(profile).getByTestId('profile-name'), 'Dana');
    await userEvent.click(within(profile).getByTestId('profile-save'));
    await waitFor(() => expect(published(0)).toHaveLength(1));
    expect(JSON.parse(published(0)[0].content)).toEqual({ nip05: 'dana@x.test', picture: 'https://x.test/p.png', name: 'Dana', display_name: 'Dana' });
    await screen.findByTestId('adoption-intro');
  });

  it('a refresh in the middle lands on the same step: the login is kept, the profile step comes back until it is done', async () => {
    const account = createNewAccount();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: `nsec:${account.pubkey}`, type: 'nsec', pubkey: account.pubkey, createdAt: new Date().toISOString(), data: { nsec: account.nsec } }]));
    const first = renderHome();
    await screen.findByTestId('onboarding-profile');
    first.unmount();
    renderHome();
    await screen.findByTestId('onboarding-profile');
    await userEvent.type(screen.getByTestId('profile-name'), 'Dana');
    await userEvent.click(screen.getByTestId('profile-save'));
    await waitFor(() => expect(published(0)).toHaveLength(1));
    await screen.findByTestId('adoption-intro');
    // The kind 0 is now on the relay: another refresh goes to adoption directly.
    screen.getByTestId('adoption-intro');
  });
});
