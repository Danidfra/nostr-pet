import { Camera, ChevronRight } from 'lucide-react';

/** The way to the Polaroid from a Blobbi's details: one tile, the same in both homes. Small, so it ships with the home; the sheet itself is loaded when asked for. */
export function PhotoTile({ name, onOpen }: { name: string; onOpen: () => void }) {
  return (
    <button type="button" className="menu-tile" onClick={onOpen} data-testid="sheet-photo" aria-label={`Photo: take a Polaroid of ${name}`}>
      <span className="menu-tile__icon">
        <Camera className="h-6 w-6" aria-hidden />
      </span>
      <span className="menu-tile__text">
        <span className="menu-tile__title">Photo</span>
        <span className="menu-tile__sub">A Polaroid of {name}, to keep or to send.</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
    </button>
  );
}
