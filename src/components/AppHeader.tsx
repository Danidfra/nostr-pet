import { ReactNode } from 'react';
import { LoginArea } from '@/components/auth/LoginArea';
import { ThemeToggle } from '@/components/theme-toggle';
import { SettingsButton } from '@/components/SettingsButton';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  logo?: string;
  logoClassName?: string;
  leftContent?: ReactNode;
  className?: string;
}

function HeaderActions() {
  return (
    <>
      <SettingsButton />
      <ThemeToggle />
      <div className="max-w-40">
        <LoginArea />
      </div>
    </>
  );
}

function MobileHeaderMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className={cn(
            "relative transition-all duration-300 ease-in-out",
            "hover:shadow-elegant hover:scale-105 hover:border-primary/30",
            "active:scale-95",
            "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
            "bg-card/50 backdrop-blur-sm border-border/50",
            "hover:glow-warm"
          )}
        >
          <MoreVertical className={cn(
            "h-4 w-4 transition-transform duration-200",
            "hover:rotate-90"
          )} />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className={cn(
          "w-56 shadow-elegant-lg border-border/50 backdrop-blur-sm",
          "bg-popover/95"
        )}
      >
        <div className="p-3">
          <div className="text-sm font-medium text-muted-foreground mb-3">Account</div>
          <div className="w-full">
            <LoginArea />
          </div>
        </div>
        <DropdownMenuSeparator className="my-1" />
          <SettingsButton 
            variant="ghost" 
            size="default" 
            className={cn(
              "w-full justify-start h-auto py-2 px-3",
              "hover:bg-accent/80 rounded-md transition-all duration-200",
              "focus-visible:ring-0 focus-visible:ring-offset-0"
            )}
            showLabel={true}
          />

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
  const isMobile = useIsMobile();

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
      
      {/* Desktop: Show individual buttons */}
      <div className="hidden md:flex items-center gap-2">
        <HeaderActions />
      </div>
      
      {/* Mobile: Show dropdown menu */}
      <div className="flex md:hidden gap-2">
        <ThemeToggle />
        <MobileHeaderMenu />
      </div>
    </div>
  );
}
