import { ReactNode } from 'react';
import { AccountSwitcher } from '@/components/AccountSwitcher';
import { ThemeToggle } from '@/components/theme-toggle';

interface BlobbiLayoutProps {
  children: ReactNode;
  showAccountSwitcher?: boolean;
  showThemeToggle?: boolean;
}

export function BlobbiLayout({ children, showAccountSwitcher = true, showThemeToggle = true }: BlobbiLayoutProps) {
  return (
    <div className="relative min-h-screen">
      {showAccountSwitcher && <AccountSwitcher />}
      {showThemeToggle && (
        <div className="fixed top-4 left-4 z-50">
          <ThemeToggle />
        </div>
      )}
      {children}
    </div>
  );
}