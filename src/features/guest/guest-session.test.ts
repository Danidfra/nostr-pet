import { describe, expect, it } from 'vitest';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { createGuestDocument } from './guest-store';
import { INVITE_ACTIVE_MS, INVITE_REST_MS, inviteDue, resolveGuestMode } from './guest-session';

const sk = generateSecretKey();
const identity = { nsec: nip19.nsecEncode(sk), pubkey: getPublicKey(sk) };
const doc = createGuestDocument(identity);

describe('resolveGuestMode', () => {
  it('is none without a record, active with one and nobody signed in', () => {
    expect(resolveGuestMode(null, undefined)).toBe('none');
    expect(resolveGuestMode(null, 'f'.repeat(64))).toBe('none');
    expect(resolveGuestMode(doc, undefined)).toBe('active');
  });
  it('is promoting when the login is the reserved key, dormant for any other login', () => {
    expect(resolveGuestMode(doc, identity.pubkey)).toBe('promoting');
    expect(resolveGuestMode(doc, 'f'.repeat(64))).toBe('dormant');
  });
});

describe('inviteDue', () => {
  const now = 1_000_000_000;
  const base = { hatched: true, careCount: 1, activeMs: INVITE_ACTIVE_MS, dismissedAt: null, optOut: false, migrationBegun: false, now };
  it('waits for a hatched Blobbi and one real care action', () => {
    expect(inviteDue({ ...base, hatched: false, careCount: 3 })).toBe(false);
    expect(inviteDue({ ...base, careCount: 0 })).toBe(false);
    expect(inviteDue(base)).toBe(true);
  });
  it('waits for about five minutes of active play (M15)', () => {
    expect(inviteDue({ ...base, activeMs: 0 })).toBe(false);
    expect(inviteDue({ ...base, activeMs: INVITE_ACTIVE_MS - 1 })).toBe(false);
    expect(inviteDue({ ...base, activeMs: INVITE_ACTIVE_MS })).toBe(true);
    expect(INVITE_ACTIVE_MS).toBe(5 * 60 * 1000);
  });
  it('rests for about a day after Maybe later, and never nags once saving began', () => {
    expect(INVITE_REST_MS).toBe(24 * 60 * 60 * 1000);
    expect(inviteDue({ ...base, dismissedAt: now - 1_000 })).toBe(false);
    expect(inviteDue({ ...base, dismissedAt: now - INVITE_REST_MS + 1 })).toBe(false);
    expect(inviteDue({ ...base, dismissedAt: now - INVITE_REST_MS - 1 })).toBe(true);
    expect(inviteDue({ ...base, migrationBegun: true })).toBe(false);
  });
  it("never asks again after Don't ask again, however much is played (M15)", () => {
    expect(inviteDue({ ...base, optOut: true })).toBe(false);
    expect(inviteDue({ ...base, optOut: true, activeMs: INVITE_ACTIVE_MS * 100, careCount: 50, dismissedAt: now - INVITE_REST_MS * 10 })).toBe(false);
  });
});
