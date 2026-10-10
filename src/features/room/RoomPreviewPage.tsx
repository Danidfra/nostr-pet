/**
 * `/room` — the 3D room, as a preview beside the home (dev builds only; see
 * `AppRouter`). Milestone 1 of bringing Ditto's room to this app: the
 * diorama, its camera and lighting, the registry's rooms painted as paper,
 * Ditto's default furniture, the room switcher, and the player's own Blobbi
 * drawn by the canonical renderer, standing on the floor and facing the way
 * it walks. Nothing here publishes: the room choice is this screen's state,
 * the furniture is the defaults, and care stays on the home.
 */

import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useProjectedBlobbiState } from '@blobbi-kit/react';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import type { BlobbiFacing } from '@blobbi-kit/renderer';

import { useHomeBlobbi } from '@/hooks/useHomeBlobbi';
import { baselineExpression } from '@/features/home/scene/reactions';
import { DEFAULT_ROOM, resolveRoom, type RoomId } from '@/features/home/rooms/rooms';
import { RoomShell } from './components/RoomShell';
import { RoomBlobbi } from './components/RoomBlobbi';
import { MAIN_BLOBBI } from './lib/room-geometry';
import { roomLayoutFor } from './lib/room-layout';
import { roomFurnitureFor } from './lib/room-furniture';

const STAGE_WORD: Record<BlobbiCompanion['stage'], string> = { egg: 'Egg', baby: 'Baby', adult: 'Adult' };

export default function RoomPreviewPage() {
  const home = useHomeBlobbi();
  return (
    <div className="game-shell" data-testid="room-preview">
      <div className="game-frame">
        <div className="game-column">
          {home.status === 'ready' && home.current ? (
            <BlobbiRoom key={home.current.d} blobbi={home.current} />
          ) : (
            <RoomMessage status={home.status} />
          )}
        </div>
      </div>
    </div>
  );
}

function RoomMessage({ status }: { status: ReturnType<typeof useHomeBlobbi>['status'] }) {
  const text =
    status === 'signed-out' ? 'Sign in on the home screen to see your Blobbi in its room.'
    : status === 'empty' ? 'Adopt a Blobbi on the home screen first.'
    : status === 'error' ? 'The relays did not answer.'
    : 'Looking for your Blobbi…';
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center" role="status">
      <p className="scene-text text-sm text-foreground/80">{text}</p>
      <Link to="/" className="onboard-btn onboard-btn--secondary !w-auto !px-4 !py-2 text-sm">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Home
      </Link>
    </div>
  );
}

function BlobbiRoom({ blobbi }: { blobbi: BlobbiCompanion }) {
  const projected = useProjectedBlobbiState(blobbi);
  const isSleeping = blobbi.state === 'sleeping';
  // The room the player chose; a sleeper is in the bedroom whatever was chosen.
  const [chosenRoom, setChosenRoom] = useState<RoomId>(DEFAULT_ROOM);
  const roomId = resolveRoom(chosenRoom, isSleeping);
  const [facing, setFacing] = useState<BlobbiFacing>('front');
  const onActorFacingChange = useCallback((id: string, next: BlobbiFacing) => {
    if (id === MAIN_BLOBBI) setFacing(next);
  }, []);
  const expression = useMemo(() => baselineExpression(blobbi, projected?.stats), [blobbi, projected?.stats]);
  const layout = roomLayoutFor(roomId);
  const placements = roomFurnitureFor(roomId);

  return (
    <RoomShell
      roomId={roomId}
      onChangeRoom={setChosenRoom}
      isSleeping={isSleeping}
      blobbiStage={blobbi.stage}
      blobbiVisible
      roomLayout={layout}
      furniturePlacements={placements}
      onActorFacingChange={onActorFacingChange}
      stage={<RoomBlobbi blobbi={blobbi} facing={facing} expression={expression} />}
    >
      <div className="room-dock-bar" data-testid="room-dock">
        <Link to="/" className="room-hud-button" aria-label="Back to the home" data-testid="room-back">
          <ArrowLeft />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-bold">{blobbi.name}</p>
          <p className="truncate text-[11px] text-foreground/70">
            {STAGE_WORD[blobbi.stage]} · 3D room preview · faces {facing}
          </p>
        </div>
        <span className="size-[2.75em] shrink-0" aria-hidden />
      </div>
    </RoomShell>
  );
}
