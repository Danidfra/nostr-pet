/**
 * A WebSocket that never connects: each one errors and closes shortly after
 * it is made. Stubbed as the global `WebSocket`, it lets the real NRelay1
 * (websocket-ts underneath) retry on fake timers, so its reconnection
 * schedule can be measured without a network.
 */
export function failingSocketClass(sockets: { url: string; closedAt: number | null }[], now: () => number = () => Date.now()) {
  return class FailingSocket extends EventTarget {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readyState = 0;
    binaryType = 'blob';
    private readonly record: { url: string; closedAt: number | null };
    constructor(readonly url: string) {
      super();
      this.record = { url, closedAt: null };
      sockets.push(this.record);
      setTimeout(() => {
        this.readyState = 3;
        this.record.closedAt = now();
        this.dispatchEvent(new Event('error'));
        this.dispatchEvent(new CloseEvent('close', { code: 1006 }));
      }, 10);
    }
    send() {}
    close() {
      this.readyState = 3;
      this.record.closedAt ??= now();
    }
  };
}
