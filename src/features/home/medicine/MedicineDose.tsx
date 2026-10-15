/**
 * The medicine on its way to the Blobbi's mouth, laid in its art box (the 2D
 * actor, the room's overlay on its feet): from beside it up to the mouth,
 * smaller as it goes, then gone. Moved with the Web Animations API (no
 * stylesheet); under reduced motion it simply shows at the mouth, still.
 */
import { useEffect, useRef } from 'react';
import { ItemGlyph, type ItemGlyphModel } from '@/features/inventory';
import { MEDICINE_MOMENT, type MedicinePhase } from './medicine-moment';

export function MedicineDose({ glyph, phase, reducedMotion }: { glyph: ItemGlyphModel; phase: MedicinePhase; reducedMotion: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion || typeof el.animate !== 'function' || phase !== 'dose') return;
    const flight = el.animate(
      [
        { transform: 'translate(150%, 60%) scale(1)', opacity: 0 },
        { transform: 'translate(110%, 40%) scale(1)', opacity: 1, offset: 0.25 },
        { transform: 'translate(0, 0) scale(0.6)', opacity: 1 },
      ],
      { duration: MEDICINE_MOMENT.doseMs, easing: 'ease-in-out', fill: 'forwards' },
    );
    return () => flight.cancel();
  }, [phase, reducedMotion]);
  if (phase === 'relieved') return null;
  return (
    <span
      ref={ref}
      className="medicine-dose"
      data-testid="medicine-dose"
      data-phase={phase}
      aria-hidden
      style={{ position: 'absolute', left: '50%', top: '52%', width: '22%', height: '22%', marginLeft: '-11%', marginTop: '-11%', zIndex: 4, pointerEvents: 'none', opacity: phase === 'wiggle' ? 0.85 : 1 }}
    >
      <ItemGlyph glyph={glyph} fill />
    </span>
  );
}
