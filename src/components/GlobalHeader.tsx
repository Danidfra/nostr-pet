import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { LoginArea } from '@/components/auth/LoginArea';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useCoinBalance } from '@/hooks/useCoinBalance';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

function HeaderActions() {
  const { data: coinBalance } = useCoinBalance();
  const { data: profile } = useBlobbonautProfile();
  const totalCoins = coinBalance?.balance || profile?.coins || 0;

  return (
    <>
      {/* Coin Balance Display */}
      <div className={cn(
        "px-3 py-1.5 rounded-full backdrop-blur-sm border transition-all duration-200",
        "bg-white/80 dark:bg-gray-800/80 border-purple-200 dark:border-purple-600",
        "flex items-center gap-1.5"
      )}>
        <span className="text-base">🪙</span>
        <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
          {totalCoins}
        </span>
      </div>
      <div className="max-w-40">
        <LoginArea />
      </div>
    </>
  );
}

function MobileHeaderMenu() {
  const { data: coinBalance } = useCoinBalance();
  const { data: profile } = useBlobbonautProfile();
  const totalCoins = coinBalance?.balance || profile?.coins || 0;

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
        <div className="p-3">
          <div className={cn(
            "px-3 py-2 rounded-md backdrop-blur-sm border",
            "bg-white/80 dark:bg-gray-800/80 border-purple-200 dark:border-purple-600",
            "flex items-center gap-2"
          )}>
            <span className="text-base">🪙</span>
            <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
              {totalCoins} Coins
            </span>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function GlobalHeader() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const headerRef = useRef<HTMLElement>(null);

  // Check if we're on a Blobbi detail page
  const isBlobbiDetailPage = location.pathname.match(/^\/blobbi\/[^/]+$/);
  // Check if we're on the community page
  const isCommunityPage = location.pathname === '/blobbi/community';

  // Dynamically measure and update header height using ResizeObserver
  useEffect(() => {
    const headerElement = headerRef.current;
    if (!headerElement) return;

    const updateHeaderHeight = () => {
      const height = headerElement.offsetHeight;
      document.documentElement.style.setProperty('--app-header-h', `${height}px`);
    };

    // Initial measurement
    updateHeaderHeight();

    // Observe size changes (handles responsive changes, zoom, font size, etc.)
    const resizeObserver = new ResizeObserver(() => {
      updateHeaderHeight();
    });

    resizeObserver.observe(headerElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <header 
      ref={headerRef}
      className="fixed top-0 left-0 right-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
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
              to="/blobbi"
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
            {/* Desktop: Show individual buttons */}
            <div className="hidden md:flex items-center gap-2">
              <HeaderActions />
            </div>

            {/* Mobile: Show dropdown menu */}
            <div className="flex md:hidden gap-2">
              <MobileHeaderMenu />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}