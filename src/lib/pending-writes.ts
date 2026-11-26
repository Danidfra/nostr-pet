/**
 * Writes on their way to the relays, counted, so that leaving the page on
 * purpose (switching the language reloads it) waits for them instead of
 * cutting one off between signing and sending. Every write path registers
 * here: the publish adapter (state, items, adoption, a guest's save), the
 * kind 0 write, and the protected profile writes.
 *
 * Unsaved work on screen is held here too (`holdUnsaved`: a room being
 * decorated): a reload would discard it, so the language waits for the
 * player to save or cancel it.
 */
let pending = 0;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Count `work` as a pending write until it settles; returns it unchanged. */
export function trackWrite<T>(work: Promise<T>): Promise<T> {
  pending++;
  notify();
  const done = () => {
    pending--;
    notify();
  };
  work.then(done, done);
  return work;
}

export function pendingWrites(): number {
  return pending;
}

export function subscribePendingWrites(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Resolves once no write is pending (at once when none is). */
export function whenWritesSettle(): Promise<void> {
  if (pending === 0) return Promise.resolve();
  return new Promise((resolve) => {
    const off = subscribePendingWrites(() => {
      if (pending === 0) {
        off();
        resolve();
      }
    });
  });
}

const unsaved = new Set<string>();

/** Some work on screen would be lost by a reload until the returned release is called. */
export function holdUnsaved(id: string): () => void {
  unsaved.add(id);
  notify();
  return () => {
    if (unsaved.delete(id)) notify();
  };
}

export function hasUnsaved(): boolean {
  return unsaved.size > 0;
}
