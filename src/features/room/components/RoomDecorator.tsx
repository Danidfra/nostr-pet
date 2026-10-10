/**
 * RoomDecorator — decorating mode, Animal Crossing–style.
 *
 * The room itself is the editor: tap a piece to pick it up, drag it across
 * the floor or along the walls (RoomShell + RoomScene snap it to the grid
 * and show green/red footprints). This file provides the chrome:
 *
 * - `RoomDecoratorOverlay`: a top bar (cancel, title, save) and a bottom tray
 *   with the furniture catalog in 3D thumbnails, plus wallpaper and flooring.
 * - `RoomDecoratorToolbar`: the floating buttons over the selected piece
 *   (turn, size, put away).
 *
 * Keyboard: the tray's arrow buttons pick each placed piece in turn; then R
 * turns, Delete puts away, Escape lets go, arrows nudge a tile.
 *
 * Ditto's decorator, without its i18n, toasts (a notice in the top bar
 * instead), network objects and picture-frame uploads (a later milestone).
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Armchair, Box, Check, ChevronLeft, ChevronRight, Clock, Grid3x3, Image, Lamp, Minus, PaintRoller, Palette, Plus, RotateCw, Sprout, Trash2, X, type LucideIcon } from 'lucide-react';

import { roomById, type RoomId } from '@/features/home/rooms/rooms';
import { cx } from '../lib/cx';
import { getAvailableFurnitureByCategory, isOfficialFurnitureId, resolveFurniture, type FurnitureCategory, type FurnitureDefinition3D } from '../lib/furniture-3d';
import { MAX_FURNITURE_PER_ROOM, type FurniturePlacement } from '../lib/room-furniture';
import { ROOM_GRID, WALL_HEIGHT } from '../lib/room-geometry';
import { SCALE_STEPS, nudged, resized, rotated } from '../lib/placement-edit';
import type { RoomLayout } from '../lib/room-layout';
import { getThemeRoomDefaults } from '../lib/room-theme-defaults';
import { getOfficialFurnitureModel } from '../hooks/useFurnitureModels';
import type { RoomControl } from './RoomShell';
import { FurnitureThumbnail } from './FurnitureThumbnail';
import { RoomSurfaceEditor } from './RoomSurfaceEditor';

type TrayTab = FurnitureCategory | 'wall' | 'floor';

const TAB_ICONS: Record<TrayTab, LucideIcon> = {
  furniture: Armchair,
  decor: Lamp,
  plants: Sprout,
  clocks: Clock,
  frames: Image,
  objects: Box,
  wall: PaintRoller,
  floor: Grid3x3,
};

/** How long a notice (the room is full, no space) stays in the top bar. */
const NOTICE_MS = 2500;

// ─── Overlay ──────────────────────────────────────────────────────────────────

export interface RoomDecoratorOverlayProps {
  roomId: RoomId;
  draft: FurniturePlacement[];
  onDraftChange: (draft: FurniturePlacement[]) => void;
  layout: RoomLayout;
  onLayoutChange: (layout: RoomLayout) => void;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  invalid: Set<number>;
  controlRef: React.MutableRefObject<RoomControl | null>;
  onSave: () => void;
  onCancel: () => void;
}

