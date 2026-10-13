import { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, WifiOff } from 'lucide-react';
import type { HealthLevel } from '@/lib/relay-health';

interface ConnectionChipProps {
  level: HealthLevel;
  online: boolean;
  /** Forget past failures and read again. */
  onRetry: () => void;
  busy?: boolean;
  /** Test seam: how long an outage must last before the chip says so (`OFFLINE_HOLD_MS`). */
  holdMs?: number;
}

/**
 * How long every application relay must be failing (or the browser
 * offline) before the home says so: a socket dropped by a backgrounded tab
 * reconnects on its own within a few seconds, and that is not news.
 */
export const OFFLINE_HOLD_MS = 4_000;

/**
 * The one place the home says it may not be in sync, and as little as it
 * can (M14.1, after a real phone kept showing a cloud): nothing while
 * healthy; a small amber dot while DEGRADED (some application relays are
 * failing, what is up still serves: reads and writes go through, so no word
 * and no button, only a title for whoever hovers or a reader); the pill
 * with Try again only when OFFLINE (the browser says so, or every
 * application relay is failing) and it has stayed so for a moment. A write
 * that fails says so where it was asked, whatever this shows.
 */
export function ConnectionChip({ level, online, onRetry, busy = false, holdMs = OFFLINE_HOLD_MS }: ConnectionChipProps) {
  const offline = level === 'offline' || !online;
  // An outage is said once it has lasted; a blink of one is not
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!offline) {
      setHeld(false);
      return;
    }
    const timer = setTimeout(() => setHeld(true), holdMs);
    return () => clearTimeout(timer);
  }, [offline, holdMs]);

  if (level === 'healthy' && online) return null;
  if (!offline || !held) {
    if (level === 'healthy') return null;
    const title = offline ? 'Reconnecting to the relays…' : 'Some application relays are not answering. Reads and writes go through the rest.';
    return <span className="conn-dot" role="status" aria-label={offline ? 'Reconnecting to the relays' : 'Some relays are not answering'} title={title} data-testid="connection-dot" data-level={offline ? 'offline' : level} />;
  }
  const label = !online ? 'Offline' : 'Relays unreachable';
  const title = !online ? 'Your device is offline. Care will not reach the relays until it is back.' : 'No application relay is answering. What you see may be out of date.';
  return (
    <span className="conn-chip conn-chip--offline" role="status" aria-live="polite" title={title} data-testid="connection-chip" data-level="offline">
      {!online ? <WifiOff className="h-3.5 w-3.5" aria-hidden /> : <CloudOff className="h-3.5 w-3.5" aria-hidden />}
      <span className="conn-chip__label">{label}</span>
      <button type="button" className="conn-chip__retry" onClick={onRetry} disabled={busy} aria-label="Try the relays again" data-testid="connection-retry">
        <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden />
      </button>
    </span>
  );
}
