import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BlobbiVisualSlotProps {
  children: ReactNode;
  className?: string;
  /** Apply consistent shadow for small UI contexts */
  withShadow?: boolean;
}

/**
 * BlobbiVisualSlot - Universal container for Blobbi visuals
 * 
 * Enforces:
 * - Square aspect ratio
 * - Centered content
 * - Overflow clipping
 * - Consistent shadow (optional)
 * 
 * Use this wrapper for all compact UI contexts:
 * - Selectors
 * - Lists
 * - Cards
 * - Inventories
 * - Grids
 * 
 * The child visual component (EggGraphic, BlobbiVisual, BlobbiEvolvedVisual)
 * must use w-full h-full to fill this container.
 */
export function BlobbiVisualSlot({ 
  children, 
  className,
  withShadow = false 
}: BlobbiVisualSlotProps) {
  return (
    <div 
      className={cn(
        // Square aspect ratio enforcement
        "w-full h-full aspect-square",
        // Centering
        "flex items-center justify-center",
        // Overflow control
        "overflow-hidden",
        // Optional shadow for UI contexts
        withShadow && "drop-shadow-md",
        className
      )}
    >
      {children}
    </div>
  );
}
