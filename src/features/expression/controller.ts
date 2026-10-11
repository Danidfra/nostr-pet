/**
 * Which face a Blobbi wears, when several moments want one at once.
 *
 * Every part of the app that has a feeling to show asks for it by source
 * ("reaction", "transition", "care", "petting", "life", "teleport"): a
 * name, a priority and, optionally, how long. The highest priority shown
 * wins; among equals the most recent. A request with a duration ends by
 * itself; one without lasts until its source clears it. A source asking
 * again replaces its own request (never stacks), so an interrupted moment
 * gives way cleanly and whatever it interrupted comes back underneath.
 *
 * Renderer-free (no React, no DOM, no kit): it decides the name; the
 * drawing turns the name into the kit's face (`faces.ts`) and eases between
 * faces itself. Timers, not animation frames, so a hidden tab still ends
 * its expressions.
 */
import type { ExpressionName } from './faces';

/** How much a moment matters, low to high. */
export const PRIORITY = {
  /** Its own idle life: glances, a stretch. */
  life: 1,
  /** A reaction: a poke, a care result, a piece of furniture touched. */
  reaction: 2,
  /** Being petted. */
  petting: 3,
  /** Care under way: eating, being washed. */
  care: 4,
  /** A choreographed scene: a room transition. */
  script: 5,
  /** A journey: leaving and arriving. */
  journey: 6,
} as const;

export interface ExpressionRequest {
  name: ExpressionName;
  priority: number;
  source: string;
  /** Clock time it was asked for. */
  since: number;
  /** Clock time it ends by itself, or null to last until cleared. */
  until: number | null;
}

export interface ExpressionController {
  /** Ask for a face. Replaces the source's own earlier request. */
  show(source: string, name: ExpressionName, options?: { priority?: number; durationMs?: number }): void;
  /** Take back the source's request. */
  clear(source: string): void;
  /** The face that wins now, or null for the Blobbi's own (baseline) face. */
  current(): ExpressionRequest | null;
  subscribe(listener: (current: ExpressionRequest | null) => void): () => void;
  dispose(): void;
}

export interface ExpressionControllerOptions {
  clock?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export function createExpressionController({ clock = () => Date.now(), setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (h) => clearTimeout(h as ReturnType<typeof setTimeout>) }: ExpressionControllerOptions = {}): ExpressionController {
  const requests = new Map<string, ExpressionRequest>();
  const timers = new Map<string, unknown>();
  const listeners = new Set<(current: ExpressionRequest | null) => void>();
  let winner: ExpressionRequest | null = null;
  let disposed = false;

  const pick = (): ExpressionRequest | null => {
    let best: ExpressionRequest | null = null;
    for (const r of requests.values()) {
      if (!best || r.priority > best.priority || (r.priority === best.priority && r.since >= best.since)) best = r;
    }
    return best;
  };
  const update = () => {
    const next = pick();
    if (next === winner) return;
    winner = next;
    for (const l of [...listeners]) l(winner);
  };
  const drop = (source: string) => {
    const t = timers.get(source);
    if (t !== undefined) clearTimer(t);
    timers.delete(source);
    requests.delete(source);
  };

  return {
    show(source, name, options = {}) {
      if (disposed) return;
      drop(source);
      const now = clock();
      const request: ExpressionRequest = { name, priority: options.priority ?? PRIORITY.reaction, source, since: now, until: options.durationMs !== undefined ? now + options.durationMs : null };
      requests.set(source, request);
      if (options.durationMs !== undefined) {
        timers.set(
          source,
          setTimer(() => {
            if (requests.get(source) !== request) return;
            timers.delete(source);
            requests.delete(source);
            update();
          }, Math.max(0, options.durationMs)),
        );
      }
      update();
    },
    clear(source) {
      if (!requests.has(source)) return;
      drop(source);
      update();
    },
    current: () => winner,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      for (const t of timers.values()) clearTimer(t);
      timers.clear();
      requests.clear();
      listeners.clear();
      winner = null;
    },
  };
}
