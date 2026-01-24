import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { LoginArea } from '@/components/auth/LoginArea';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useCoinBalance } from '@/hooks/useCoinBalance';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { useUserBlobbis } from '@/hooks/useUserBlobbis';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, ArrowLeft, User, Sparkles, Trophy, TrendingUp, Calendar, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

/**
 * Shared dropdown content for account menu (used by both desktop and mobile)
 */
function AccountDropdownContent() {
  const { data: coinBalance } = useCoinBalance();
  const { data: profile } = useBlobbonautProfile();
  const { data: userBlobbis = [] } = useUserBlobbis();
  const totalCoins = coinBalance?.balance || profile?.coins || 0;

  // Blobbi stats
  const totalBlobbis = userBlobbis.length;
  const activeBlobbis = userBlobbis.filter(b => b.state === 'active').length;
  const evolvedBlobbis = userBlobbis.filter(b => b.evolutionForm && b.evolutionForm !== 'blobbi').length;
  const totalExperience = userBlobbis.reduce((sum, b) => sum + b.experience, 0);
  const achievements = profile?.achievements.length || 0;

  return (
    <>
      {/* Nostr Account Section */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Nostr Account</h3>
        </div>
        <div className="w-full">
          <LoginArea />
        </div>
      </div>

      <DropdownMenuSeparator className="my-0 bg-purple-200/50 dark:bg-purple-600/50" />

      {/* Blobbi Account Info Section */}
      {profile && (
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Blobbi Account</h3>
          </div>
          
          {/* Coins Balance - Highlighted */}
          <div className={cn(
            "mb-3 px-3 py-2.5 rounded-xl backdrop-blur-sm border",
            "bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20",
            "border-yellow-200 dark:border-yellow-700"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Coins</span>
              </div>
              <span className="text-base font-bold text-yellow-700 dark:text-yellow-300">
                {totalCoins}
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            {/* Total Blobbis */}
            <div className={cn(
              "px-3 py-2 rounded-lg backdrop-blur-sm border",
              "bg-white/80 dark:bg-gray-800/80 border-purple-200/50 dark:border-purple-600/50"
            )}>
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Blobbis</div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{totalBlobbis}</span>
                <span className="text-xs text-gray-500 dark:text-gray-500">({activeBlobbis} active)</span>
              </div>
            </div>

            {/* Evolved */}
            <div className={cn(
              "px-3 py-2 rounded-lg backdrop-blur-sm border",
              "bg-white/80 dark:bg-gray-800/80 border-purple-200/50 dark:border-purple-600/50"
            )}>
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Evolved</div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{evolvedBlobbis}</span>
              </div>
            </div>

            {/* Total XP */}
            <div className={cn(
              "px-3 py-2 rounded-lg backdrop-blur-sm border",
              "bg-white/80 dark:bg-gray-800/80 border-purple-200/50 dark:border-purple-600/50"
            )}>
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total XP</div>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-green-500 dark:text-green-400" />
                <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{totalExperience}</span>
              </div>
            </div>

            {/* Achievements */}
            <div className={cn(
              "px-3 py-2 rounded-lg backdrop-blur-sm border",
              "bg-white/80 dark:bg-gray-800/80 border-purple-200/50 dark:border-purple-600/50"
            )}>
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Achievements</div>
              <div className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{achievements}</span>
              </div>
            </div>
          </div>

          {/* Last Updated */}
          {profile.lastModified && (
            <div className={cn(
              "mt-3 px-3 py-2 rounded-lg backdrop-blur-sm border text-center",
              "bg-purple-50/50 dark:bg-purple-900/20 border-purple-200/50 dark:border-purple-600/50"
            )}>
              <div className="flex items-center justify-center gap-1.5 text-xs text-purple-700 dark:text-purple-300">
                <Calendar className="w-3 h-3" />
                <span>Updated {formatDistanceToNow(profile.lastModified * 1000, { addSuffix: true })}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

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

          {/* Navigation Actions - Unified Account Menu for both desktop and mobile */}
          <div className="flex items-center gap-2">
            <AccountMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
