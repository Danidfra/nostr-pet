import { SimpleThemeToggle } from '@/components/theme-toggle';

interface FloatingThemeToggleProps {
  className?: string;
}

export function FloatingThemeToggle({ className = "" }: FloatingThemeToggleProps) {
  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <SimpleThemeToggle />
    </div>
  );
}