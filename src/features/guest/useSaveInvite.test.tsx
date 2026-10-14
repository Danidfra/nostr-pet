/**
 * The invitation's rules in one hook (M15): active time counted only while
 * the tab is visible and focused, the ask after real care, five active
 * minutes and a quiet moment, never over a blocking layer, once per visit;
 * Maybe later rests it, Don't ask again turns it off for good; a v1 record
 * from before M15 reads as no time played.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { NostrLoginProvider } from '@nostrify/react/login';
import { GuestProvider } from './GuestProvider';
import { createGuestStore } from './guest-context';
import { GUEST_STORAGE_KEY, createGuestDocument, readGuestDocument, writeGuestDocument, type StoredGuestDocument } from './guest-store';
import { INVITE_ACTIVE_MS, INVITE_DELAY_MS, INVITE_REST_MS } from './guest-session';
import { INVITE_FLUSH_MS, isActivePlay, useSaveInvite, type SaveInvite } from './useSaveInvite';
import { claimBlockingLayer, releaseBlockingLayer, resetBlockingLayers } from '@/lib/blocking-layer';
import { useGuestUi } from './useGuest';

const sk = generateSecretKey();
const identity = { nsec: nip19.nsecEncode(sk), pubkey: getPublicKey(sk) };

function seed({ cared = 1, activeMs = 0, dismissedAt = null as number | null, optOut = false, legacy = false } = {}): StoredGuestDocument {
  const doc = createGuestDocument(identity, 1_000);
  const stored: StoredGuestDocument = { ...doc, blobbiD: 'blobbi-aaaaaaaaaaaa-0000000001', care: { count: cared, lastAt: cared ? 1_000 : null }, invite: { dismissedAt, shownCount: 0, activeMs, optOut } };
  if (legacy) {
    // A record written before M15: no activeMs, no optOut
    const raw = JSON.parse(JSON.stringify(stored)) as { invite: Record<string, unknown> };
    delete raw.invite.activeMs;
    delete raw.invite.optOut;
    window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(raw));
  } else {
    writeGuestDocument(stored, window.localStorage);
  }
  return stored;
}

const last: { invite: SaveInvite | null; request: string | null } = { invite: null, request: null };
function Probe({ hatched = true, quiet = true }: { hatched?: boolean; quiet?: boolean }) {
  const invite = useSaveInvite({ hatched, quiet });
  const ui = useGuestUi();
  last.invite = invite;
  last.request = ui.request;
  return <div data-testid="probe" data-open={invite.open ? 'true' : 'false'} />;
}
/** The login provider reads its storage asynchronously: a few microtasks before the tree is up. */
const settle = () =>
  act(async () => {
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
  });
async function mount(props: { hatched?: boolean; quiet?: boolean } = {}) {
  const store = createGuestStore(window.localStorage);
  const tree = (p: typeof props) => (
    <NostrLoginProvider storageKey="nostr:login">
      <GuestProvider store={store}>
        <Probe {...p} />
      </GuestProvider>
    </NostrLoginProvider>
  );
  const view = render(tree(props));
  await settle();
  screen.getByTestId('probe');
  return { ...view, store, rerender: (next: typeof props) => view.rerender(tree(next)) };
}
const doc = () => {
  const read = readGuestDocument(window.localStorage);
  return read.kind === 'guest' ? read.doc : null;
};
const isOpen = () => screen.getByTestId('probe').getAttribute('data-open') === 'true';

