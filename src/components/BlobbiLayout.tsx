import { ReactNode } from 'react';

interface BlobbiLayoutProps {
  children: ReactNode;
}

export function BlobbiLayout({ children }: BlobbiLayoutProps) {
  return (
    <div className="relative min-h-screen">
      {children}
      {/* MKStack Branding */}
      <div className="fixed bottom-4 right-4 z-50">
        <a
          href="https://soapbox.pub/tools/mkstack/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
        >
          Vibed with MKStack
        </a>
      </div>
    </div>
  );
}
