import { ReactNode } from 'react';

interface BlobbiLayoutProps {
  children: ReactNode;
}

export function BlobbiLayout({ children }: BlobbiLayoutProps) {
  return (
    <div className="relative min-h-screen">
      {children}
    </div>
  );
}
