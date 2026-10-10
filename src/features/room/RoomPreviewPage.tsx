/**
 * `/room` — the 3D room, as a preview beside the home (dev builds only; see
 * `AppRouter`). Milestones 1 and 2 of bringing Ditto's room to this app: the
 * diorama, its camera and lighting, the registry's rooms painted as paper,
 * Ditto's default furniture, the room switcher, and the player's own Blobbi
 * drawn by the canonical renderer, walking the room at its own gait's pace,
 * facing the way it goes, looking at the pointer when its face is visible.
 * Decorating (milestone 3) is Ditto's: the decorate button, the editing
 * camera, drag and drop on the grid, the catalog tray, wallpaper and
 * flooring, save and cancel. What is saved lives in the session store, in
 * memory, per room. Nothing here publishes: the room choice is this
 * screen's state, and care stays on the home.
 */

import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useProjectedBlobbiState } from '@blobbi-kit/react';
import type { BlobbiCompanion } from '@blobbi-kit/core';

import { useHomeBlobbi } from '@/hooks/useHomeBlobbi';
import { baselineExpression } from '@/features/home/scene/reactions';
import { useGazePolicy } from '@/features/home/scene/useGazePolicy';
import { useHoverCapable } from '@/features/home/scene/SceneSettings';
import { DEFAULT_ROOM, resolveRoom, type RoomId } from '@/features/home/rooms/rooms';
import { RoomShell, type RoomEditorBinding } from './components/RoomShell';
import { RoomBlobbi } from './components/RoomBlobbi';
import { RoomDecoratorOverlay, RoomDecoratorToolbar } from './components/RoomDecorator';
import { useRoomNavigation } from './hooks/useRoomNavigation';
import { useRoomDecorator } from './hooks/useRoomDecorator';
import { useRoomSession } from './lib/room-session';
import { walkSpeedFor } from './lib/room-pace';
import { travelGaze } from './lib/room-gaze';

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
  const isEgg = blobbi.stage === 'egg';
  // The room the player chose; a sleeper is in the bedroom whatever was chosen.
  const [chosenRoom, setChosenRoom] = useState<RoomId>(DEFAULT_ROOM);
  const resolvedRoom = resolveRoom(chosenRoom, isSleeping);
  // What each room shows this session: saved decorations, else the defaults.
  const rooms = useRoomSession();
  const decorator = useRoomDecorator({ roomId: resolvedRoom, furniture: rooms.furnitureFor(resolvedRoom), layout: rooms.layoutFor(resolvedRoom), onSave: rooms.saveRoom });
  // The room being decorated is pinned, so falling asleep meanwhile doesn't move the view out from under the draft.
  const roomId = decorator.room ?? resolvedRoom;
  const nav = useRoomNavigation({ blobbi, editing: decorator.editing });
  const { facing, motion } = nav;
  const expression = useMemo(() => baselineExpression(blobbi, projected?.stats), [blobbi, projected?.stats]);
  const layout = decorator.layoutDraft ?? rooms.layoutFor(roomId);
  const placements = decorator.draft ?? rooms.furnitureFor(roomId);
  const walkSpeed = useMemo(() => walkSpeedFor(blobbi.stage, blobbi.visualGeneration), [blobbi.stage, blobbi.visualGeneration]);

  // The eyes: on the pointer while standing with a face in view (the home's
  // gaze policy over the room's own element), a glance the way it goes while walking.
  const shellRef = useRef<HTMLDivElement | null>(null);
  const actorRef = useRef<HTMLDivElement | null>(null);
  const hoverCapable = useHoverCapable();
  const gaze = useGazePolicy({ actorRef, sceneRef: shellRef, hoverCapable, actorKey: `${facing}:${motion}`, enabled: !isEgg && !isSleeping && facing !== 'back' && !decorator.editing });
  const eyeOffset = motion === 'walking' ? travelGaze(facing) : gaze.eyeOffset;
  const pointerHandlers = useMemo(() => ({ onPointerMove: gaze.onPointerMove, onPointerLeave: gaze.onPointerLeave, onPointerDown: gaze.onPointerDown }), [gaze.onPointerMove, gaze.onPointerLeave, gaze.onPointerDown]);

  const { draft, layoutDraft, selectedIndex, select, setDraft, setLayoutDraft, move, setInvalid, invalid, save, cancel } = decorator;
  const controlRef = nav.shellProps.controlRef;
  const editor = useMemo((): RoomEditorBinding | undefined => {
    if (!decorator.editing || !draft || !layoutDraft) return undefined;
    return {
      selectedIndex,
      onSelect: select,
      onMove: move,
      onInvalidChange: setInvalid,
      toolbar: selectedIndex !== null ? <RoomDecoratorToolbar draft={draft} onDraftChange={setDraft} selectedIndex={selectedIndex} onSelect={select} /> : undefined,
      overlay: (
        <RoomDecoratorOverlay
          roomId={roomId}
          draft={draft}
          onDraftChange={setDraft}
          layout={layoutDraft}
          onLayoutChange={setLayoutDraft}
          selectedIndex={selectedIndex}
          onSelect={select}
          invalid={invalid}
          controlRef={controlRef}
          onSave={save}
          onCancel={cancel}
        />
      ),
    };
  }, [decorator.editing, draft, layoutDraft, selectedIndex, select, move, setInvalid, setDraft, setLayoutDraft, invalid, controlRef, save, cancel, roomId]);

  return (
    <div ref={shellRef} className="flex flex-1 min-h-0 flex-col">
      <RoomShell
        roomId={roomId}
        onChangeRoom={setChosenRoom}
        isSleeping={isSleeping}
        blobbiStage={blobbi.stage}
        blobbiWalkSpeed={walkSpeed}
        blobbiVisible
        roomLayout={layout}
        furniturePlacements={placements}
        pointerHandlers={pointerHandlers}
        {...nav.shellProps}
        onDecorate={decorator.open}
        editor={editor}
        stage={<RoomBlobbi ref={actorRef} blobbi={blobbi} facing={facing} motion={motion} eyeOffset={eyeOffset} expression={expression} />}
      >
        <div className="room-dock-bar" data-testid="room-dock" data-motion={motion} data-facing={facing}>
          <Link to="/" className="room-hud-button" aria-label="Back to the home" data-testid="room-back">
            <ArrowLeft />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-bold">{blobbi.name}</p>
            <p className="truncate text-[11px] text-foreground/70">
              {STAGE_WORD[blobbi.stage]} · 3D room preview · {motion === 'walking' ? `walking, faces ${facing}` : 'standing'}
            </p>
          </div>
          <span className="size-[2.75em] shrink-0" aria-hidden />
        </div>
      </RoomShell>
    </div>
  );
}
