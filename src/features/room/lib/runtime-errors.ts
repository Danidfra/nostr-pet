/**
 * Development only: what went wrong on this page, kept for the dev tools to
 * show and copy, because a phone has no console. Uncaught errors, unhandled
 * promise rejections and the room's own render errors (its error boundary)
 * land here, newest first, a bounded list. Nothing is swallowed: the
 * browser still reports every one of them; this only remembers them.
 */
export interface RuntimeError {
  at: string;
  kind: 'error' | 'rejection' | 'render';
  message: string;
  stack?: string;
}

const MAX = 20;
let errors: RuntimeError[] = [];
const listeners = new Set<() => void>();
let listening = false;

function notify() {
  for (const l of listeners) l();
}

function describe(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error) return { message: `${reason.name}: ${reason.message}`, stack: reason.stack };
  return { message: String(reason) };
}

export function recordRuntimeError(kind: RuntimeError['kind'], reason: unknown, stack?: string): void {
  const d = describe(reason);
  errors = [{ at: new Date().toISOString(), kind, message: d.message, stack: stack ?? d.stack }, ...errors].slice(0, MAX);
  notify();
}

export function clearRuntimeErrors(): void {
  errors = [];
  notify();
}

export function runtimeErrors(): readonly RuntimeError[] {
  return errors;
}

export function subscribeRuntimeErrors(listener: () => void): () => void {
  listeners.add(listener);
  if (!listening && typeof window !== 'undefined') {
    listening = true;
    window.addEventListener('error', (event) => recordRuntimeError('error', event.error ?? event.message));
    window.addEventListener('unhandledrejection', (event) => recordRuntimeError('rejection', event.reason));
  }
  return () => {
    listeners.delete(listener);
  };
}

/** The errors as one text, for a report. */
export function formatRuntimeErrors(list: readonly RuntimeError[] = errors): string {
  if (list.length === 0) return 'No runtime errors on this page.';
  return list.map((e) => `[${e.at}] ${e.kind}: ${e.message}${e.stack ? `\n${e.stack}` : ''}`).join('\n\n');
}
