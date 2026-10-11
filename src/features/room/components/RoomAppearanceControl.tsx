/**
 * The Blobbi's appearance in the room: the kit's 2D drawing (the original)
 * or the 3D model (experimental). A HUD button that opens two choices; the
 * choice is this device's (`blobbi-appearance.ts`), and switching never
 * leaves the room: only how the Blobbi is drawn changes.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Box, Image as ImageIcon } from 'lucide-react';

import type { BlobbiAppearance } from '../lib/blobbi-appearance';
import { cx } from '../lib/cx';

interface RoomAppearanceControlProps {
  appearance: BlobbiAppearance;
  onChange: (appearance: BlobbiAppearance) => void;
  /** Why this Blobbi can only be drawn in 2D (an egg, V1/V2 art); null when 3D is available. */
  unavailable3d: string | null;
}

const OPTIONS: { value: BlobbiAppearance; title: string; detail: string }[] = [
  { value: '2d', title: '2D', detail: 'Original' },
  { value: '3d', title: '3D', detail: 'Experimental' },
];

export function RoomAppearanceControl({ appearance, onChange, unavailable3d }: RoomAppearanceControlProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  // What is drawn: 3D only where it can be
  const shown: BlobbiAppearance = appearance === '3d' && !unavailable3d ? '3d' : '2d';

  // A press anywhere else closes it
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Opening moves focus to the choice in force, so the arrows work at once
  useEffect(() => {
    if (open) rootRef.current?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]')?.focus();
  }, [open]);

  const choose = useCallback(
    (value: BlobbiAppearance) => {
      if (value === '3d' && unavailable3d) return;
      onChange(value);
    },
    [onChange, unavailable3d],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next: BlobbiAppearance = shown === '2d' ? '3d' : '2d';
      if (next === '3d' && unavailable3d) return;
      choose(next);
      requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>(`[data-appearance="${next}"]`)?.focus());
    }
  };

  const Icon = shown === '3d' ? Box : ImageIcon;
  return (
    <div ref={rootRef} className="relative" data-testid="room-appearance">
      <button
        ref={buttonRef}
        type="button"
        className="room-hud-button"
        aria-label={`Blobbi appearance: ${shown === '3d' ? '3D, experimental' : '2D, original'}`}
        aria-expanded={open}
        aria-controls={panelId}
        title="Blobbi appearance"
        onClick={() => setOpen((o) => !o)}
        data-testid="room-appearance-toggle"
        data-appearance={shown}
      >
        <Icon />
      </button>
      {open && (
        <div
          id={panelId}
          role="radiogroup"
          aria-label="Blobbi appearance"
          className="room-appearance-panel"
          onKeyDown={onKeyDown}
          data-testid="room-appearance-panel"
        >
          <p className="px-1 pb-1 text-[11px] font-semibold text-foreground/70">Blobbi appearance</p>
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
          {unavailable3d && <p className="px-1 pt-1 text-[11px] leading-snug text-foreground/60" data-testid="room-appearance-note">{unavailable3d}</p>}
        </div>
      )}
    </div>
  );
}
