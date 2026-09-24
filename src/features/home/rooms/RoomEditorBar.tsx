import { ArrowDown, ArrowDownUp, ArrowLeft, ArrowRight, ArrowUp, Check, FlipHorizontal2, Minus, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { NUDGE_STEP_LARGE } from './layout-edit';
import { furnitureById } from './furniture-registry';
import { MAX_FURNITURE_PER_ROOM } from './layout-schema';
import type { RoomEditor } from './useRoomEditor';

/**
 * The dock while decorating: what the selected piece can do, the way to add
 * one, and Apply / Cancel. Every control is a real button with a name, so
 * the editor works without a pointer; moving a piece is dragging OR the
 * arrow keys on the selected piece (see `useRoomEditor.onKeyDown`).
 */
export function RoomEditorBar({ editor, onOpenCatalog, roomLabel }: { editor: RoomEditor; onOpenCatalog: () => void; roomLabel: string }) {
  const selected = editor.selected !== null ? editor.draft[editor.selected] : undefined;
  const def = selected ? furnitureById(selected.id) : undefined;
  const full = editor.draft.length >= MAX_FURNITURE_PER_ROOM;

  if (editor.confirmingDiscard) {
    return (
      <div className="editor-bar" data-testid="editor-bar" role="group" aria-label="Unsaved changes">
        <p className="editor-bar__hint">Discard your changes to the {roomLabel.toLowerCase()}?</p>
        <div className="editor-bar__row">
          <button type="button" className="editor-btn" onClick={editor.keepEditing} data-testid="editor-keep">
            Keep editing
          </button>
          <button type="button" className="editor-btn editor-btn--danger" onClick={editor.discard} data-testid="editor-discard">
            Discard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-bar" data-testid="editor-bar" role="group" aria-label={`Decorating the ${roomLabel.toLowerCase()}`}>
      <div className="editor-bar__top">
        <p className="editor-bar__hint" aria-live="polite" data-testid="editor-hint">
          {selected && def ? `${def.label}: drag it, or use the arrows.` : `Tap a piece to move it, or add one. ${editor.draft.length}/${MAX_FURNITURE_PER_ROOM}`}
        </p>
        {selected && def && (
          <span className="editor-pad" role="group" aria-label={`Move the ${def.label.toLowerCase()}`}>
            <button type="button" className="editor-pad__btn" onClick={() => editor.nudge(-NUDGE_STEP_LARGE, 0)} aria-label="Move left" data-testid="editor-nudge-left">
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" className="editor-pad__btn" onClick={() => editor.nudge(0, -NUDGE_STEP_LARGE)} aria-label="Move up" data-testid="editor-nudge-up">
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" className="editor-pad__btn" onClick={() => editor.nudge(0, NUDGE_STEP_LARGE)} aria-label="Move down" data-testid="editor-nudge-down">
              <ArrowDown className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" className="editor-pad__btn" onClick={() => editor.nudge(NUDGE_STEP_LARGE, 0)} aria-label="Move right" data-testid="editor-nudge-right">
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </span>
        )}
      </div>
      <div className="editor-bar__row">
        <button type="button" className="editor-btn" onClick={onOpenCatalog} disabled={full} aria-label={full ? 'Room is full' : 'Add furniture'} data-testid="editor-add">
          <Plus className="h-4 w-4" aria-hidden /> Add
        </button>
        <button type="button" className="editor-btn" onClick={editor.cycleLayer} disabled={!def || def.allowedLayers.length < 2} aria-label={selected ? `Layer: ${selected.layer}. Change layer` : 'Change layer'} data-testid="editor-layer">
          <ArrowDownUp className="h-4 w-4" aria-hidden /> {selected ? selected.layer : 'Layer'}
        </button>
        <button type="button" className="editor-btn" onClick={() => editor.scale(-1)} disabled={!selected} aria-label="Smaller" data-testid="editor-smaller">
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <span className="editor-bar__value" aria-hidden>
          {selected ? `${Math.round((selected.scale ?? 1) * 100)}%` : '—'}
        </span>
        <button type="button" className="editor-btn" onClick={() => editor.scale(1)} disabled={!selected} aria-label="Larger" data-testid="editor-larger">
          <Plus className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" className="editor-btn" onClick={editor.flip} disabled={!def?.flippable} aria-label="Flip" data-testid="editor-flip">
          <FlipHorizontal2 className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" className="editor-btn editor-btn--danger" onClick={editor.remove} disabled={!selected} aria-label="Remove" data-testid="editor-remove">
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="editor-bar__row">
        <button type="button" className="editor-btn" onClick={editor.resetToDefaults} aria-label="Reset to the room's defaults" data-testid="editor-reset">
          <RotateCcw className="h-4 w-4" aria-hidden /> Reset
        </button>
        <span className="flex-1" />
        <button type="button" className="editor-btn" onClick={editor.cancel} data-testid="editor-cancel">
          <X className="h-4 w-4" aria-hidden /> Cancel
        </button>
        <button type="button" className="editor-btn editor-btn--primary" onClick={editor.apply} disabled={!editor.dirty} data-testid="editor-apply">
          <Check className="h-4 w-4" aria-hidden /> Apply
        </button>
      </div>
    </div>
  );
}
