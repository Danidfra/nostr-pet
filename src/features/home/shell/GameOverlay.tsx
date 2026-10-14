import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useBlockingLayer } from '@/lib/blocking-layer';

interface GameOverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  testId?: string;
  /** Something beside the title (a portrait, a count). */
  lead?: ReactNode;
  /** A line under the title. */
  subtitle?: ReactNode;
  /** Sticky tabs or filters under the header, above the scrolling body. */
  toolbar?: ReactNode;
  /**
   * How much of the game the panel rises over: `tall` for screens that
   * need the room (the inventory), `medium` for the ones that do not (the
   * menu, the details). The world stays visible above either.
   */
  size?: 'tall' | 'medium';
  /** Extra classes for the panel. */
  className?: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A layer of the game over the game: the one overlay primitive the
 * inventory, the menu and the Blobbi's details are built on. It rises from
 * the bottom of the game surface (the viewport on a phone, the rounded game
 * column on a desktop; `GameShell` renders it inside that column) with a
 * rounded top edge, over a dimmed but visible world, to a height its `size`
 * asks for. Never a side drawer, never a modal floating away from the game. Accessible dialog semantics without a dependency: labelled
 * by its title, modal, focus moved to the close control on open and
 * restored on close, Tab kept inside, Escape and the backdrop close it, the
 * page behind does not scroll. The header is fixed and the body scrolls.
 * Reduced motion removes the entrance.
 *
 * One at a time (M15): every open overlay passes through the blocking-layer
 * queue (`lib/blocking-layer.ts`). The oldest open one holds the surface and
 * is rendered; a later one waits, unrendered, and rises when the first has
 * closed. Two sheets can therefore never stand on top of each other, and
 * none is dismissed on another's behalf.
 */
export function GameOverlay({ open, onClose, title, children, testId, lead, subtitle, toolbar, size = 'medium', className = '' }: GameOverlayProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  // The surface is held while open; a waiting overlay renders nothing until its turn
  const held = useBlockingLayer(open);

  useEffect(() => {
    if (!held) return;
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
    (closeRef.current ?? panelRef.current)?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [held]);

  if (!held) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="overlay-root" data-testid={testId} data-overlay="true" onKeyDown={onKeyDown}>
      <div className="overlay-backdrop" onClick={onClose} aria-hidden data-testid={testId ? `${testId}-backdrop` : undefined} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`overlay-panel ${className}`} data-size={size}>
        <div className="overlay-handle" aria-hidden />
        <header className="overlay-head">
          {lead && <div className="overlay-head__lead">{lead}</div>}
          <div className="overlay-head__text">
            <h2 id={titleId} className="overlay-title">
              {title}
            </h2>
            {subtitle && <div className="overlay-subtitle">{subtitle}</div>}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="overlay-close" aria-label="Close" data-testid={testId ? `${testId}-close` : undefined}>
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
        {toolbar && <div className="overlay-toolbar">{toolbar}</div>}
        <div className="overlay-body">{children}</div>
      </div>
    </div>
  );
}
