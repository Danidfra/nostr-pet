/**
 * The Worlds door as the homes read it, from the real guest store and login
 * store: who is signed in, and how far a save has got, decide it; the word
 * shows once for a save confirmed while the app runs, never for an account
 * found at load or switched to.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NostrLoginProvider, NLogin, useNostrLogin } from '@nostrify/react/login';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { GuestProvider, createGuestStore, useGuest, type GuestStore } from '@/features/guest';
import { createGuestDocument } from '@/features/guest/guest-store';
import { resetBlockingLayers, claimBlockingLayer, releaseBlockingLayer } from '@/lib/blocking-layer';
import { useWatchWorldsAccess, useWorldsAccess } from './useWorldsAccess';
import { WORLDS_GUIDE_STORAGE_PREFIX, resetWorldsAccessSeen } from './worlds-access';

const LOGIN_KEY = 'nostr:login';

function keypair() {
  const sk = generateSecretKey();
  return { nsec: nip19.nsecEncode(sk), pubkey: getPublicKey(sk) };
}

/** The login provider renders once it has read its storage. */
async function setup(store: GuestStore) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NostrLoginProvider storageKey={LOGIN_KEY}>
      <GuestProvider store={store}>{children}</GuestProvider>
    </NostrLoginProvider>
  );
  const view = renderHook(
    () => {
      useWatchWorldsAccess();
      return { door: useWorldsAccess(), guest: useGuest(), login: useNostrLogin() };
    },
    { wrapper },
  );
  await waitFor(() => expect(view.result.current).not.toBeNull());
  return view;
}

const shownFor = (pubkey: string) => window.localStorage.getItem(WORLDS_GUIDE_STORAGE_PREFIX + pubkey);

beforeEach(() => {
  window.localStorage.clear();
  resetWorldsAccessSeen();
  resetBlockingLayers();
});
afterEach(() => cleanup());

describe('useWorldsAccess', () => {
  it('a guest is locked; the key signed in for the save is not an account yet; only the confirmed save opens the door, with the word, once', async () => {
    const identity = keypair();
    const store = createGuestStore(window.localStorage);
    store.begin(createGuestDocument(identity));
    const { result, rerender } = await setup(store);
    expect(result.current.door).toMatchObject({ access: 'guest', locked: true, guide: false });

    // The save's key step: the stage first, then the sign-in with the reserved key (SaveCeremony's order)
    act(() => result.current.guest.setStage('key'));
    expect(result.current.door.locked).toBe(true);
    act(() => {
      result.current.guest.setStage('profile');
      result.current.login.addLogin(NLogin.fromNsec(identity.nsec));
    });
    expect(result.current.guest.mode).toBe('promoting');
    expect(result.current.door).toMatchObject({ access: 'saving', locked: true, guide: false });
    for (const stage of ['publishing', 'verifying'] as const) {
      act(() => result.current.guest.setStage(stage));
      expect(result.current.door.locked, stage).toBe(true);
    }
    // Confirmed: open; the word waits while the save's ceremony is still on screen (its celebration)
    act(() => result.current.guest.setStage('done'));
    expect(result.current.door).toMatchObject({ access: 'open', locked: false, guide: false });
    expect(shownFor(identity.pubkey)).toBeNull();
    // The player leaves the celebration: the record is let go, the home is quiet, the word shows and is remembered
    act(() => result.current.guest.clear());
    expect(result.current.door).toMatchObject({ access: 'open', locked: false, guide: true });
    expect(shownFor(identity.pubkey)).toBe('shown');
    act(() => result.current.door.endGuide());
    expect(result.current.door.guide).toBe(false);
    rerender();
    expect(result.current.door.guide).toBe(false);
  });

  it('the word waits for a sheet over the world to close', async () => {
    const identity = keypair();
    const store = createGuestStore(window.localStorage);
    store.begin(createGuestDocument(identity));
    const { result } = await setup(store);
    act(() => {
      result.current.guest.setStage('profile');
      result.current.login.addLogin(NLogin.fromNsec(identity.nsec));
    });
    act(() => claimBlockingLayer('a-sheet'));
    act(() => {
      result.current.guest.setStage('done');
      result.current.guest.clear();
    });
    expect(result.current.door).toMatchObject({ locked: false, guide: false });
    act(() => releaseBlockingLayer('a-sheet'));
    expect(result.current.door.guide).toBe(true);
  });

  it('a save that fails or is backed out of leaves the door locked and says nothing', async () => {
    const identity = keypair();
    const store = createGuestStore(window.localStorage);
    store.begin(createGuestDocument(identity));
    const { result } = await setup(store);
    // Backed out of at the key (before any sign-in): a guest again
    act(() => result.current.guest.setStage('key'));
    act(() => result.current.guest.cancelSave());
    expect(result.current.door).toMatchObject({ access: 'guest', locked: true, guide: false });
    // A publish refused: the record stays at publishing, signed in with the reserved key
    act(() => {
      result.current.guest.setStage('profile');
      result.current.login.addLogin(NLogin.fromNsec(identity.nsec));
    });
    act(() => result.current.guest.setStage('publishing'));
    expect(result.current.door).toMatchObject({ access: 'saving', locked: true, guide: false });
    expect(shownFor(identity.pubkey)).toBeNull();
  });

  it('an account of one\'s own is open at once, with no word, and stays so across a reload', async () => {
    const account = keypair();
    window.localStorage.setItem(LOGIN_KEY, JSON.stringify([NLogin.fromNsec(account.nsec)]));
    const first = await setup(createGuestStore(window.localStorage));
    expect(first.result.current.door).toMatchObject({ access: 'open', locked: false, guide: false });
    first.unmount();
    resetWorldsAccessSeen();
    const second = await setup(createGuestStore(window.localStorage));
    expect(second.result.current.door).toMatchObject({ access: 'open', locked: false, guide: false });
    expect(shownFor(account.pubkey)).toBeNull();
  });

  it('a guest who signs in to another account they already have: open, but no word (no save happened)', async () => {
    const identity = keypair();
    const other = keypair();
    const store = createGuestStore(window.localStorage);
    store.begin(createGuestDocument(identity));
    const { result } = await setup(store);
    expect(result.current.door.locked).toBe(true);
    act(() => result.current.login.addLogin(NLogin.fromNsec(other.nsec)));
    expect(result.current.guest.mode).toBe('dormant');
    expect(result.current.door).toMatchObject({ access: 'open', locked: false, guide: false });
    expect(shownFor(other.pubkey)).toBeNull();
  });

  it('switching accounts while the word shows puts it away; signing out leaves a guest locked again', async () => {
    const identity = keypair();
    const other = keypair();
    const store = createGuestStore(window.localStorage);
    store.begin(createGuestDocument(identity));
    const { result } = await setup(store);
    act(() => {
      result.current.guest.setStage('profile');
      result.current.login.addLogin(NLogin.fromNsec(identity.nsec));
    });
    act(() => {
      result.current.guest.setStage('done');
      result.current.guest.clear();
    });
    expect(result.current.door.guide).toBe(true);
    // Another account made the current one
    const second = NLogin.fromNsec(other.nsec);
    act(() => result.current.login.addLogin(second));
    act(() => result.current.login.setLogin(second.id));
    expect(result.current.door).toMatchObject({ locked: false, guide: false });
    // A guest record again on this device and nobody signed in: locked
    act(() => {
      for (const l of result.current.login.logins) result.current.login.removeLogin(l.id);
      store.begin(createGuestDocument(keypair()));
    });
    expect(result.current.door).toMatchObject({ access: 'guest', locked: true, guide: false });
  });
});