export function RoomDecoratorOverlay({ roomId, draft, onDraftChange, layout, onLayoutChange, selectedIndex, onSelect, invalid, controlRef, onSave, onCancel }: RoomDecoratorOverlayProps) {
  const trayId = useId();
  const [tab, setTab] = useState<TrayTab>('furniture');
  const [notice, setNotice] = useState<string | null>(null);
  const catalog = useMemo(() => getAvailableFurnitureByCategory(roomId), [roomId]);
  const atLimit = draft.length >= MAX_FURNITURE_PER_ROOM;
  const room = roomById(roomId);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const tabs: { id: TrayTab; label: string }[] = [
    ...catalog.map((g) => ({ id: g.category as TrayTab, label: g.label })),
    { id: 'wall', label: 'Wallpaper' },
    { id: 'floor', label: 'Flooring' },
  ];
  const tabId = (id: TrayTab) => `${trayId}-tab-${id}`;
  const panelId = `${trayId}-panel`;

  const handleAdd = useCallback((def: FurnitureDefinition3D) => {
    if (atLimit) {
      setNotice(`This room is full: rooms hold up to ${MAX_FURNITURE_PER_ROOM} items`);
      return;
    }
    const model = getOfficialFurnitureModel(def.id);
    if (!model) return;
    const spot = controlRef.current?.findSpot({ node: model.node, official: isOfficialFurnitureId(def.id), mount: def.mount });
    if (controlRef.current && !spot) {
      setNotice('No space left: move or put something away first');
      return;
    }
    const placement: FurniturePlacement = {
      id: def.id,
      ...(spot ?? (def.mount === 'wall' ? { at: 'left' as const, x: ROOM_GRID / 2, y: WALL_HEIGHT / 2 } : { at: 'floor' as const, x: ROOM_GRID / 2, y: ROOM_GRID / 2 })),
    };
    onDraftChange([...draft, placement]);
    onSelect(draft.length);
  }, [atLimit, controlRef, draft, onDraftChange, onSelect]);

  // Pick pieces one after another, for keyboards and screen readers
  const selectStep = useCallback((dir: 1 | -1) => {
    if (!draft.length) return;
    const from = selectedIndex ?? (dir === 1 ? -1 : 0);
    onSelect((from + dir + draft.length) % draft.length);
  }, [draft.length, selectedIndex, onSelect]);
  const selectedLabel = selectedIndex !== null && draft[selectedIndex] ? resolveFurniture(draft[selectedIndex].id)?.label : undefined;

  const hint = notice
    ? notice
    : invalid.size
      ? 'Some pieces overlap: move them apart'
      : selectedIndex === null
        ? `Tap a piece to pick it up · ${draft.length}/${MAX_FURNITURE_PER_ROOM}`
        : `${selectedLabel ?? 'Piece'} · drag or use the arrow keys to move`;

  return (
    <>
      {/* Top bar */}
      <div data-room-top className="pointer-events-auto px-3 pt-3" data-testid="decorator-bar">
        <div className="decor-bar">
          <button type="button" onClick={onCancel} aria-label="Cancel decorating" className="decor-tool shrink-0" data-testid="decorator-cancel">
            <X />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-bold leading-tight">Decorating {room.label}</p>
            <p aria-live="polite" className={cx('truncate text-xs leading-tight', invalid.size || notice ? 'text-destructive font-medium' : 'text-muted-foreground')} data-testid="decorator-hint">
              {hint}
            </p>
          </div>
          <button type="button" onClick={onSave} disabled={invalid.size > 0} className="decor-save shrink-0" data-testid="decorator-save">
            <Check />
            Save
          </button>
        </div>
      </div>

      <div className="flex-1" />

      {/* Tray */}
      <div data-room-bottom className="decor-tray pointer-events-auto" data-testid="decorator-tray">
        <div className="flex items-center gap-1 border-b border-border/40 p-1.5">
          <ScrollRow
            className="flex-1 min-w-0"
            innerClassName="gap-1"
            role="tablist"
            aria-label="Catalog"
            onKeyDown={(e) => {
              // One tab stop; arrows move along the tabs
              const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
              if (!dir) return;
              e.preventDefault();
              const next = tabs[(tabs.findIndex((t) => t.id === tab) + dir + tabs.length) % tabs.length];
              setTab(next.id);
              document.getElementById(tabId(next.id))?.focus();
            }}
          >
            {tabs.map((t) => {
              const Icon = TAB_ICONS[t.id];
              return (
                <button key={t.id} type="button" role="tab" id={tabId(t.id)} tabIndex={tab === t.id ? 0 : -1} aria-selected={tab === t.id} aria-controls={panelId} onClick={() => setTab(t.id)} className={cx('decor-tab', tab === t.id && 'decor-tab--on')} data-testid={`decorator-tab-${t.id}`}>
                  <Icon aria-hidden />
                  {t.label}
                </button>
              );
            })}
          </ScrollRow>
          {/* Keyboard users pick placed pieces in turn; hidden until focused, since pointers just tap them */}
          <div className="flex shrink-0 gap-1 [&:not(:focus-within)]:sr-only">
            <button type="button" className="decor-tool" onClick={() => selectStep(-1)} disabled={!draft.length} aria-label="Select previous piece" data-testid="decorator-previous-piece">
              <ChevronLeft />
            </button>
            <button type="button" className="decor-tool" onClick={() => selectStep(1)} disabled={!draft.length} aria-label="Select next piece" data-testid="decorator-next-piece">
              <ChevronRight />
            </button>
          </div>
        </div>

        {tab === 'wall' || tab === 'floor' ? (
          <div id={panelId} role="tabpanel" aria-labelledby={tabId(tab)} className="max-h-[38dvh] overflow-y-auto px-4 py-3">
            <RoomSurfaceEditor type={tab} value={layout[tab]} onChange={(value) => onLayoutChange({ ...layout, [tab]: value })} />
            <button type="button" className="decor-chip mt-3 text-muted-foreground" onClick={() => onLayoutChange({ ...layout, [tab]: getThemeRoomDefaults()[roomId][tab] })} data-testid="decorator-match-theme">
              <Palette className="size-4" aria-hidden />
              Match my theme
            </button>
          </div>
        ) : (
          <ScrollRow key={tab} id={panelId} role="tabpanel" aria-labelledby={tabId(tab)} innerClassName="gap-1 p-2">
            {catalog.find((g) => g.category === tab)?.items.map((def) => (
              <CatalogTile key={def.id} id={def.id} label={def.label} disabled={atLimit} onClick={() => handleAdd(def)} />
            ))}
          </ScrollRow>
        )}
      </div>
    </>
  );
}

