/**
 * CARRYING A CHOICE OUT TO THE OTHER BLOBBI APPS, in the background.
 *
 * One controller for the page, per account: whichever screen the choice was
 * made on, one write at a time (`writeCompanionProfile`), the newest choice
 * last. What it reports (`SyncStatus`) is what the player may be told, in
 * plain words, by `CompanionSyncNotice`.
 *
 * WHEN IT WRITES. Only for a choice the PLAYER made (`by: 'player'`), and only
 * when asked: right after the choice (`select`), when the player taps Try
 * again, and, in the same visit, after a failure, when the connection comes
 * back or a little later (at most `AUTO_RETRIES` times). Never because a page
 * loaded or reloaded, a choice was adopted from another app, or the same
 * Blobbi was chosen again: a reload leaves an unshared choice waiting for the
 * player's Try again.
 *
 * WHO. The account the choice belongs to, signed by that account's own
 * signer; if the signed-in account changes while a write is out, it stops
 * before anything is sent (`stillAccount`), and the new account never sees
 * the old one's choice (the record is per account).
 */
import type { NostrEvent } from '@blobbi-kit/core';
import { companionChoices, needsSync, type CompanionChoice } from './choice-store';
import { writeCompanionProfile, type ProfileRelays, type ProfileWriteOutcome, type UnsignedProfile } from './profile-write';

export type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'saved' }
  /** The player has no profile for the choice to live in: it stays on this device (nothing to fix). */
  | { kind: 'device-only' }
  /** Not shared yet; `retry` may fix it. */
  | { kind: 'waiting'; reason: 'offline' | 'unsafe' | 'partial' | 'failed' | 'sign-failed' | 'not-sent' };

export interface SyncEnv {
  /** The account signed in right now (the write checks it again before anything is sent). */
  account: () => string | undefined;
  relays: ProfileRelays;
  sign: (template: UnsignedProfile) => Promise<NostrEvent>;
  online?: () => boolean;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  /** Read the player's profile again (after a write, or when another app's choice was met). */
  refreshProfile?: () => void;
  /** The profile this write put out (so the screen agrees at once, before any relay is asked again). */
  onPublished?: (event: NostrEvent) => void;
}

export const AUTO_RETRIES = 3;
/** How long a relay gets per request, and the pause before a second read-back (tests shorten them). */
export const syncTiming = { timeoutMs: 8_000, readBackPauseMs: 1_500 };
const RETRY_DELAYS_MS = [15_000, 60_000, 180_000];

