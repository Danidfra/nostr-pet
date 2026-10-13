import { describe, expect, it } from 'vitest';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { createGuestDocument } from './guest-store';
import { INVITE_REST_MS, inviteDue, resolveGuestMode } from './guest-session';

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
  it('waits for a hatched Blobbi and one real care action', () => {
    expect(inviteDue({ hatched: false, careCount: 3, dismissedAt: null, migrationBegun: false, now })).toBe(false);
    expect(inviteDue({ hatched: true, careCount: 0, dismissedAt: null, migrationBegun: false, now })).toBe(false);
    expect(inviteDue({ hatched: true, careCount: 1, dismissedAt: null, migrationBegun: false, now })).toBe(true);
  });
  it('rests for a day after Maybe later, and never nags once saving began', () => {
    expect(inviteDue({ hatched: true, careCount: 1, dismissedAt: now - 1_000, migrationBegun: false, now })).toBe(false);
    expect(inviteDue({ hatched: true, careCount: 1, dismissedAt: now - INVITE_REST_MS - 1, migrationBegun: false, now })).toBe(true);
    expect(inviteDue({ hatched: true, careCount: 1, dismissedAt: null, migrationBegun: true, now })).toBe(false);
  });
});
