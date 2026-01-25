import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { AccountDropdownContent } from '@/components/AccountDropdownContent';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowLeft, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RelaysButton } from './RelaysButton';

/**
 * Unified Account Menu - used for both desktop and mobile
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function GlobalHeader() {
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

          {/* Navigation Actions - Unified Account Menu for both desktop and mobile */}
          <div className="flex items-center gap-2">
            <RelaysButton />
            <AccountMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
