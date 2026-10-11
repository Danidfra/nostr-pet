/**
 * What shows while the room's code loads (the router's fallback): the game
 * frame, a soft pulse and a word, never a blank screen. In the main bundle,
 * so it imports nothing of the room's (no three.js).
 */
export function RoomLoading({ text = 'Opening your room…' }: { text?: string }) {
  return (
    <div className="game-shell" data-testid="room-loading">
      <div className="game-frame">
        <div className="game-column">
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6" role="status" aria-live="polite">
            <span className="room-loading-dot" aria-hidden />
            <p className="scene-text text-sm text-foreground/80">{text}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
