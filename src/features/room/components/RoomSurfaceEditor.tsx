/**
 * RoomSurfaceEditor — the editor panel for one surface (wall or floor):
 * pattern, colours, detail (per style) and angle (per style). Every value
 * out is a validated layout; no raw CSS. Ditto's panel, with its popover
 * colour picker replaced by the browser's own, and its swatch painted by the
 * home's `surfaceBackground` (the same generator Ditto's swatch uses).
 */
import { useCallback, useId } from 'react';
import { RotateCw } from 'lucide-react';

import { FLOOR_STYLES, WALL_STYLES, surfaceBackground, type FloorStyle, type SurfaceVariant, type WallStyle } from '@/features/home/rooms/surfaces';
import { t, type MessageKey } from '@/i18n';
import { cx } from '../lib/cx';
import type { RoomSurfaceLayout } from '../lib/room-layout';
import { getStyleVariants, supportsAngle } from '../lib/surface-options';

interface RoomSurfaceEditorProps {
  type: 'wall' | 'floor';
  value: RoomSurfaceLayout;
  onChange: (value: RoomSurfaceLayout) => void;
}

const STYLES_WITH_LABELS = new Set(['solid', 'stripes', 'dots', 'gradient', 'wood', 'tile', 'carpet']);
/** A pattern's name in this page's language; an unknown style shows its id. */
const styleLabel = (style: string) => (STYLES_WITH_LABELS.has(style) ? t(`room.surface.style.${style}` as MessageKey) : style);
const variantLabel = (variant: SurfaceVariant) => t(`room.surface.variant.${variant}`);

/** Angle presets for quick selection; tile has only square and diamond. */
const ANGLE_PRESETS = [0, 45, 90, 135, 180] as const;
const TILE_ANGLE_PRESETS = [0, 45] as const;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** A browser colour input shown as a swatch with its label. */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const id = useId();
  // The native input takes #rrggbb only; a three-digit or eight-digit palette entry is widened or trimmed for it
  const shown = value.length === 4 ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}` : value.slice(0, 7);
  return (
    <label htmlFor={id} className="decor-color">
      <input
        id={id}
        type="color"
        value={HEX_RE.test(shown) ? shown : '#ffffff'}
        onChange={(e) => {
          if (HEX_RE.test(e.target.value)) onChange(e.target.value);
        }}
        aria-label={label}
      />
      <span className="decor-color__swatch" style={{ background: shown }} aria-hidden />
      <span className="decor-color__label">{label}</span>
    </label>
  );
}

export function RoomSurfaceEditor({ type, value, onChange }: RoomSurfaceEditorProps) {
  const styles: readonly string[] = type === 'wall' ? WALL_STYLES : FLOOR_STYLES;
  const variants = getStyleVariants(value.style);

  const handleStyleChange = useCallback((style: WallStyle | FloorStyle) => {
    const next = getStyleVariants(style);
    onChange({ ...value, style, variant: next ? (value.variant && next.includes(value.variant) ? value.variant : 'medium') : undefined });
  }, [value, onChange]);
  const setColor = useCallback((index: 0 | 1, color: string) => {
    const palette = [...value.palette];
    palette[index] = color;
    onChange({ ...value, palette });
  }, [value, onChange]);
  const handleAngleChange = useCallback((angle: number) => {
    onChange({ ...value, angle: ((angle % 360) + 360) % 360 });
  }, [value, onChange]);

  return (
    <div className="space-y-4" data-testid={`surface-editor-${type}`}>
      <div>
        <p className="decor-label">{t('room.surface.pattern')}</p>
        <div className="flex flex-wrap gap-2">
          {styles.map((style) => (
            <button key={style} type="button" onClick={() => handleStyleChange(style as WallStyle | FloorStyle)} aria-pressed={value.style === style} className={cx('decor-chip', value.style === style && 'decor-chip--on')} data-testid={`surface-style-${style}`}>
              {styleLabel(style)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="decor-label">{t('room.surface.colors')}</p>
        <div className="flex items-center gap-4">
          <ColorField label={t('room.surface.base')} value={value.palette[0] ?? '#ffffff'} onChange={(c) => setColor(0, c)} />
          {value.style !== 'solid' && <ColorField label={t('room.surface.accent')} value={value.palette[1] ?? value.palette[0] ?? '#000000'} onChange={(c) => setColor(1, c)} />}
          <div className="ml-auto decor-swatch" style={{ background: surfaceBackground(value, 0.6) }} aria-hidden data-testid="surface-swatch" />
        </div>
      </div>

      {variants && (
        <div>
          <p className="decor-label">{t('room.surface.detail')}</p>
          <div className="flex flex-wrap items-center gap-2">
            {variants.map((v, i) => (
              <span key={v} className="contents">
                {i > 0 && variants[i - 1] === 'wide' && (v === 'soft' || v === 'bold') && <span className="w-px h-6 bg-border/60 mx-1" aria-hidden />}
                <button type="button" onClick={() => onChange({ ...value, variant: v })} aria-pressed={value.variant === v} className={cx('decor-chip', value.variant === v && 'decor-chip--on')} data-testid={`surface-variant-${v}`}>
                  {variantLabel(v)}
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {supportsAngle(value.style) && (
        <div>
          <p className="decor-label">
            <span className="inline-flex items-center gap-1">
              <RotateCw className="size-3.5" aria-hidden />
              {t('room.surface.angle')}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {(value.style === 'tile' ? TILE_ANGLE_PRESETS : ANGLE_PRESETS).map((a) => (
              <button key={a} type="button" onClick={() => handleAngleChange(a)} aria-pressed={(value.angle ?? 0) === a} className={cx('decor-chip tabular-nums min-w-12', (value.angle ?? 0) === a && 'decor-chip--on')} data-testid={`surface-angle-${a}`}>
                {a}°
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
