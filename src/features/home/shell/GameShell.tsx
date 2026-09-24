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
 * viewport gives between the two HUD strips, and both strips respect the
 * device safe areas. On wide screens the same frame sits centred with a
 * comfortable width so the home stays a room, not a banner.
 */
export function GameShell({ top, scene, bottom, overlays }: GameShellProps) {
  return (
    <div className="game-shell" data-testid="game-shell">
      <div className="game-frame">
        {top}
        <div className="game-scene">{scene}</div>
        {bottom}
      </div>
      {overlays}
    </div>
  );
}
