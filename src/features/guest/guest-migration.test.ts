/**
 * Saving a guest Blobbi: the same Blobbi, byte for byte where it matters
 * (address, tags, V3 seed), published once, resumable after any failure.
 */
import { describe, expect, it, vi } from 'vitest';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE, deriveBlobbiV3Seed, getBlobbiVisualIdentity, parseModernBlobbiEvent, type NostrEvent } from '@blobbi-kit/core';
import type { PublishEventTemplate } from '@blobbi-kit/react';
import { eggTemplate, newEggPreview, profileTemplate } from '@/features/adoption/adoption-plan';
import { finalizeTemplate } from '@/features/care/usePublishAdapter';
import { createGuestDocument, type GuestDocument } from './guest-store';
import { localRecordSigner } from './guest-signer';
import { applyGuestEvent } from './guest-world';
import { withEvents, withLanded, withMigrationStage } from './guest-context';
import { MIGRATION_STEPS, migrationTemplates, runGuestMigration, verifyGuestMigration } from './guest-migration';

const sk = generateSecretKey();
const identity = { nsec: nip19.nsecEncode(sk), pubkey: getPublicKey(sk) };

/** A guest who adopted (the egg) and whose profile notes it, as the guest world records them. */
async function guestWithEgg(): Promise<{ doc: GuestDocument; egg: NostrEvent }> {
  const signer = localRecordSigner(identity.pubkey);
  const preview = newEggPreview(identity.pubkey, 'Pip', 1_700_000_000);
  const egg = await signer.signEvent(finalizeTemplate(eggTemplate(preview)));
  const profile = await signer.signEvent(finalizeTemplate(profileTemplate({ ownerPubkey: identity.pubkey, profile: null, d: preview.d, suggestedName: 'Blobbonaut' })));
  let doc = createGuestDocument(identity);
  doc = withEvents(doc, applyGuestEvent(doc.events, egg), egg);
  doc = withEvents(doc, applyGuestEvent(doc.events, profile), profile);
  return { doc, egg };
}

/** A signer with the real key, as the login store would make it: the publish adapter's job, stripped to the test. */
function realPublisher(relay: NostrEvent[], refuse: Set<number> = new Set()) {
  let n = 0;
  return {
    publish: vi.fn(async (template: PublishEventTemplate): Promise<NostrEvent> => {
      if (refuse.has(template.kind)) throw new Error(`relay refused kind ${template.kind}`);
      const t = finalizeTemplate(template);
      const event: NostrEvent = { ...t, id: String(++n).padStart(64, 'a'), pubkey: identity.pubkey, sig: 'f'.repeat(128) };
      relay.push(event);
      return event;
    }),
  };
}
const reader = (relay: NostrEvent[]) => ({ query: vi.fn(async (filters: { kinds?: number[]; authors?: string[]; '#d'?: string[] }[]) => relay.filter((e) => filters.some((f) => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey)) && (!f['#d'] || e.tags.some(([n, v]) => n === 'd' && f['#d']!.includes(v)))))) });

describe('migrationTemplates', () => {
  it('keeps the address, every tag and the content, and lets the adapter set published_at afresh', async () => {
    const { doc, egg } = await guestWithEgg();
    const templates = migrationTemplates(doc, 1_700_100_000);
    expect(templates.blobbi).not.toBeNull();
    const tpl = templates.blobbi!;
    expect(tpl.kind).toBe(KIND_BLOBBI_STATE);
    expect(tpl.created_at).toBe(1_700_100_000);
    expect(tpl.content).toBe(egg.content);
    expect(tpl.tags.filter(([n]) => n !== 'published_at')).toEqual(egg.tags.filter(([n]) => n !== 'published_at'));
    expect(tpl.tags.some(([n]) => n === 'published_at')).toBe(false);
    expect(templates.profile.kind).toBe(KIND_BLOBBONAUT_PROFILE);
    expect(templates.profile.tags).toContainEqual(['current_companion', doc.blobbiD]);
  });

  it('publishes the very same Blobbi: same d, same V3 seed, same visual identity under the real key', async () => {
    const { doc, egg } = await guestWithEgg();
    const relay: NostrEvent[] = [];
    const publisher = realPublisher(relay);
    const outcome = await runGuestMigration({ doc, nostr: reader(relay), publisher, onLanded: () => {} });
    expect(outcome.ok).toBe(true);
    const published = relay.find((e) => e.kind === KIND_BLOBBI_STATE)!;
    expect(published.pubkey).toBe(egg.pubkey);
    const d = egg.tags.find(([n]) => n === 'd')![1];
    expect(published.tags.find(([n]) => n === 'd')![1]).toBe(d);
    expect(deriveBlobbiV3Seed(published.pubkey, d)).toBe(deriveBlobbiV3Seed(egg.pubkey, d));
    const before = parseModernBlobbiEvent(egg)!;
    const after = parseModernBlobbiEvent(published)!;
    expect(getBlobbiVisualIdentity(after)).toEqual(getBlobbiVisualIdentity(before));
    expect(after.name).toBe('Pip');
    expect(after.d).toBe(before.d);
  });
});

