import { describe, expect, it, vi } from 'vitest';
import { createRelayHealthStore, resolveHealthLevel } from './relay-health';

const A = 'wss://a.test';
const B = 'wss://b.test';

describe('relay health', () => {
  it('is healthy until an application relay fails; a hinted relay never counts', () => {
    const store = createRelayHealthStore([A, B]);
    expect(store.snapshot().level).toBe('healthy');
    store.log({ ns: 'relay.ws.retry', url: 'wss://hint.test' });
    expect(store.snapshot().level).toBe('healthy');
    store.log({ ns: 'relay.ws.state', state: 'open', url: A });
    store.log({ ns: 'relay.ws.state', state: 'close', url: A }); // idle close: normal
    expect(store.snapshot()).toMatchObject({ level: 'healthy', relays: { [A]: 'ok', [B]: 'unknown' } });
  });

  it('degrades when some application relays fail and goes offline when all do or the browser says so', () => {
    const store = createRelayHealthStore([A, B]);
    const seen: string[] = [];
    store.subscribe(() => seen.push(store.snapshot().level));
    store.log({ ns: 'relay.ws.retry', url: A, backoff: 1000 });
    expect(store.snapshot().level).toBe('degraded');
    store.log({ ns: 'relay.ws.error', url: B });
    expect(store.snapshot().level).toBe('offline');
    store.log({ ns: 'relay.ws.state', state: 'open', url: B });
    expect(store.snapshot().level).toBe('degraded');
    store.log({ ns: 'relay.ws.state', state: 'open', url: A });
    expect(store.snapshot().level).toBe('healthy');
    store.setOnline(false);
    expect(store.snapshot().level).toBe('offline');
    store.setOnline(true);
    expect(store.snapshot().level).toBe('healthy');
    expect(seen).toEqual(['degraded', 'offline', 'degraded', 'healthy', 'offline', 'healthy']);
  });

  it('a retry forgets past failures, and repeated identical entries do not wake listeners', () => {
    const store = createRelayHealthStore([A]);
    const listener = vi.fn();
    store.subscribe(listener);
    store.log({ ns: 'relay.ws.retry', url: A });
    store.log({ ns: 'relay.ws.retry', url: A });
    expect(listener).toHaveBeenCalledTimes(1);
    store.reset();
    expect(store.snapshot()).toMatchObject({ level: 'healthy', relays: { [A]: 'unknown' } });
  });

  it('resolves the level from the marks alone', () => {
    expect(resolveHealthLevel(true, {})).toBe('healthy');
    expect(resolveHealthLevel(true, { a: 'unknown' })).toBe('healthy');
    expect(resolveHealthLevel(true, { a: 'failing', b: 'ok' })).toBe('degraded');
    expect(resolveHealthLevel(true, { a: 'failing', b: 'unknown' })).toBe('degraded');
    expect(resolveHealthLevel(true, { a: 'failing' })).toBe('offline');
    expect(resolveHealthLevel(false, { a: 'ok' })).toBe('offline');
  });
});
