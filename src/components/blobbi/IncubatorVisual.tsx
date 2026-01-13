import { ReactNode } from 'react';
import incubatorBase from '@/assets/others/incubator.png';
import incubatorGlass from '@/assets/others/incubator-glass.png';
import { cn } from '@/lib/utils';

interface IncubatorVisualProps {
  children: ReactNode;
  className?: string;
}

/**
 * IncubatorVisual - Wraps an egg graphic with incubator visuals
 * 
 * Renders a 3-layer stack:
 * 1. incubator.png (base/back) - z-10
 * 2. children (egg graphic) - z-20
 * 3. incubator-glass.png (front) - z-30
 */
export function IncubatorVisual({ children, className = '' }: IncubatorVisualProps) {
  return (
    <div
      className={cn(
        // IMPORTANT: must have real size so absolute layers (inset-0) don't become 0px height
        "relative mx-auto w-full h-full aspect-square",
        className
      )}
    >
      {/* Incubator Base - Behind the egg */}
      <img
        src={incubatorBase}
        alt=""
        className="
          absolute
          left-1/2
          bottom-0
          -translate-x-1/2
          translate-y-[35.5%]
          w-[70%]
          h-full
          object-contain
          pointer-events-none
          z-10
        "
      />

      {/* Egg - Center layer */}
      <div className="relative z-20 w-full h-full flex items-center justify-center">
        {/* Give the egg a predictable footprint inside the incubator */}
        <div className="w-[50%] h-[50%] flex items-center justify-center">
          {children}
        </div>
      </div>

      {/* Incubator Glass - In front of the egg */}
      <img
        src={incubatorGlass}
        alt=""
          className="
          absolute
          left-1/2
          top-1/2
          -translate-x-1/2
          -translate-y-[57%]
          w-[60%]
          h-full
          object-contain
          pointer-events-none
          z-10
        "
      />
    </div>
  );
}