describe('runGuestMigration', () => {
  it('publishes the Blobbi then the profile, reporting each as it lands', async () => {
    const { doc } = await guestWithEgg();
    const relay: NostrEvent[] = [];
    const landed = vi.fn();
    const progress: string[] = [];
    const outcome = await runGuestMigration({ doc, nostr: reader(relay), publisher: realPublisher(relay), onLanded: landed, onProgress: (p) => progress.push(`${p.step}:${p.state}`) });
    expect(outcome.ok).toBe(true);
    expect(relay.map((e) => e.kind)).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE]);
    expect(landed.mock.calls.map(([step, , how]) => `${step}:${how}`)).toEqual(['blobbi:landed', 'profile:landed']);
    expect(progress).toEqual(['blobbi:checking', 'blobbi:publishing', 'blobbi:landed', 'profile:checking', 'profile:publishing', 'profile:landed']);
  });

  it('stops at the first refusal and, run again, publishes only what is missing', async () => {
    const { doc } = await guestWithEgg();
    const relay: NostrEvent[] = [];
    const refusing = realPublisher(relay, new Set([KIND_BLOBBONAUT_PROFILE]));
    const first = await runGuestMigration({ doc, nostr: reader(relay), publisher: refusing, onLanded: () => {} });
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.step).toBe('profile');
    expect(relay.map((e) => e.kind)).toEqual([KIND_BLOBBI_STATE]);
    // Try again: the Blobbi is found on the relays, never published twice; the profile goes out now
    const again = realPublisher(relay);
    const landed = vi.fn();
    const second = await runGuestMigration({ doc, nostr: reader(relay), publisher: again, onLanded: landed });
    expect(second.ok).toBe(true);
    expect(again.publish).toHaveBeenCalledTimes(1);
    expect(again.publish.mock.calls[0][0].kind).toBe(KIND_BLOBBONAUT_PROFILE);
    expect(landed.mock.calls.map(([step, , how]) => `${step}:${how}`)).toEqual(['blobbi:found', 'profile:landed']);
    expect(relay.filter((e) => e.kind === KIND_BLOBBI_STATE)).toHaveLength(1);
  });

  it('trusts what the record says landed when the relays cannot be asked, and asks when it says nothing', async () => {
    const { doc } = await guestWithEgg();
    const relay: NostrEvent[] = [];
    const unreachable = { query: vi.fn(async () => Promise.reject(new Error('timeout'))) };
    const publisher = realPublisher(relay);
    // Nothing recorded: the read fails, so both are published (a publish is a replace: never a second Blobbi)
    const outcome = await runGuestMigration({ doc, nostr: unreachable, publisher, onLanded: () => {} });
    expect(outcome.ok).toBe(true);
    expect(publisher.publish).toHaveBeenCalledTimes(2);
    // The Blobbi recorded as landed and the relays unreachable: the record is trusted, only the profile goes out
    const recorded = withLanded(withMigrationStage(doc, 'publishing'), 'blobbi', 'x'.repeat(64));
    const publisher2 = realPublisher([]);
    await runGuestMigration({ doc: recorded, nostr: unreachable, publisher: publisher2, onLanded: () => {} });
    expect(publisher2.publish).toHaveBeenCalledTimes(1);
    expect(publisher2.publish.mock.calls[0][0].kind).toBe(KIND_BLOBBONAUT_PROFILE);
    // Recorded as landed but the relays, asked, do not have it (behind, or lost): published again, a replace
    const relay3: NostrEvent[] = [];
    const publisher3 = realPublisher(relay3);
    await runGuestMigration({ doc: recorded, nostr: reader(relay3), publisher: publisher3, onLanded: () => {} });
    expect(publisher3.publish.mock.calls.map(([t]) => t.kind)).toEqual([KIND_BLOBBI_STATE, KIND_BLOBBONAUT_PROFILE]);
  });

  it('verifies only when the relays hold both', async () => {
    const { doc } = await guestWithEgg();
    const relay: NostrEvent[] = [];
    expect(await verifyGuestMigration(doc, reader(relay))).toBe(false);
    await runGuestMigration({ doc, nostr: reader(relay), publisher: realPublisher(relay), onLanded: () => {} });
    expect(await verifyGuestMigration(doc, reader(relay))).toBe(true);
    expect(await verifyGuestMigration(doc, { query: async () => Promise.reject(new Error('down')) })).toBe(false);
  });

  it('has exactly two steps, in Island\'s order', () => {
    expect(MIGRATION_STEPS).toEqual(['blobbi', 'profile']);
  });
});
