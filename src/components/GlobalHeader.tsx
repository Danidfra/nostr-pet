import { Link, useLocation, useNavigate } from 'react-router-dom';
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
import { MoreVertical, Home, ArrowLeft, Users } from 'lucide-react';
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
  const location = useLocation();
  const navigate = useNavigate();

  // Check if we're on a Blobbi detail page
  const isBlobbiDetailPage = location.pathname.match(/^\/blobbi\/[^/]+$/);
  // Check if we're on the community page
  const isCommunityPage = location.pathname === '/blobbi/community';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:p-4">
        <div className="flex h-20 items-center justify-between">
          {/* Logo/Brand with optional back arrow and community badge */}
          <div className="flex items-center gap-3">
            {isBlobbiDetailPage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/blobbi')}
                className="border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <Link
              to="/"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity duration-200"
            >
              <img
                src="/blobbilogo.svg"
                alt="Blobbi"
                className="w-32 sm:w-48"
              />
            </Link>
            {isCommunityPage && (
              <span className="hidden sm:inline-flex items-center rounded-full border border-purple-200 dark:border-purple-600 px-3 py-1 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50/70 dark:bg-purple-900/30">
                Community
              </span>
            )}
          </div>

          {/* Navigation Actions */}
          <div className="flex items-center gap-2">
            {/* Home button */}
            <Link to="/blobbi">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "hidden sm:flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors",
                  location.pathname === '/blobbi' && "text-foreground bg-purple-50 dark:bg-purple-900/20"
                )}
              >
                <Home className="h-4 w-4" />
                Home
              </Button>
            </Link>

            {/* Community button */}
            <Link to="/blobbi/community">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "hidden sm:flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors",
                  isCommunityPage && "text-foreground bg-purple-50 dark:bg-purple-900/20"
                )}
              >
                <Users className="h-4 w-4" />
                Community
              </Button>
            </Link>

            {/* Desktop: Show individual buttons */}
            <div className="hidden md:flex items-center gap-2">
              <HeaderActions />
            </div>

            {/* Mobile: Show dropdown menu */}
            <div className="flex md:hidden gap-2">
              <Link to="/blobbi">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "text-muted-foreground hover:text-foreground transition-colors",
                    location.pathname === '/blobbi' && "text-foreground bg-purple-50 dark:bg-purple-900/20"
                  )}
                >
                  <Home className="h-4 w-4" />
                  <span className="sr-only">Home</span>
                </Button>
              </Link>
              <Link to="/blobbi/community">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "text-muted-foreground hover:text-foreground transition-colors",
                    isCommunityPage && "text-foreground bg-purple-50 dark:bg-purple-900/20"
                  )}
                >
                  <Users className="h-4 w-4" />
                  <span className="sr-only">Community</span>
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