/**
 * A signal that aborts after `ms` or when `parent` aborts, whichever first.
 * `AbortSignal.any` is not everywhere yet (jsdom lacks it), so it is composed
 * by hand.
 */
export function timeoutSignal(ms: number, parent?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), ms);
  const onParent = () => {
    clearTimeout(timer);
    controller.abort(parent?.reason);
  };
  if (parent) {
    if (parent.aborted) onParent();
    else parent.addEventListener('abort', onParent, { once: true });
  }
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  return controller.signal;
}