let visibility: DocumentVisibilityState = 'visible';
let focused = true;
beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  focused = true;
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  vi.spyOn(document, 'hasFocus').mockImplementation(() => focused);
});
afterEach(() => {
  vi.useRealTimers();
  resetBlockingLayers();
});
const hide = () => {
  visibility = 'hidden';
  act(() => void document.dispatchEvent(new Event('visibilitychange')));
};
const show = () => {
  visibility = 'visible';
  act(() => void document.dispatchEvent(new Event('visibilitychange')));
};
const blur = () => {
  focused = false;
  act(() => void window.dispatchEvent(new Event('blur')));
};
const focus = () => {
  focused = true;
  act(() => void window.dispatchEvent(new Event('focus')));
};
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('active time', () => {
  it('is visible and focused', async () => {
    expect(isActivePlay()).toBe(true);
    visibility = 'hidden';
    expect(isActivePlay()).toBe(false);
    visibility = 'visible';
    focused = false;
    expect(isActivePlay()).toBe(false);
  });

  it('counts while the tab is visible and focused, flushes every stretch, and counts nothing in the background', async () => {
    seed();
    await mount();
    expect(doc()!.invite.activeMs).toBe(0);
    advance(INVITE_FLUSH_MS);
    expect(doc()!.invite.activeMs).toBe(INVITE_FLUSH_MS);
    advance(INVITE_FLUSH_MS);
    expect(doc()!.invite.activeMs).toBe(2 * INVITE_FLUSH_MS);
    // Hidden: the running stretch is written and nothing more is counted
    advance(5_000);
    hide();
    expect(doc()!.invite.activeMs).toBe(2 * INVITE_FLUSH_MS + 5_000);
    advance(10 * INVITE_FLUSH_MS);
    expect(doc()!.invite.activeMs).toBe(2 * INVITE_FLUSH_MS + 5_000);
    // Back: counting resumes from now (the interval keeps its own phase, so part of the stretch waits in memory
    // until the next tick or the next change; losing the focus writes it at once)
    show();
    advance(INVITE_FLUSH_MS);
    expect(doc()!.invite.activeMs).toBeGreaterThanOrEqual(2 * INVITE_FLUSH_MS + 5_000);
    // Visible but another window has the focus: not active play either
    blur();
    expect(doc()!.invite.activeMs).toBe(3 * INVITE_FLUSH_MS + 5_000);
    advance(3 * INVITE_FLUSH_MS);
    expect(doc()!.invite.activeMs).toBe(3 * INVITE_FLUSH_MS + 5_000);
    focus();
    advance(INVITE_FLUSH_MS);
    hide();
    expect(doc()!.invite.activeMs).toBe(4 * INVITE_FLUSH_MS + 5_000);
  });

  it('writes the running stretch when the hook unmounts, so a page change loses nothing', async () => {
    seed();
    const view = await mount();
    advance(7_000);
    view.unmount();
    expect(doc()!.invite.activeMs).toBe(7_000);
  });

  it('a record from before M15 reads as no time played and no opt-out, and gains both', async () => {
    seed({ legacy: true });
    expect(doc()!.invite).toEqual({ dismissedAt: null, shownCount: 0, activeMs: 0, optOut: false });
    await mount();
    advance(INVITE_FLUSH_MS);
    expect(doc()!.invite.activeMs).toBe(INVITE_FLUSH_MS);
    expect(doc()!.identity.pubkey).toBe(identity.pubkey);
  });

  it('counts nothing when nobody is a guest', async () => {
    await mount();
    advance(INVITE_FLUSH_MS * 3);
    expect(doc()).toBeNull();
  });
});

