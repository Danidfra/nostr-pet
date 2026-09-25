import type { ReactNode } from 'react';

interface GameShellProps {
  top: ReactNode;
  scene: ReactNode;
  bottom?: ReactNode;
  /** Game overlays, rendered last inside the column so they stack over it and stay anchored to it. */
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
          {/* Overlays are layers of the game, so they live inside the game column:
              on a phone that is the viewport, on a desktop it is the rounded
              game surface they rise inside of. */}
          {overlays}
        </div>
      </div>
    </div>
  );
}
