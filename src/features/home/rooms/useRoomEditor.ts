/**
 * Edit mode for one room: a draft of the layout, a selection, and the
 * operations of `layout-edit.ts`, with apply / cancel / reset semantics.
 * The draft is UI state; Apply hands it to `useRoomLayout.save`, which is
 * the only way it reaches the store. Nothing here publishes.
 */
import { useCallback, useMemo, useState } from 'react';
import type { RoomPoint } from '../space/room-space';
import { furnitureById } from './furniture-registry';
import { addPlacement, cyclePlacementLayer, flipPlacement, movePlacement, nudgePlacement, removePlacement, sameLayout, scalePlacement, NUDGE_STEP, NUDGE_STEP_LARGE, SCALE_STEP } from './layout-edit';
import { normalizePlacement, placementExtent, type Placement } from './layout-schema';
import { clampPlacement } from '../space/room-space';
import type { RoomDefinition } from './rooms';

export interface RoomEditor {
  editing: boolean;
  draft: readonly Placement[];
  selected: number | null;
  dirty: boolean;
  /** Cancel was pressed with unsaved changes: the toolbar asks. */
  confirmingDiscard: boolean;
  begin: () => void;
  select: (index: number | null) => void;
  move: (index: number, point: RoomPoint) => void;
  nudge: (dx: number, dy: number) => void;
  cycleLayer: () => void;
  scale: (direction: 1 | -1) => void;
  flip: () => void;
  remove: () => void;
  add: (id: string) => boolean;
  /** Back to the room's default furniture (not saved until Apply). */
  resetToDefaults: () => void;
  apply: () => void;
  cancel: () => void;
  keepEditing: () => void;
  discard: () => void;
  /** The legal anchor for a raw one, for the drag ghost. */
  clampFor: (index: number, point: RoomPoint) => RoomPoint;
  /** Keyboard handling for a selected piece. */
  onKeyDown: (event: React.KeyboardEvent) => void;
}

export function useRoomEditor({ room, current, save }: { room: RoomDefinition; current: readonly Placement[]; save: (placements: readonly Placement[]) => void }): RoomEditor {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<readonly Placement[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const dirty = useMemo(() => editing && !sameLayout(draft, current), [editing, draft, current]);

  const begin = useCallback(() => {
    setDraft(current.map((p) => ({ ...p })));
    setSelected(null);
    setConfirmingDiscard(false);
    setEditing(true);
  }, [current]);

  const leave = useCallback(() => {
    setEditing(false);
    setSelected(null);
    setConfirmingDiscard(false);
    setDraft([]);
  }, []);

  const withSelected = useCallback(
    (op: (d: readonly Placement[], index: number) => Placement[]) => {
      if (selected === null) return;
      setDraft((d) => op(d, selected));
    },
    [selected],
  );

  const select = useCallback((index: number | null) => setSelected(index), []);
  const move = useCallback((index: number, point: RoomPoint) => setDraft((d) => movePlacement(d, index, point, room.id)), [room.id]);
  const nudge = useCallback((dx: number, dy: number) => withSelected((d, i) => nudgePlacement(d, i, dx, dy, room.id)), [withSelected, room.id]);
  const cycleLayer = useCallback(() => withSelected((d, i) => cyclePlacementLayer(d, i, room.id)), [withSelected, room.id]);
  const scale = useCallback((direction: 1 | -1) => withSelected((d, i) => scalePlacement(d, i, direction * SCALE_STEP, room.id)), [withSelected, room.id]);
  const flip = useCallback(() => withSelected((d, i) => flipPlacement(d, i, room.id)), [withSelected, room.id]);
  const remove = useCallback(() => {
    if (selected === null) return;
    setDraft((d) => removePlacement(d, selected));
    setSelected(null);
  }, [selected]);
  const add = useCallback(
    (id: string) => {
      const next = addPlacement(draft, id, room.id);
      if (!next) return false;
      setDraft(next);
      setSelected(next.length - 1);
      return true;
    },
    [draft, room.id],
  );
  const resetToDefaults = useCallback(() => {
    setDraft(room.defaultFurniture.map((p) => ({ ...p })));
    setSelected(null);
  }, [room.defaultFurniture]);

  const apply = useCallback(() => {
    save(draft);
    leave();
  }, [save, draft, leave]);
  const cancel = useCallback(() => {
    if (dirty) setConfirmingDiscard(true);
    else leave();
  }, [dirty, leave]);
  const keepEditing = useCallback(() => setConfirmingDiscard(false), []);
  const discard = useCallback(() => leave(), [leave]);

  const clampFor = useCallback(
    (index: number, point: RoomPoint) => {
      const p = draft[index];
      const def = p ? furnitureById(p.id) : undefined;
      if (!p || !def) return point;
      return clampPlacement(point, placementExtent(def, p));
    },
    [draft],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (selected === null) return;
      const step = event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
      switch (event.key) {
        case 'ArrowLeft':
          nudge(-step, 0);
          break;
        case 'ArrowRight':
          nudge(step, 0);
          break;
        case 'ArrowUp':
          nudge(0, -step);
          break;
        case 'ArrowDown':
          nudge(0, step);
          break;
        case 'Delete':
        case 'Backspace':
          remove();
          break;
        case 'Escape':
          setSelected(null);
          break;
        default:
          return;
      }
      event.preventDefault();
    },
    [selected, nudge, remove],
  );

  return { editing, draft, selected, dirty, confirmingDiscard, begin, select, move, nudge, cycleLayer, scale, flip, remove, add, resetToDefaults, apply, cancel, keepEditing, discard, clampFor, onKeyDown };
}

/** Whether a draft placement would survive normalization (for tests and the toolbar). */
export function isLegalPlacement(p: Placement, room: RoomDefinition): boolean {
  return normalizePlacement(p, room.id) !== undefined;
}
