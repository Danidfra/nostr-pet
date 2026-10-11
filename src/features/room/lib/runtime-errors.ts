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

/**
 * What else a report should say about this page: the browser, the size,
 * and whether something outside React is rewriting its DOM. A page
 * translator (Chrome's) moves text nodes into `<font>` elements and marks
 * the document `translated-ltr`/`translated-rtl`; a DOM React no longer
 * owns is the usual cause of `NotFoundError` from `insertBefore`.
 */
export function pageDiagnostics(doc: Document | null = typeof document === 'undefined' ? null : document): string {
  if (!doc) return 'page: no document';
  const html = doc.documentElement;
  const fonts = doc.querySelectorAll('font').length;
  const translated = /translated-(ltr|rtl)/.test(html.className) || fonts > 0;
  const nav = typeof navigator === 'undefined' ? null : navigator;
  const win = typeof window === 'undefined' ? null : window;
  return [
    `page: lang=${html.lang || '?'}${html.className ? ` class="${html.className}"` : ''}`,
    `translated or rewritten by something outside React: ${translated ? 'YES' : 'no'} (${fonts} <font> elements)`,
    nav ? `browser: ${nav.userAgent}` : '',
    win ? `viewport: ${win.innerWidth}x${win.innerHeight} @${win.devicePixelRatio}x, hidden: ${doc.hidden}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** The errors as one text, for a report, with what the page looks like underneath. */
export function formatRuntimeErrors(list: readonly RuntimeError[] = errors): string {
  const head = pageDiagnostics();
  if (list.length === 0) return `No runtime errors on this page.\n${head}`;
  return `${head}\n\n${list.map((e) => `[${e.at}] ${e.kind}: ${e.message}${e.stack ? `\n${e.stack}` : ''}`).join('\n\n')}`;
}
