import { ReactNode } from 'react';
import { useBed } from '@/contexts/BedContext';
import { DraggableBed } from '@/components/DraggableBed';

interface BlobbiLayoutProps {
  children: ReactNode;
}

export function BlobbiLayout({ children }: BlobbiLayoutProps) {
  const { shouldRenderBed, hideBed } = useBed();

  return (
    <div className="relative min-h-screen">
      {children}
      {/* ✅ FIXED: Only render bed when companion is loaded and bed should be visible */}
      <DraggableBed isVisible={shouldRenderBed} onClose={hideBed} />
    </div>
  );
}
