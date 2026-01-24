import { ReactNode } from 'react';
import { AccountDropdownContent } from '@/components/AccountDropdownContent';
import { SettingsButton } from '@/components/SettingsButton';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  logo?: string;
  logoClassName?: string;
  leftContent?: ReactNode;
  className?: string;
}

/**
 * Unified Account Menu - shows the same dropdown for both desktop and mobile
 * Contains Nostr account (LoginArea) and Blobbi account info (coins + stats)
 */
function AccountMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "relative transition-all duration-300 ease-in-out",
            "hover:shadow-elegant hover:scale-105 hover:border-purple-300 dark:hover:border-purple-500",
            "active:scale-95",
            "focus-visible:ring-2 focus-visible:ring-purple-400/50 focus-visible:ring-offset-2",
            "bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-purple-200/50 dark:border-purple-600/50"
          )}
        >
          <User className={cn(
            "h-4 w-4 text-purple-600 dark:text-purple-400"
          )} />
          <span className="sr-only">Account menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          "w-80 shadow-xl backdrop-blur-sm",
          "bg-white/95 dark:bg-gray-900/95 border border-purple-200/50 dark:border-purple-600/50 rounded-2xl"
        )}
      >
        <AccountDropdownContent />
        
        <DropdownMenuSeparator className="my-0 bg-purple-200/50 dark:bg-purple-600/50" />
        
        {/* Settings Button */}
        <div className="p-2">
          <SettingsButton
            variant="ghost"
            size="default"
            className={cn(
              "w-full justify-start h-auto py-2 px-3",
              "hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-md transition-all duration-200",
              "focus-visible:ring-0 focus-visible:ring-offset-0"
            )}
            showLabel={true}
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppHeader({
  title,
  subtitle,
  logo,
  logoClassName = "w-24 h-24",
  leftContent,
  className = ""
}: AppHeaderProps) {
  return (
    <div className={`flex flex-wrap justify-between items-center mb-8 gap-4 ${className}`}>
      <div className="flex items-center gap-4">
        {leftContent}
        {logo ? (
          <div className="flex justify-center">
            <img src={logo} alt="Logo" className={logoClassName} />
          </div>
        ) : title && (
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1 sm:mt-2">
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Unified Account Menu for both desktop and mobile */}
      <div className="flex items-center gap-2">
        <AccountMenu />
      </div>
    </div>
  );
}
