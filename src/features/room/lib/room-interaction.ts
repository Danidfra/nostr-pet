/**
 * One interaction at a time, as a small script that can be stopped.
 *
 * An interaction (feeding, playing with a ball, a bedtime walk) is a run of
 * moments: the Blobbi notices something, walks to it, a write goes out,
 * it eats or plays, it is pleased, it goes back to its own life. Each
 * moment borrows something (its face, its eyes, a prop in the room, a
 * walk) and gives it back; the whole run can be cancelled at any moment by
 * what happens around it (a change of room, a teleport, another item, a
 * hand on the Blobbi, the page put away), and then everything borrowed is
 * given back at once, nothing is left half way, and nothing is written that
 * was not already on its way.
 *
 * This is the runner, with no knowledge of rooms, faces or relays: a
 * script is an async function over a `Run`, whose waits and promises end
 * early (throwing `Interrupted`) when the run is cancelled; `cleanup`
 * callbacks registered along the way are called in reverse on every end.
 * A moment that must not be cut (a write already signed) is marked
 * `protect`: a cancel asked meanwhile is held until it is over, so the
 * script can finish what it owes and still skip what it would have shown.
 */

export type CancelReason = 'replaced' | 'room' | 'teleport' | 'stopped' | 'hidden' | 'disabled' | 'unmount' | 'failed';

export class Interrupted extends Error {
  constructor(public readonly reason: CancelReason) {
    super(`interaction ${reason}`);
    this.name = 'Interrupted';
  }
}

export interface Run {
  /** Whether a cancel is pending or done. */
  readonly cancelled: boolean;
  /** Why, once cancelled. */
  readonly reason: CancelReason | null;
  /** Wait `ms`; ends early (throws `Interrupted`) on cancel. In a hidden tab the wait is not kept: it ends at once. */
  wait(ms: number): Promise<void>;
  /** Wait for a promise; ends early (throws `Interrupted`) on cancel, the promise's own result forgotten. */
  until<T>(promise: Promise<T>): Promise<T>;
  /** Throw `Interrupted` now if cancelled: for a long synchronous stretch. */
  check(): void;
  /** Register something to give back when the run ends, however it ends. Called in reverse order. */
  cleanup(fn: () => void): void;
  /**
   * Run `fn` with cancellation held off: a cancel asked meanwhile takes effect right after. For a moment that
   * must finish (a write on its way).
   */
  protect<T>(fn: () => Promise<T>): Promise<T>;
}

export interface Interaction {
  readonly id: number;
  readonly name: string;
  /** Settles when the run has ended: `done` (ran to its end), or the cancel reason. */
  readonly ended: Promise<'done' | CancelReason>;
  cancel(reason: CancelReason): void;
}

export interface Director {
  /** The run under way, or null. */
  current(): Interaction | null;
  /** Start a script; whatever ran before is cancelled (`replaced`) first. */
  start(name: string, script: (run: Run) => Promise<void>): Interaction;
  /** Cancel the run under way, if any. */
  cancel(reason: CancelReason): void;
  /** Hear each start and end (for a UI that shows what the Blobbi is doing). */
  subscribe(listener: (current: Interaction | null) => void): () => void;
}

export interface DirectorOptions {
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** Whether the page is hidden (a wait is then not kept). */
  hidden?: () => boolean;
  /** Where an error thrown by a script (not an interruption) is reported. */
  onError?: (error: unknown, name: string) => void;
}

export function createDirector({ setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (h) => clearTimeout(h as ReturnType<typeof setTimeout>), hidden = () => typeof document !== 'undefined' && document.hidden, onError }: DirectorOptions = {}): Director {
  let current: Interaction | null = null;
  let nextId = 1;
  const listeners = new Set<(current: Interaction | null) => void>();
  const notify = () => {
    for (const l of [...listeners]) l(current);
  };

  const start: Director['start'] = (name, script) => {
    current?.cancel('replaced');
    const id = nextId++;
    let reason: CancelReason | null = null;
    let protecting = 0;
    let pendingReason: CancelReason | null = null;
    const cleanups: (() => void)[] = [];
    const waiters = new Set<(reason: CancelReason) => void>();
    let settle!: (end: 'done' | CancelReason) => void;
    const ended = new Promise<'done' | CancelReason>((resolve) => {
      settle = resolve;
    });

    const giveBack = () => {
      for (const fn of cleanups.splice(0).reverse()) {
        try {
          fn();
        } catch (error) {
          onError?.(error, name);
        }
      }
    };
    const interrupt = (why: CancelReason) => {
      if (reason) return;
      reason = why;
      for (const w of [...waiters]) w(why);
      waiters.clear();
      // Everything borrowed goes back now, before whatever interrupted it goes on (a replacing run must find the
      // room clear); what the script registers while it winds down goes back when it ends
      giveBack();
    };
    const cancel = (why: CancelReason) => {
      if (reason) return;
      if (protecting > 0) {
        pendingReason ??= why;
        return;
      }
      interrupt(why);
    };

    const run: Run = {
      get cancelled() {
        return reason !== null || pendingReason !== null;
      },
      get reason() {
        return reason ?? pendingReason;
      },
      wait(ms) {
        return new Promise<void>((resolve, reject) => {
          if (reason) return reject(new Interrupted(reason));
          if (hidden() || ms <= 0) return resolve();
          const onCancel = (why: CancelReason) => {
            clearTimer(handle);
            reject(new Interrupted(why));
          };
          const handle = setTimer(() => {
            waiters.delete(onCancel);
            resolve();
          }, ms);
          waiters.add(onCancel);
        });
      },
      until(promise) {
        return new Promise((resolve, reject) => {
          if (reason) return reject(new Interrupted(reason));
          const onCancel = (why: CancelReason) => reject(new Interrupted(why));
          waiters.add(onCancel);
          promise.then(
            (value) => {
              waiters.delete(onCancel);
              if (reason) reject(new Interrupted(reason));
              else resolve(value);
            },
            (error) => {
              waiters.delete(onCancel);
              reject(reason ? new Interrupted(reason) : error);
            },
          );
        });
      },
      check() {
        if (reason) throw new Interrupted(reason);
      },
      cleanup(fn) {
        cleanups.push(fn);
      },
      async protect(fn) {
        if (reason) throw new Interrupted(reason);
        protecting += 1;
        try {
          return await fn();
        } finally {
          protecting -= 1;
          if (protecting === 0 && pendingReason) {
            const why = pendingReason;
            pendingReason = null;
            interrupt(why);
          }
        }
      },
    };

    const interaction: Interaction = { id, name, ended, cancel };
    current = interaction;
    notify();

    const finish = (end: 'done' | CancelReason) => {
      giveBack();
      if (current === interaction) {
        current = null;
        notify();
      }
      settle(end);
    };

    void (async () => {
      try {
        await script(run);
        // The script ran to its end; a cancel that came in its last moments is still a cancel
        finish(reason ?? 'done');
      } catch (error) {
        if (error instanceof Interrupted) finish(error.reason);
        else {
          onError?.(error, name);
          interrupt('failed');
          finish('failed');
        }
      }
    })();
    return interaction;
  };

  return {
    current: () => current,
    start,
    cancel: (why) => current?.cancel(why),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
