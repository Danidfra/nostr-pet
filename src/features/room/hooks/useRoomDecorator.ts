/**
 * Decorating a room: the draft, the selection and the overlaps while the
 * player decorates, and what Save and Cancel do with them.
 *
 * Ditto's Blobbi page holds exactly this state (a furniture draft, a layout
 * draft, the selected piece, the overlapping pieces, the room pinned while
 * decorating) and saves to the profile; here Save hands the drafts to
 * whoever owns the room's state (the session store, this milestone) and
 * only what changed, as Ditto does, so an untouched room keeps following
 * its defaults. Nothing here publishes or stores anything.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { RoomId } from '@/features/home/rooms/rooms';
import type { FurniturePlacement } from '../lib/room-furniture';
import type { RoomLayout } from '../lib/room-layout';

export interface UseRoomDecoratorOptions {
  /** The room the player is in (the room is pinned while decorating; a change of this discards the draft, as on Ditto). */
  roomId: RoomId;
  /** What the room shows now: the base the draft starts from and the save compares with. */
  furniture: readonly FurniturePlacement[];
  layout: RoomLayout;
  /** Save: only the drafts that changed are given. */
  onSave: (roomId: RoomId, saved: { furniture?: FurniturePlacement[]; layout?: RoomLayout }) => void;
}

export interface RoomDecorator {
  /** Decorating is on. */
  editing: boolean;
  /** The room being decorated, pinned so nothing moves the view while a draft is open. */
  room: RoomId | null;
  draft: FurniturePlacement[] | null;
  layoutDraft: RoomLayout | null;
  selectedIndex: number | null;
  /** Indices of pieces that overlap another (the scene reports them); Save waits for none. */
  invalid: Set<number>;
  open: () => void;
  cancel: () => void;
  save: () => void;
  setDraft: (draft: FurniturePlacement[]) => void;
  setLayoutDraft: (layout: RoomLayout) => void;
  select: (index: number | null) => void;
  /** A piece was dropped on a free spot (the shell's `onMove`). */
  move: (index: number, placement: FurniturePlacement) => void;
  setInvalid: (invalid: Set<number>) => void;
}

export function useRoomDecorator({ roomId, furniture, layout, onSave }: UseRoomDecoratorOptions): RoomDecorator {
  const [room, setRoom] = useState<RoomId | null>(null);
  const [draft, setDraftState] = useState<FurniturePlacement[] | null>(null);
  const [layoutDraft, setLayoutDraftState] = useState<RoomLayout | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [invalid, setInvalid] = useState<Set<number>>(() => new Set());
  /** The room as decorating found it: what the save compares the drafts with. */
  const baseRef = useRef<{ room: RoomId; furniture: readonly FurniturePlacement[]; layout: RoomLayout } | null>(null);

  const cancel = useCallback(() => {
    setRoom(null);
    baseRef.current = null;
    setDraftState(null);
    setLayoutDraftState(null);
    setSelectedIndex(null);
    setInvalid(new Set());
  }, []);

  const open = useCallback(() => {
    baseRef.current = { room: roomId, furniture, layout };
    setRoom(roomId);
    setDraftState([...furniture]);
    setLayoutDraftState(layout);
    setSelectedIndex(null);
    setInvalid(new Set());
  }, [roomId, furniture, layout]);

  const save = useCallback(() => {
    const base = baseRef.current;
    if (!base || !draft || !layoutDraft) return;
    // Only what changed, compared with the room as decorating found it
    const furnitureChanged = draft.length !== base.furniture.length || draft.some((item, i) => item !== base.furniture[i]);
    const layoutChanged = layoutDraft !== base.layout;
    if (furnitureChanged || layoutChanged) {
      onSave(base.room, { ...(furnitureChanged ? { furniture: draft } : {}), ...(layoutChanged ? { layout: layoutDraft } : {}) });
    }
    cancel();
  }, [draft, layoutDraft, onSave, cancel]);

  const move = useCallback((index: number, placement: FurniturePlacement) => {
    setDraftState((prev) => prev?.map((item, i) => (i === index ? placement : item)) ?? prev);
  }, []);

  // Going to another room while decorating discards the draft (Ditto's rule; the HUD is hidden, so only a programmatic change can)
  const roomRef = useRef(roomId);
  useEffect(() => {
    if (roomRef.current === roomId) return;
    roomRef.current = roomId;
    cancel();
  }, [roomId, cancel]);

  return useMemo(
    () => ({
      editing: room !== null,
      room,
      draft,
      layoutDraft,
      selectedIndex,
      invalid,
      open,
      cancel,
      save,
      setDraft: setDraftState,
      setLayoutDraft: setLayoutDraftState,
      select: setSelectedIndex,
      move,
      setInvalid,
    }),
    [room, draft, layoutDraft, selectedIndex, invalid, open, cancel, save, move],
  );
}
