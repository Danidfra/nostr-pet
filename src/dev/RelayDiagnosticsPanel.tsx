/**
 * Development builds only: what the relay pool is doing right now
 * (`relay-diagnostics.ts`), as a small floating panel over the real home.
 * Open it with `?relays` in the address of a dev build (`npm run dev`). It
 * shows URLs, kinds, counts, durations and verdicts, never content, tags,
 * authors or keys. The store keeps a bounded history; Reset empties it.
 */
import { useState, useSyncExternalStore } from 'react';
import { useRelayDiagnostics } from '@/hooks/useRelayDiagnostics';
import { openSubscriptions, type DiagnosticsSnapshot, type RelayDiagnostics } from '@/lib/relay-diagnostics';

const EMPTY: DiagnosticsSnapshot = { sockets: [], relaysOpened: [], relaysClosed: [], subscriptions: [], queries: [], publications: [], totals: { subscriptionsOpened: 0, subscriptionsClosed: 0, queries: 0, publications: 0, retries: 0, duplicates: 0 } };
const noop = () => () => {};

function useSnapshot(store: RelayDiagnostics | null): DiagnosticsSnapshot {
  // A fresh object per call would re-render forever: cache it until the store says it changed
  const [cache] = useState(() => ({ value: EMPTY, stale: true }));
  return useSyncExternalStore(
    store
      ? (listener) =>
          store.subscribe(() => {
            cache.stale = true;
            listener();
          })
      : noop,
    () => {
      if (store && cache.stale) {
        cache.value = store.snapshot();
        cache.stale = false;
      }
      return cache.value;
    },
  );
}

const host = (url: string) => url.replace(/^wss:\/\//, '');
const ms = (n: number) => `${Math.round(n)} ms`;

export default function RelayDiagnosticsPanel() {
  const store = useRelayDiagnostics();
  const snapshot = useSnapshot(store);
  const [open, setOpen] = useState(true);
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

  if (!store) return null;
  const live = openSubscriptions(snapshot);
  const queries = snapshot.queries.slice(-12).reverse();
  const publications = snapshot.publications.slice(-10).reverse();

  return (
    <aside className="fixed bottom-2 left-2 z-[2000] max-h-[70vh] w-[min(26rem,calc(100vw-1rem))] overflow-auto rounded-lg bg-black/85 p-2 font-mono text-[11px] leading-tight text-white shadow-lg" data-testid="relay-diagnostics" aria-label="Relay diagnostics">
      <div className="mb-1 flex items-center justify-between gap-2">
        <button type="button" className="font-bold underline" onClick={() => setOpen(!open)} aria-expanded={open}>
          Relays · {snapshot.sockets.filter((s) => s.state === 'open').length} open · {live.length} subs · {snapshot.totals.retries} retries
        </button>
        <button type="button" className="rounded bg-white/20 px-2" onClick={() => store.reset()}>
          Reset
        </button>
      </div>
      {open && (
        <>
          <p className="opacity-70">
            subscriptions {snapshot.totals.subscriptionsOpened} opened / {snapshot.totals.subscriptionsClosed} closed · queries {snapshot.totals.queries} · duplicates {snapshot.totals.duplicates} · publications {snapshot.totals.publications} · relay objects {snapshot.relaysOpened.length}
          </p>
          <h3 className="mt-2 font-bold">Sockets</h3>
          <table className="w-full">
            <tbody>
              {snapshot.sockets.map((s) => (
                <tr key={s.relay}>
                  <td>{host(s.relay)}</td>
                  <td>{s.state}</td>
                  <td>opens {s.opens}</td>
                  <td>retries {s.retries}</td>
                  <td>{s.lastBackoffMs !== null ? `next ${ms(s.lastBackoffMs)}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="mt-2 font-bold">Open subscriptions</h3>
          {live.length === 0 ? (
            <p className="opacity-70">none</p>
          ) : (
            <ul>
              {live.map((s) => (
                <li key={s.id}>
                  {host(s.relay)} [{s.kinds.join(',')}] {ms(now - s.openedAt)} {s.eoseAt !== null ? 'EOSE' : 'waiting'} · {s.events} ev
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-2 font-bold">Recent queries</h3>
          <ul>
            {queries.map((q) => (
              <li key={q.id}>
                {q.path} [{q.kinds.join(',')}] {q.finishedAt !== null ? ms(q.finishedAt - q.startedAt) : 'running'} {q.outcome ?? ''} · {q.unique}/{q.received} ev · EOSE {q.eose.map(host).join(' ') || '-'}
                {q.failed.length > 0 ? ` · failed ${q.failed.map(host).join(' ')}` : ''}
              </li>
            ))}
          </ul>
          <h3 className="mt-2 font-bold">Recent publications</h3>
          <ul>
            {publications.map((p, i) => (
              <li key={`${p.eventId}-${p.relay}-${i}`}>
                kind {p.kind} {p.eventId.slice(0, 8)} → {host(p.relay)}: {p.verdict}
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
