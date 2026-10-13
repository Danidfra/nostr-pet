/**
 * The 3D room's own settings, as one section of the game menu (M14.1; until
 * then a button of their own in the room's HUD): the graphics quality and
 * how close the room is looked at. Every choice is this device's; nothing
 * here is published. Sound and which home opens are the menu's and the mode
 * switch's, not repeated here.
 *
 * How the Blobbi is drawn (the kit's 2D drawing, the original, or the 3D
 * model, experimental) is about the Blobbi, so it lives with the Blobbi
 * (M14.2): `BlobbiAppearanceControl` is the Blobbi sheet's Appearance
 * section, the one place it is chosen. Presentation only: the genome and
 * the identity are untouched by it.
 */
import { useCallback, type KeyboardEvent } from 'react';

import type { BlobbiAppearance } from '../lib/blobbi-appearance';
import type { QualityLevel, QualityPreference } from '../lib/room-quality';
import { cx } from '../lib/cx';

export interface BlobbiAppearanceControlProps {
  appearance: BlobbiAppearance;
  onChange: (appearance: BlobbiAppearance) => void;
  /** Why this Blobbi can only be drawn in 2D (an egg, V1/V2 art); null when 3D is available. */
  unavailable3d: string | null;
}

export interface RoomSettingsProps {
  /** The room's rendering quality (`useRoomQuality`), when the room is drawn in 3D. */
  quality?: { preference: QualityPreference; level: QualityLevel; onChange: (preference: QualityPreference) => void };
  /** How close the room is looked at (`useRoomZoom`): nearer, farther, and back to the recommended view. */
  zoom?: { value: number; onIn: () => void; onOut: () => void; onReset: () => void };
}

const QUALITY_WORD: Record<QualityLevel, string> = { high: 'High', balanced: 'Balanced', low: 'Low' };

const OPTIONS: { value: BlobbiAppearance; title: string; detail: string }[] = [
  { value: '2d', title: '2D', detail: 'The classic drawing' },
  { value: '3d', title: '3D', detail: 'The 3D model, experimental' },
];

/** The Blobbi's look in the room: the drawing or the 3D model. The same Blobbi, the same care, whichever is chosen. */
export function BlobbiAppearanceControl({ appearance, onChange, unavailable3d }: BlobbiAppearanceControlProps) {
  // What is drawn: 3D only where it can be
  const shown: BlobbiAppearance = appearance === '3d' && !unavailable3d ? '3d' : '2d';

  const choose = useCallback(
    (value: BlobbiAppearance) => {
      if (value === '3d' && unavailable3d) return;
      onChange(value);
    },
    [onChange, unavailable3d],
  );

  const onRadioKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next: BlobbiAppearance = shown === '2d' ? '3d' : '2d';
      if (next === '3d' && unavailable3d) return;
      choose(next);
      requestAnimationFrame(() => (e.currentTarget as HTMLElement | null)?.querySelector<HTMLButtonElement>(`[data-appearance="${next}"]`)?.focus());
    }
  };

  return (
    <div role="radiogroup" aria-label="Blobbi appearance" onKeyDown={onRadioKeyDown} className="room-settings flex flex-col gap-1" data-testid="room-appearance-panel" data-appearance={shown}>
      {OPTIONS.map((o) => {
        const disabled = o.value === '3d' && !!unavailable3d;
        const checked = shown === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={disabled || undefined}
            tabIndex={checked ? 0 : -1}
            className={cx('room-appearance-option', checked && 'room-appearance-option--on', disabled && 'opacity-50')}
            onClick={() => choose(o.value)}
            data-appearance={o.value}
            data-testid={`room-appearance-${o.value}`}
          >
            <span className="font-bold">{o.title}</span>
            <span className="text-foreground/70"> · {o.detail}</span>
          </button>
        );
      })}
      {unavailable3d && (
        <p className="px-1 text-[11px] leading-snug text-foreground/60" data-testid="room-appearance-note">
          {unavailable3d}
        </p>
      )}
    </div>
  );
}

export function RoomSettings({ quality, zoom }: RoomSettingsProps) {
  return (
    <div className="room-settings" data-testid="room-settings">
      {quality && (
        <label className="room-settings-row" data-testid="room-quality">
          <span className="flex-1 text-left">Graphics</span>
          <select className="room-settings-select" value={quality.preference} onChange={(e) => quality.onChange(e.target.value as QualityPreference)} aria-label="Graphics quality" data-testid="room-quality-select">
            <option value="auto">Auto ({QUALITY_WORD[quality.level]})</option>
            <option value="high">High</option>
            <option value="balanced">Balanced</option>
            <option value="low">Low (saves battery)</option>
          </select>
        </label>
      )}
      {zoom && (
        <div className="room-settings-row" data-testid="room-zoom" role="group" aria-label="View">
          <span className="flex-1 text-left">View</span>
          <button type="button" className="room-zoom-button touch-hit" onClick={zoom.onOut} aria-label="Look from farther" data-testid="room-zoom-out">
            −
          </button>
          <span className="room-zoom-value" aria-live="polite" data-testid="room-zoom-value">
            {Math.round(zoom.value * 100)}%
          </span>
          <button type="button" className="room-zoom-button touch-hit" onClick={zoom.onIn} aria-label="Look closer" data-testid="room-zoom-in">
            +
          </button>
          <button type="button" className="room-zoom-reset" onClick={zoom.onReset} disabled={Math.abs(zoom.value - 1) < 0.005} aria-label="Reset view" title="Back to the recommended view" data-testid="room-zoom-reset">
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
