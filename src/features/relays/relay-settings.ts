/**
 * The player's relay settings: this device's choice, never published.
 *
 *   default     the Blobbi network's relays (`PRIMARY_RELAY`, `BASE_RELAYS`):
 *               fixed, always used, shown with their status. Three of them
 *               are REQUIRED (`ABSENCE_REQUIRED_RELAYS`: complete reads and
 *               saved writes depend on them); relay.nostr.band is a default
 *               relay that nothing waits for. No setting turns any off
 *   extras      up to `MAX_EXTRA_RELAYS` relays the player adds (by hand, or
 *               picked from their NIP-65 list), each with read and write
 *               switches. A new extra is read-only: sending the player's
 *               events to it is a separate, explicit choice. An extra never
 *               counts for "this does not exist" nor for "this was saved"
 *
 * The NIP-65 relay list (kind 10002) is only ever read, to offer its relays;
 * it is never written or changed here.
 */
import { ABSENCE_REQUIRED_RELAYS, BASE_RELAYS, MAX_EXTRA_RELAYS, PRIMARY_RELAY, normalizeRelayUrl } from '@/config/relays';

export const RELAY_SETTINGS_KEY = 'blobbi:relays:v1';

export type ExtraRelaySource = 'manual' | 'nip65';

export interface ExtraRelaySetting {
  url: string;
  read: boolean;
  write: boolean;
  source: ExtraRelaySource;
}

export interface RelaySettings {
  v: 1;
  extras: ExtraRelaySetting[];
}

export const DEFAULT_RELAY_SETTINGS: RelaySettings = { v: 1, extras: [] };

/** The Blobbi network's default relays, normalized, in the order they are shown. */
export const DEFAULT_RELAYS: readonly string[] = [...new Set([PRIMARY_RELAY, ...BASE_RELAYS].map((u) => normalizeRelayUrl(u)).filter((u): u is string => u !== null))];

const REQUIRED = new Set(ABSENCE_REQUIRED_RELAYS.map((u) => normalizeRelayUrl(u)).filter((u): u is string => u !== null));

/** What a default relay is for: the Blobbi relay, one a complete read and a saved write need, or a default one nothing waits for. */
export function defaultRelayRole(url: string): 'primary' | 'required' | 'default' {
  if (url === normalizeRelayUrl(PRIMARY_RELAY)) return 'primary';
  return REQUIRED.has(url) ? 'required' : 'default';
}

export function isDefaultRelay(url: string): boolean {
  return DEFAULT_RELAYS.includes(url);
}

/** Stored settings, defensively: anything that is not a valid extra is dropped, never guessed. */
export function parseRelaySettings(raw: unknown): RelaySettings {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return DEFAULT_RELAY_SETTINGS;
    }
  }
  if (!value || typeof value !== 'object' || (value as { v?: unknown }).v !== 1 || !Array.isArray((value as { extras?: unknown }).extras)) return DEFAULT_RELAY_SETTINGS;
  const extras: ExtraRelaySetting[] = [];
  for (const item of (value as { extras: unknown[] }).extras) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    const url = normalizeRelayUrl(e.url);
    if (!url || isDefaultRelay(url) || extras.some((x) => x.url === url)) continue;
    extras.push({ url, read: e.read === true, write: e.write === true, source: e.source === 'nip65' ? 'nip65' : 'manual' });
    if (extras.length >= MAX_EXTRA_RELAYS) break;
  }
  return { v: 1, extras };
}

export type AddRelayResult = { ok: true; settings: RelaySettings; url: string } | { ok: false; reason: 'invalid' | 'essential' | 'duplicate' | 'full' };

/** Add a relay: normalized, `wss://` only, never an essential one twice, at most `MAX_EXTRA_RELAYS`. Read-only to begin with. */
export function addExtraRelay(settings: RelaySettings, input: string, source: ExtraRelaySource = 'manual'): AddRelayResult {
  const trimmed = input.trim();
  const url = normalizeRelayUrl(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `wss://${trimmed}`);
  if (!url) return { ok: false, reason: 'invalid' };
  if (isDefaultRelay(url)) return { ok: false, reason: 'essential' };
  if (settings.extras.some((e) => e.url === url)) return { ok: false, reason: 'duplicate' };
  if (settings.extras.length >= MAX_EXTRA_RELAYS) return { ok: false, reason: 'full' };
  return { ok: true, url, settings: { v: 1, extras: [...settings.extras, { url, read: true, write: false, source }] } };
}

export function removeExtraRelay(settings: RelaySettings, url: string): RelaySettings {
  return { v: 1, extras: settings.extras.filter((e) => e.url !== url) };
}

export function setExtraAccess(settings: RelaySettings, url: string, access: { read?: boolean; write?: boolean }): RelaySettings {
  return { v: 1, extras: settings.extras.map((e) => (e.url === url ? { ...e, ...access } : e)) };
}

// ─── This device's store ───

const listeners = new Set<() => void>();
let cached: { raw: string | null; value: RelaySettings } | null = null;

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readRelaySettings(): RelaySettings {
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(RELAY_SETTINGS_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (cached && cached.raw === raw) return cached.value;
  cached = { raw, value: raw === null ? DEFAULT_RELAY_SETTINGS : parseRelaySettings(raw) };
  return cached.value;
}

export function writeRelaySettings(settings: RelaySettings): void {
  const value = parseRelaySettings(settings);
  try {
    if (value.extras.length === 0) storage()?.removeItem(RELAY_SETTINGS_KEY);
    else storage()?.setItem(RELAY_SETTINGS_KEY, JSON.stringify(value));
  } catch {
    /* the change still applies until the page is closed */
  }
  cached = { raw: value.extras.length === 0 ? null : JSON.stringify(value), value };
  for (const listener of listeners) listener();
}

export function subscribeRelaySettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The extra relays as the pool routes them. */
export function extrasForPool(settings: RelaySettings): { url: string; read: boolean; write: boolean }[] {
  return settings.extras.map(({ url, read, write }) => ({ url, read, write }));
}

// ─── NIP-65 (read only) ───

export interface Nip65Relay {
  url: string;
  read: boolean;
  write: boolean;
}

/** The relays of a kind 10002 relay list: `["r", url]` is both, `["r", url, "read"|"write"]` one. */
export function parseRelayList(event: { kind: number; tags: string[][] } | null | undefined): Nip65Relay[] {
  if (!event || event.kind !== 10002) return [];
  const out: Nip65Relay[] = [];
  for (const tag of event.tags) {
    if (tag[0] !== 'r') continue;
    const url = normalizeRelayUrl(tag[1]);
    if (!url || out.some((r) => r.url === url)) continue;
    const marker = tag[2];
    out.push({ url, read: marker !== 'write', write: marker !== 'read' });
  }
  return out;
}
