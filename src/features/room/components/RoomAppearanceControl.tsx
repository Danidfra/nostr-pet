/**
 * The room's settings, behind one HUD button: how the Blobbi is drawn (the
 * kit's 2D drawing, the original, or the 3D model, experimental), sound on
 * or off (the app's one preference, the same switch as the home's menu),
 * whether the app opens in the room, and the way to the 2D home (which
 * also makes the 2D home the one the app opens on, M13). Every choice is
 * this device's; nothing here is published.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Home, Settings2, Volume2, VolumeX } from 'lucide-react';

import { useSound } from '@/features/sound';
import { useHomeExperience, type FromRoomState } from '@/lib/home-experience';
import type { BlobbiAppearance } from '../lib/blobbi-appearance';
import type { QualityLevel, QualityPreference } from '../lib/room-quality';
import { cx } from '../lib/cx';

interface RoomSettingsControlProps {
  appearance: BlobbiAppearance;
  onChange: (appearance: BlobbiAppearance) => void;
  /** Why this Blobbi can only be drawn in 2D (an egg, V1/V2 art); null when 3D is available. */
  unavailable3d: string | null;
  /** The room's rendering quality (`useRoomQuality`), when the room is drawn in 3D. */
  quality?: { preference: QualityPreference; level: QualityLevel; onChange: (preference: QualityPreference) => void };
  /** How close the room is looked at (`useRoomZoom`): nearer, farther, and back to the recommended view. */
  zoom?: { value: number; onIn: () => void; onOut: () => void; onReset: () => void };
}

const QUALITY_WORD: Record<QualityLevel, string> = { high: 'High', balanced: 'Balanced', low: 'Low' };

const OPTIONS: { value: BlobbiAppearance; title: string; detail: string }[] = [
  { value: '2d', title: '2D', detail: 'Original' },
  { value: '3d', title: '3D', detail: 'Experimental' },
];

const BACK_HOME: FromRoomState = { fromRoom: true };

export function RoomAppearanceControl({ appearance, onChange, unavailable3d, quality, zoom }: RoomSettingsControlProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const sound = useSound();
  const [experience, setExperience] = useHomeExperience();
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

  // Opening moves focus to the appearance in force, so the arrows work at once
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
    }
  };
  const onRadioKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next: BlobbiAppearance = shown === '2d' ? '3d' : '2d';
      if (next === '3d' && unavailable3d) return;
      choose(next);
      requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>(`[data-appearance="${next}"]`)?.focus());
    }
  };

  const opensOnRoom = experience === 'room';
  return (
    <div ref={rootRef} className="relative" data-testid="room-settings">
      <button
        ref={buttonRef}
        type="button"
        className="room-hud-button touch-hit"
        aria-label="Room settings"
        aria-expanded={open}
        aria-controls={panelId}
        title="Settings"
        onClick={() => setOpen((o) => !o)}
        data-testid="room-settings-toggle"
        data-appearance={shown}
      >
        <Settings2 />
      </button>
      {open && (
        <div id={panelId} className="room-appearance-panel" onKeyDown={onKeyDown} data-testid="room-settings-panel">
          <div role="radiogroup" aria-label="Blobbi appearance" onKeyDown={onRadioKeyDown} className="flex flex-col gap-1" data-testid="room-appearance-panel">
            <p className="px-1 pb-0.5 text-[11px] font-semibold text-foreground/70">Blobbi appearance</p>
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
            {unavailable3d && <p className="px-1 text-[11px] leading-snug text-foreground/60" data-testid="room-appearance-note">{unavailable3d}</p>}
          </div>

          {quality && (
            <label className="room-settings-row" data-testid="room-quality">
              <span className="flex-1 text-left">Graphics</span>
              <select
                className="room-settings-select"
                value={quality.preference}
                onChange={(e) => quality.onChange(e.target.value as QualityPreference)}
                aria-label="Graphics quality"
                data-testid="room-quality-select"
              >
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
          <div className="room-settings-divider" aria-hidden />
          <button type="button" role="switch" aria-checked={sound.enabled} className="room-settings-row" onClick={() => sound.setEnabled(!sound.enabled)} data-testid="room-sound-toggle">
            {sound.enabled ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
            <span className="flex-1 text-left">Sound</span>
            <span className="menu-switch" aria-hidden data-on={sound.enabled ? 'true' : 'false'} />
          </button>
          <button type="button" role="switch" aria-checked={opensOnRoom} className="room-settings-row" onClick={() => setExperience(opensOnRoom ? 'classic' : 'room')} data-testid="room-first-toggle">
            <span className="flex-1 text-left">Open in 3D</span>
            <span className="menu-switch" aria-hidden data-on={opensOnRoom ? 'true' : 'false'} />
          </button>
          <Link to="/" state={BACK_HOME} onClick={() => setExperience('classic')} className="room-settings-row" data-testid="room-classic-home">
            <Home className="size-4" aria-hidden />
            <span className="flex-1 text-left">2D home</span>
          </Link>
        </div>
      )}
    </div>
  );
}
