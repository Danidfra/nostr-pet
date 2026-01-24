import { LoginArea } from '@/components/auth/LoginArea';
import { useCoinBalance } from '@/hooks/useCoinBalance';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { useUserBlobbis } from '@/hooks/useUserBlobbis';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { User, Sparkles, Trophy, TrendingUp, Calendar, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

/**
 * Shared dropdown content for account menu
 * Used by both GlobalHeader and AppHeader to ensure consistent UI across the app
 */
export function AccountDropdownContent() {
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
