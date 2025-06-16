import { ReactNode } from 'react';
import { useBed } from '@/contexts/BedContext';
import { DraggableBed } from '@/components/DraggableBed';

interface BlobbiLayoutProps {
  children: ReactNode;
}

export function BlobbiLayout({ children }: BlobbiLayoutProps) {
  const { isBedVisible, hideBed } = useBed();

  return (
    <div className="relative min-h-screen">
      {children}
      <DraggableBed isVisible={isBedVisible} onClose={hideBed} />
    </div>
  );
}
