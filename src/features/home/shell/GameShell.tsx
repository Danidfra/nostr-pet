import type { ReactNode } from 'react';

interface GameShellProps {
  top: ReactNode;
  scene: ReactNode;
  bottom?: ReactNode;
  /** Sheets and overlays, rendered last so they stack over everything. */
  overlays?: ReactNode;
}

/**
 * The game frame: one screen, no page scroll. The scene fills whatever the
 * viewport gives between the top HUD and the dock, and both respect the
 * device safe areas. On wide screens the frame sits centred at a
 * comfortable width, so the home stays a room and not a banner.
 */
export function GameShell({ top, scene, bottom, overlays }: GameShellProps) {
  return (
    <div className="game-shell" data-testid="game-shell">
      <div className="game-frame">
        <div className="game-column">
          {top}
          <div className="game-scene">{scene}</div>
          {bottom}
        </div>
      </div>
      {overlays}
    </div>
  );
}