/**
 * A row that scrolls sideways by swipe, mouse wheel, or the arrow buttons at
 * either end, which show while there's more that way.
 */
function ScrollRow({ className, innerClassName, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { innerClassName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const left = el.scrollLeft > 2;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
    };
    check();
    el.addEventListener('scroll', check, { passive: true });
    // jsdom has neither observer; the row is checked once there
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(el);
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(check) : null;
    mo?.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener('scroll', check);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, []);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' });
  };

  // A vertical wheel scrolls the row sideways; the room behind doesn't scroll
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY;
  };

  return (
    <div className={cx('relative', className)}>
      <div ref={ref} onWheel={onWheel} className={cx('decor-scroll flex overflow-x-auto', innerClassName)} {...props}>
        {children}
      </div>
      {edges.left && (
        <button type="button" tabIndex={-1} onClick={() => page(-1)} className="decor-scroll-arrow left-1" aria-label="Scroll back">
          <ChevronLeft />
        </button>
      )}
      {edges.right && (
        <button type="button" tabIndex={-1} onClick={() => page(1)} className="decor-scroll-arrow right-1" aria-label="Scroll forward">
          <ChevronRight />
        </button>
      )}
    </div>
  );
}

function CatalogTile({ id, label, disabled, onClick }: { id: string; label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="decor-tile" data-testid={`catalog-${id}`}>
      <FurnitureThumbnail id={id} alt="" className="size-16" />
      <span className="w-full truncate text-center text-xs font-medium leading-tight">{label}</span>
    </button>
  );
}

// ─── Floating toolbar ─────────────────────────────────────────────────────────

export interface RoomDecoratorToolbarProps {
  draft: FurniturePlacement[];
  onDraftChange: (draft: FurniturePlacement[]) => void;
  selectedIndex: number;
  onSelect: (index: number | null) => void;
}

export function RoomDecoratorToolbar({ draft, onDraftChange, selectedIndex, onSelect }: RoomDecoratorToolbarProps) {
  const item = draft[selectedIndex];
  const def = item ? resolveFurniture(item.id) : undefined;

  const replace = useCallback((next: FurniturePlacement) => {
    onDraftChange(draft.map((p, i) => (i === selectedIndex ? next : p)));
  }, [draft, onDraftChange, selectedIndex]);

  const rotate = useCallback(() => {
    if (!item || item.at !== 'floor') return;
    replace(rotated(item));
  }, [item, replace]);

  const resize = useCallback((dir: 1 | -1) => {
    if (!item) return;
    replace(resized(item, dir));
  }, [item, replace]);

  const remove = useCallback(() => {
    onDraftChange(draft.filter((_, i) => i !== selectedIndex));
    onSelect(null);
  }, [draft, onDraftChange, onSelect, selectedIndex]);

  // Keyboard: R turns, Delete puts away, Escape lets go, arrows nudge
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (!item) return;
      // Delete/Backspace or arrows on another control (a tray tile, a tab) aren't aimed at the piece; on its toolbar they are
      const onControl = !!target?.closest('button, a[href], [role="button"], [role="tab"]') && !target?.closest('[role="toolbar"]');
      const step: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (e.key === 'r' || e.key === 'R') rotate();
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (onControl) return;
        remove();
      } else if (e.key === 'Escape') onSelect(null);
      else if (step[e.key]) {
        if (onControl) return;
        const [dx, dy] = step[e.key];
        replace(nudged(item, dx, dy));
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, rotate, remove, onSelect, replace]);

  if (!item || !def) return null;
  const scale = item.scale ?? 1;

  return (
    <div className="decor-toolbar" role="toolbar" aria-label={`${def.label} actions`} data-testid="decorator-toolbar">
      {item.at === 'floor' && (
        <ToolButton label="Turn (R)" onClick={rotate} testId="decorator-turn">
          <RotateCw />
        </ToolButton>
      )}
      <ToolButton label="Smaller" onClick={() => resize(-1)} disabled={scale <= SCALE_STEPS[0]} testId="decorator-smaller">
        <Minus />
      </ToolButton>
      <ToolButton label="Bigger" onClick={() => resize(1)} disabled={scale >= SCALE_STEPS[SCALE_STEPS.length - 1]} testId="decorator-bigger">
        <Plus />
      </ToolButton>
      <div className="mx-0.5 h-6 w-px bg-border" aria-hidden />
      <ToolButton label="Put away (Delete)" onClick={remove} className="text-destructive" testId="decorator-put-away">
        <Trash2 />
      </ToolButton>
    </div>
  );
}

function ToolButton({ label, onClick, disabled, className, testId, children }: { label: string; onClick: () => void; disabled?: boolean; className?: string; testId?: string; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={cx('decor-tool', className)} data-testid={testId}>
      {children}
    </button>
  );
}
