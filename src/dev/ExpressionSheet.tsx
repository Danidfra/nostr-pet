import type { BlobbiCompanion } from '@blobbi-kit/core';
import { BLOBBI_EMOTIONS, BlobbiRenderer, type BlobbiEmotion } from '@blobbi-kit/renderer';
import type { EyeOffset, Facing } from '@/features/home/scene';
import { SHEET_ROWS, useSheetVisuals } from './sheet-visuals';

interface ExpressionSheetProps {
  blobbi: BlobbiCompanion;
  /** The facing and gaze every cell shares, so the three drawings are compared under one input. */
  facing?: Facing;
  eyeOffset?: EyeOffset;
  /** Highlights one column. */
  selected?: BlobbiEmotion | null;
  onSelect?: (emotion: BlobbiEmotion) => void;
  /** Cell size in CSS pixels. */
  cell?: number;
}

/** Every face on every drawing that has one, side by side. */
export function ExpressionSheet({ blobbi, facing = 'front', eyeOffset, selected = null, onSelect, cell = 34 }: ExpressionSheetProps) {
  const visuals = useSheetVisuals(blobbi);
  return (
    <div className="dev-sheet" style={{ gridTemplateColumns: `5rem repeat(${BLOBBI_EMOTIONS.length}, ${cell}px)` }} data-testid="dev-expression-sheet">
      <span />
      {BLOBBI_EMOTIONS.map((e) => (
        <button type="button" key={e} className={`dev-sheet__head ${selected === e ? 'is-on' : ''}`} onClick={onSelect ? () => onSelect(e) : undefined} disabled={!onSelect} data-testid={`dev-sheet-${e}`}>
          {e}
        </button>
      ))}
      {SHEET_ROWS.map((row) => {
        const visual = visuals[row];
        return (
          <FragmentRow key={row} label={row}>
            {BLOBBI_EMOTIONS.map((e) => (
              <span key={e} className={`dev-sheet__cell ${selected === e ? 'is-on' : ''}`} style={{ width: cell, height: cell }} data-testid={`dev-sheet-cell-${row.replace(' ', '-')}-${e}`}>
                {visual && <BlobbiRenderer visual={visual} instanceId={`sheet-${row}-${e}`} size="100%" expression={e} facing={facing} eyeOffset={eyeOffset} transparent style={{ width: '100%', height: '100%' }} />}
              </span>
            ))}
          </FragmentRow>
        );
      })}
    </div>
  );
}

function FragmentRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="dev-sheet__head">{label}</span>
      {children}
    </>
  );
}
