import type { ReactNode } from 'react';

interface GameShellProps {
  top: ReactNode;
  scene: ReactNode;
  bottom?: ReactNode;
  /** A rail beside the room on wide screens (the caller renders it only when there is room). */
  aside?: ReactNode;
  /** Sheets and overlays, rendered last so they stack over everything. */
  overlays?: ReactNode;
}

/**
 * The game frame: one screen, no page scroll. The scene fills whatever the
 * viewport gives between the top HUD and the dock, and both respect the
 * device safe areas. On wide screens the frame sits centred at a
 * comfortable width with a rail beside the room, so the extra space carries
 * information instead of stretching the phone layout.
 */
export function GameShell({ top, scene, bottom, aside, overlays }: GameShellProps) {
  return (
    <div className="game-shell" data-testid="game-shell" data-rail={aside ? 'true' : 'false'}>
      <div className="game-frame">
        <div className="game-column">
          {top}
          <div className="game-scene">{scene}</div>
          {bottom}
        </div>
        {aside && <aside className="game-rail">{aside}</aside>}
      </div>
      {overlays}
    </div>
  );
}
