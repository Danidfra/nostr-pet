import { CloudOff, RefreshCw, WifiOff } from 'lucide-react';
import type { HealthLevel } from '@/lib/relay-health';

interface ConnectionChipProps {
  level: HealthLevel;
  online: boolean;
  /** Forget past failures and read again. */
  onRetry: () => void;
  busy?: boolean;
}

/**
 * The one place the home says it may not be in sync. Nothing while
 * healthy; a compact pill when degraded (some application relays are
 * failing, what is up still serves) or offline (the browser is offline,
 * or every application relay is failing), with a retry that re-reads and
 * lets the sockets reconnect. Never in the way of play.
 */
export function ConnectionChip({ level, online, onRetry, busy = false }: ConnectionChipProps) {
  if (level === 'healthy') return null;
  const offline = level === 'offline';
  const label = !online ? 'Offline' : offline ? 'Relays unreachable' : 'Some relays down';
  const title = !online ? 'Your device is offline. Care will not reach the relays until it is back.' : offline ? 'No application relay is answering. What you see may be out of date.' : 'Some application relays are not answering. Reads and writes go through the rest.';
  return (
    <span className={`conn-chip conn-chip--${level}`} role="status" aria-live="polite" title={title} data-testid="connection-chip" data-level={level}>
      {!online ? <WifiOff className="h-3.5 w-3.5" aria-hidden /> : <CloudOff className="h-3.5 w-3.5" aria-hidden />}
      <span className="conn-chip__label">{label}</span>
      <button type="button" className="conn-chip__retry" onClick={onRetry} disabled={busy} aria-label="Try the relays again" data-testid="connection-retry">
        <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden />
      </button>
    </span>
  );
}