describe('the ask', () => {
  it('needs real care AND five active minutes: care alone is not enough, time alone is not enough', async () => {
    seed({ cared: 1, activeMs: 0 });
    const view = await mount();
    advance(INVITE_DELAY_MS + 100);
    expect(isOpen()).toBe(false);
    view.unmount();
    window.localStorage.clear();
    seed({ cared: 0, activeMs: INVITE_ACTIVE_MS });
    await mount();
    advance(INVITE_DELAY_MS + 100);
    expect(isOpen()).toBe(false);
  });

  it('comes after a quiet moment once both are met, once per visit; it steps aside under a blocking layer and is back after', async () => {
    seed({ cared: 1, activeMs: INVITE_ACTIVE_MS });
    const view = await mount({ quiet: false });
    advance(INVITE_DELAY_MS * 2);
    expect(isOpen()).toBe(false);
    view.rerender({ quiet: true });
    advance(INVITE_DELAY_MS - 100);
    expect(isOpen()).toBe(false);
    advance(200);
    expect(isOpen()).toBe(true);
    act(() => claimBlockingLayer('a-sheet'));
    expect(isOpen()).toBe(false);
    act(() => releaseBlockingLayer('a-sheet'));
    expect(isOpen()).toBe(true);
  });

  it('a blocking layer already open holds the ask back until it closes', async () => {
    seed({ cared: 1, activeMs: INVITE_ACTIVE_MS });
    claimBlockingLayer('intro');
    await mount();
    advance(INVITE_DELAY_MS * 3);
    expect(isOpen()).toBe(false);
    act(() => releaseBlockingLayer('intro'));
    advance(INVITE_DELAY_MS + 100);
    expect(isOpen()).toBe(true);
  });

  it('time played adds up to the ask on this very visit', async () => {
    seed({ cared: 1, activeMs: INVITE_ACTIVE_MS - INVITE_FLUSH_MS });
    await mount();
    advance(INVITE_DELAY_MS + 100);
    expect(isOpen()).toBe(false);
    advance(INVITE_FLUSH_MS);
    advance(INVITE_DELAY_MS + 100);
    expect(isOpen()).toBe(true);
  });

  it('Save opens the ceremony; Maybe later rests it for about a day; Don\'t ask again turns it off for good; the record keeps its key', async () => {
    seed({ cared: 1, activeMs: INVITE_ACTIVE_MS });
    const view = await mount();
    advance(INVITE_DELAY_MS + 100);
    expect(isOpen()).toBe(true);
    act(() => last.invite!.save());
    expect(isOpen()).toBe(false);
    expect(last.request).toBe('save');
    view.unmount();

    window.localStorage.clear();
    seed({ cared: 1, activeMs: INVITE_ACTIVE_MS });
    const second = await mount();
    advance(INVITE_DELAY_MS + 100);
    act(() => last.invite!.later());
    expect(isOpen()).toBe(false);
    expect(doc()!.invite.dismissedAt).toBe(Date.now());
    expect(doc()!.invite.optOut).toBe(false);
    expect(doc()!.invite.shownCount).toBe(1);
    second.unmount();
    // A fresh visit within the day: not asked; after the day: asked
    const third = await mount();
    advance(INVITE_DELAY_MS + 100);
    expect(isOpen()).toBe(false);
    third.unmount();
    vi.setSystemTime(Date.now() + INVITE_REST_MS + 1_000);
    const fourth = await mount();
    advance(INVITE_DELAY_MS + 100);
    expect(isOpen()).toBe(true);
    act(() => last.invite!.never());
    expect(isOpen()).toBe(false);
    expect(doc()!.invite.optOut).toBe(true);
    expect(doc()!.identity.pubkey).toBe(identity.pubkey);
    expect(doc()!.identity.nsec).toBe(identity.nsec);
    fourth.unmount();
    // However long it rests, never again on its own
    vi.setSystemTime(Date.now() + INVITE_REST_MS * 30);
    await mount();
    advance(INVITE_DELAY_MS * 3);
    expect(isOpen()).toBe(false);
  });

  it('never asks an egg, nor once saving has begun', async () => {
    seed({ cared: 1, activeMs: INVITE_ACTIVE_MS });
    const view = await mount({ hatched: false });
    advance(INVITE_DELAY_MS * 2);
    expect(isOpen()).toBe(false);
    view.unmount();
    window.localStorage.clear();
    const stored = seed({ cared: 1, activeMs: INVITE_ACTIVE_MS });
    writeGuestDocument({ ...stored, migration: { stage: 'key', startedAt: 1, landed: {}, profileDone: false } }, window.localStorage);
    await mount();
    advance(INVITE_DELAY_MS * 2);
    expect(isOpen()).toBe(false);
  });
});
