import { ReactNode } from 'react';
import { LoginArea } from '@/components/auth/LoginArea';
import { ThemeToggle } from '@/components/theme-toggle';
import { SettingsButton } from '@/components/SettingsButton';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  leftContent?: ReactNode;
  showLeftControls?: boolean;
  className?: string;
}

export function AppHeader({ 
  title, 
  subtitle, 
  leftContent, 
  showLeftControls = false,
  className = ""
}: AppHeaderProps) {
  return (
    <div className={`flex justify-between items-center mb-8 ${className}`}>
      <div className="flex items-center gap-4">
        {leftContent}
        {showLeftControls && (
          <div className="flex items-center gap-2">
            <SettingsButton />
            <ThemeToggle />
          </div>
        )}
        {title && (
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
              {title}
            </h1>
            {subtitle && (
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LoginArea />
      </div>
    </div>
  );
}