interface AccountSync {
  status: SyncStatus;
  running: Promise<void> | null;
  again: boolean;
  /** Automatic retries left in this visit (set by a choice or a Try again). */
  autoLeft: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const states = new Map<string, AccountSync>();
const envs = new Map<string, SyncEnv>();
const listeners = new Set<() => void>();
const IDLE: SyncStatus = { kind: 'idle' };

function stateOf(account: string): AccountSync {
  let s = states.get(account);
  if (!s) {
    s = { status: IDLE, running: null, again: false, autoLeft: 0, timer: null };
    states.set(account, s);
  }
  return s;
}

function setStatus(account: string, status: SyncStatus): void {
  stateOf(account).status = status;
  for (const l of [...listeners]) l();
}

const defaultOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

let onlineHooked = false;
function hookOnline(): void {
  if (onlineHooked || typeof window === 'undefined') return;
  onlineHooked = true;
  window.addEventListener('online', () => {
    for (const [account, s] of states) if (s.autoLeft > 0 && s.status.kind === 'waiting') void runSync(account);
  });
}

/** What happened to a write, applied to the stored choice (only if the choice is still the one written). */
function apply(account: string, d: string, outcome: ProfileWriteOutcome): SyncStatus {
  const choice = companionChoices.get(account);
  if (!choice || choice.d !== d) return IDLE;
  const keep = (change: Partial<CompanionChoice>) => companionChoices.set({ ...choice, ...change });
  switch (outcome.kind) {
    case 'saved':
      keep({ synced: { id: outcome.event.id, createdAt: outcome.event.created_at }, pending: null, note: null });
      return { kind: 'saved' };
    case 'unchanged':
      keep({ synced: outcome.profile, pending: null, note: null });
      return { kind: 'saved' };
    case 'superseded':
      // A newer choice elsewhere: this one's write is over; ordered as the network orders it (the newer one wins)
      keep({ synced: choice.pending ? { id: choice.pending.event.id, createdAt: choice.pending.event.created_at } : { id: '0'.repeat(64), createdAt: 0 }, pending: null });
      return IDLE;
    case 'no-profile':
      keep({ note: 'no-profile' });
      return { kind: 'device-only' };
    case 'ambiguous':
      // Too close to another app's choice to tell: the screen asks the player (no write until they answer)
      return IDLE;
    case 'wrong-account':
      return IDLE;
    case 'offline':
    case 'unsafe':
    case 'partial':
    case 'failed':
    case 'sign-failed':
      return { kind: 'waiting', reason: outcome.kind };
  }
}

function scheduleRetry(account: string): void {
  const s = stateOf(account);
  if (s.timer || s.autoLeft <= 0 || s.status.kind !== 'waiting' || s.status.reason === 'sign-failed') return;
  const delay = RETRY_DELAYS_MS[AUTO_RETRIES - s.autoLeft] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  s.timer = setTimeout(() => {
    s.timer = null;
    void runSync(account);
  }, delay);
}

/** Write the account's stored choice out, if it needs it. One at a time; a newer choice runs after. */
export async function runSync(account: string): Promise<void> {
  const s = stateOf(account);
  if (s.running) {
    s.again = true;
    return s.running;
  }
  const env = envs.get(account);
  const choice = companionChoices.get(account);
  if (!env || env.account() !== account || !needsSync(choice)) return;
  if (s.timer) clearTimeout(s.timer);
  s.timer = null;
  if (s.autoLeft > 0) s.autoLeft--;
  hookOnline();
  setStatus(account, { kind: 'syncing' });
  const d = choice!.d;
  s.running = (async () => {
    let outcome: ProfileWriteOutcome;
    try {
      outcome = await writeCompanionProfile(
        { owner: account, d, at: choice!.at ?? 0, over: choice!.over ?? null, pending: choice!.pending },
        {
          relays: env.relays,
          sign: env.sign,
          onSigned: (pending) => {
            const now = companionChoices.get(account);
            if (now && now.d === d && now.by === 'player') companionChoices.set({ ...now, pending });
          },
          stillAccount: () => env.account() === account && companionChoices.get(account)?.d === d,
          online: env.online ?? defaultOnline,
          now: env.now ?? Date.now,
          sleep: env.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, Math.min(ms, syncTiming.readBackPauseMs)))),
          timeoutMs: env.timeoutMs ?? syncTiming.timeoutMs,
        },
      );
    } catch {
      outcome = { kind: 'failed', event: null };
    }
    setStatus(account, apply(account, d, outcome));
    if (outcome.kind === 'saved') env.onPublished?.(outcome.event);
    if (outcome.kind === 'saved' || outcome.kind === 'unchanged' || outcome.kind === 'superseded' || outcome.kind === 'ambiguous') env.refreshProfile?.();
  })();
  try {
    await s.running;
  } finally {
    s.running = null;
  }
  if (s.again) {
    s.again = false;
    return runSync(account);
  }
  scheduleRetry(account);
}

export const companionSync = {
  /** The page's current way to reach relays and sign, for this account (kept up to date by the hook). */
  setEnv(account: string, env: SyncEnv): void {
    envs.set(account, env);
  },
  status(account: string | undefined): SyncStatus {
    return account ? stateOf(account).status : IDLE;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** The player chose (or re-chose, after a question) a Blobbi: write it out, with retries in this visit. */
  start(account: string): Promise<void> {
    stateOf(account).autoLeft = AUTO_RETRIES;
    return runSync(account);
  },
  /** Try again, asked by the player. */
  retry(account: string): Promise<void> {
    return companionSync.start(account);
  },
  /** Tests. */
  reset(): void {
    for (const s of states.values()) if (s.timer) clearTimeout(s.timer);
    states.clear();
    envs.clear();
    for (const l of [...listeners]) l();
  },
};
