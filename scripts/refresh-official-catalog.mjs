#!/usr/bin/env node
/**
 * Regenerate src/features/inventory/official-catalog-snapshot.ts from the
 * live official definitions. READ-ONLY: one NIP-01 REQ per relay, nothing
 * published. Review the diff before committing.
 *
 *   node scripts/refresh-official-catalog.mjs > src/features/inventory/official-catalog-snapshot.ts
 */
const ISSUER = '9efb8d3045ba753f3664d503308b49783356b26a6d5f4b944bfac4239afe63a9';
const RELAYS = ['wss://relay.ditto.pub', 'wss://relay.dreamith.to'];
const KIND = 31632;

function ask(url) {
  return new Promise((resolve) => {
    const events = [];
    let done = false;
    const ws = new WebSocket(url);
    const finish = () => {
      if (done) return;
      done = true;
      try {
        ws.close();
      } catch {
        /* closed */
      }
      resolve(events);
    };
    const timer = setTimeout(finish, 12_000);
    ws.onopen = () => ws.send(JSON.stringify(['REQ', 'catalog', { kinds: [KIND], authors: [ISSUER] }]));
    ws.onmessage = (m) => {
      try {
        const msg = JSON.parse(m.data);
        if (msg[0] === 'EVENT' && msg[2]?.pubkey === ISSUER) events.push(msg[2]);
        if (msg[0] === 'EOSE' || msg[0] === 'CLOSED') {
          clearTimeout(timer);
          finish();
        }
      } catch {
        /* ignore */
      }
    };
    ws.onerror = () => {
      clearTimeout(timer);
      finish();
    };
    ws.onclose = () => {
      clearTimeout(timer);
      finish();
    };
  });
}

const tag = (t, n) => t.find((x) => x[0] === n)?.[1];
const results = await Promise.all(RELAYS.map(ask));
const byD = new Map();
for (const e of results.flat()) {
  const d = tag(e.tags, 'd');
  if (!d) continue;
  const current = byD.get(d);
  if (!current || current.created_at < e.created_at) byD.set(d, e);
}
const order = { food: 0, energy: 1, toy: 2, hygiene: 3, medicine: 4 };
const rows = [];
for (const e of byD.values()) {
  let content = {};
  try {
    content = JSON.parse(e.content || '{}');
  } catch {
    continue;
  }
  const md = content.metadata ?? {};
  const effects = content.effects?.['game:blobbi'] ?? {};
  if (tag(e.tags, 'type') !== 'consumable' || !md.action) continue;
  rows.push({ d: tag(e.tags, 'd'), name: tag(e.tags, 'name'), category: tag(e.tags, 'category'), emoji: md.emoji ?? tag(e.tags, 'symbol') ?? '', action: md.action, stages: md.stages ?? ['baby', 'adult'], effects, eventId: e.id, createdAt: e.created_at });
}
rows.sort((a, b) => (order[a.category] ?? 9) - (order[b.category] ?? 9) || a.d.localeCompare(b.d));
const date = new Date().toISOString().slice(0, 10);
const line = (x) => `  { d: '${x.d}', name: ${JSON.stringify(x.name)}, category: '${x.category}', emoji: '${x.emoji}', action: '${x.action}', stages: [${x.stages.map((s) => `'${s}'`).join(', ')}], effects: { ${Object.entries(x.effects).map(([k, v]) => `${k}: ${v}`).join(', ')} }, eventId: '${x.eventId}', createdAt: ${x.createdAt} },`;
process.stdout.write(`/**
 * SNAPSHOT of the official Blobbi care-item definitions, for when the
 * definition relays do not answer. NOT LIVE NOSTR DATA.
 *
 * The live source is the set of kind 31632 events signed by the official
 * item issuer (\`OFFICIAL_ITEM_ISSUER\`, \`issuers.ts\`), read at runtime by
 * \`useHomeInventory\` through the trusted-issuer pipeline; every fetched
 * definition that passes issuer validation REPLACES the row below with the
 * same address. This file only lets the home draw and apply the items it
 * already knows when that read fails or is slow: it carries the immutable
 * minimum (identity, name, category, emoji, care action, stages, effects),
 * no event, no signature, and is marked \`definitionSource: 'builtin'\` in
 * the UI. It never grants ownership and never overrides a valid event.
 *
 * Only care consumables are kept (currencies, effects and cosmetics are
 * never starter-usable). Generated from a read-only REQ
 * (\`kinds: [31632], authors: [official issuer]\`) on ${date} against
 * ${RELAYS.join(', ')} (${rows.length} of ${byD.size} official definitions were consumables);
 * \`eventId\` / \`createdAt\` say which revision each row mirrors.
 *
 * To refresh when the issuer publishes new items or revisions:
 *   node scripts/refresh-official-catalog.mjs > src/features/inventory/official-catalog-snapshot.ts
 * then review the diff (a new row is a new item; a changed row is a
 * revision; a vanished row is worth a question, not a silent removal).
 */
import type { BlobbiStage, CareItemEffect } from '@blobbi-kit/core';
import type { ItemAction } from './item-model';

export interface OfficialCatalogRow {
  /** The \`d\` of the official definition; the address is \`31632:<official issuer>:<d>\`. */
  d: string;
  name: string;
  category: 'food' | 'energy' | 'toy' | 'hygiene' | 'medicine';
  emoji: string;
  action: ItemAction;
  stages: readonly BlobbiStage[];
  effects: CareItemEffect;
  /** The revision this row mirrors, for the next refresh's diff. */
  eventId: string;
  createdAt: number;
}

export const OFFICIAL_CATALOG_SNAPSHOT_DATE = '${date}';

export const OFFICIAL_CATALOG_SNAPSHOT: readonly OfficialCatalogRow[] = [
${rows.map(line).join('\n')}
];
`);
