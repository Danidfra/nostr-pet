import { Link } from 'react-router-dom';
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
import { MoreVertical, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export function GlobalHeader() {
  const isMobile = useIsMobile();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:p-4">
        <div className="flex h-20 items-center justify-between">
          {/* Logo/Brand */}
          <Link
            to="/"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity duration-200"
          >
            <img
              src="/blobbilogo.svg"
              alt="Blobbi"
              className="w-32 sm:w-48"
            />
            {/* <div className="hidden sm:block">
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                Blobbi
              </h1>
            </div> */}
          </Link>

          {/* Navigation Actions */}
          <div className="flex items-center gap-2">
            {/* Home button for easy navigation */}
            <Link to="/blobbi">
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Home className="h-4 w-4" />
                Home
              </Button>
            </Link>

            {/* Desktop: Show individual buttons */}
            <div className="hidden md:flex items-center gap-2">
              <HeaderActions />
            </div>

            {/* Mobile: Show dropdown menu */}
            <div className="flex md:hidden gap-2">
              <Link to="/">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Home className="h-4 w-4" />
                  <span className="sr-only">Home</span>
                </Button>
              </Link>
              <ThemeToggle />
              <MobileHeaderMenu />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}