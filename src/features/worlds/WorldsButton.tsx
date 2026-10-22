/**
 * The Worlds button, top left in both homes: the way to the Worlds sheet,
 * visible to everyone (M16.x; before, a tile in the menu).
 *
 * Locked (`useWorldsAccess`): the globe wears a lock and a tap never opens
 * the worlds; it says, in a bubble by the button, that the worlds open once
 * the Blobbi is saved, with the save's own door (the ceremony every other
 * "Save" opens) while a guest plays. Once a save opens it, the button wears
 * the room's look guide for a moment: the same glow and the same bubble,
 * put away by a tap anywhere, Escape, or waiting.
 */
import { useEffect, useRef, useState } from 'react';
import { Globe2, Lock } from 'lucide-react';
import { LOOK_GUIDE_DOCK_MS } from '@/features/room/lib/look-guide';
import { WORLDS_GUIDE_LINE } from './worlds-access';
import type { WorldsDoor } from './useWorldsAccess';

interface WorldsButtonProps {
  door: WorldsDoor;
  /** The Blobbi's name, for the words. */
  name: string;
  /** The door is open: show the worlds. */
  onOpen: () => void;
  /** A guest's way to save (the existing ceremony). */
  onSave: () => void;
  /** Which home's top it sits in: the 2D HUD's round glass, or the room's header. */
  variant: 'hud' | 'room';
  reducedMotion?: boolean;
}

export function WorldsButton({ door, name, onOpen, onSave, variant, reducedMotion = false }: WorldsButtonProps) {
  const { locked, access, guide, endGuide } = door;
  const [why, setWhy] = useState(false);
  const slot = useRef<HTMLSpanElement>(null);

  // A door that opens (or locks) while the word is out: the word is about the door that was
  useEffect(() => {
    if (!locked) setWhy(false);
  }, [locked]);

  // The locked word and the guide go away with a tap elsewhere or Escape; the guide also with waiting
  const out = why || guide;
  useEffect(() => {
    if (!out) return;
    const close = () => {
      setWhy(false);
      endGuide();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (slot.current && e.target instanceof Node && slot.current.contains(e.target)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    const t = guide ? setTimeout(endGuide, LOOK_GUIDE_DOCK_MS) : undefined;
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      if (t) clearTimeout(t);
    };
  }, [out, guide, endGuide]);

  const tap = () => {
    if (locked) {
      setWhy((w) => !w);
      return;
    }
    endGuide();
    onOpen();
  };
  const save = () => {
    setWhy(false);
    onSave();
  };

  const label = locked ? `Worlds, locked: they open once ${name} is saved` : 'Worlds';
  const base = variant === 'hud' ? 'hud-icon-button' : 'room-header-back touch-hit';
  return (
    <span ref={slot} className="worlds-slot" data-testid="worlds-slot">
      <button
        type="button"
        className={`${base} worlds-button ${locked ? 'worlds-button--locked' : ''} ${guide ? 'worlds-button--guide' : ''} ${guide && reducedMotion ? 'worlds-button--still' : ''}`}
        onClick={tap}
        aria-label={label}
        title={locked ? 'Worlds (locked)' : 'Worlds'}
        aria-expanded={locked ? why : undefined}
        aria-describedby={locked && why ? 'worlds-locked-word' : undefined}
        data-testid="worlds-button"
        data-locked={locked ? 'true' : 'false'}
        data-guide={guide ? 'true' : undefined}
      >
        <Globe2 aria-hidden />
        {locked && (
          <span className="worlds-button__lock" data-testid="worlds-button-lock" aria-hidden>
            <Lock />
          </span>
        )}
      </button>
      {locked && why && (
        <span className="look-guide look-guide--below worlds-word" role="status" id="worlds-locked-word" data-testid="worlds-locked-word" data-reduced="true">
          <span className="look-guide__bubble worlds-word__bubble">
            {access === 'saving' ? (
              <span className="worlds-word__line">Worlds open as soon as {name} is saved.</span>
            ) : (
              <>
                <span className="worlds-word__line">Worlds open once {name} is saved to an account.</span>
                <button type="button" className="worlds-word__save" onClick={save} data-testid="worlds-locked-save">
                  Save {name}
                </button>
              </>
            )}
          </span>
        </span>
      )}
      {guide && (
        <button type="button" className="look-guide look-guide--below" onClick={tap} data-testid="worlds-guide" data-reduced={reducedMotion ? 'true' : undefined}>
          <span className="look-guide__bubble">{WORLDS_GUIDE_LINE}</span>
        </button>
      )}
    </span>
  );
}
