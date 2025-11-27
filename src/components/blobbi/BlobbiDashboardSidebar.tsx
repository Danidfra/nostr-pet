import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Heart,
  Sparkles,
  Activity,
  Egg,
  ShoppingCart,
  Package,
} from 'lucide-react';
import { BlobbonautProfileCard } from '@/components/blobbi/BlobbonautProfileCard';
import { DailyMissionsCard } from '@/components/blobbi/DailyMissionsCard';
import { CompanionSelector } from '@/components/CompanionSelector';
import { DailyMissionsData } from '@/hooks/useDailyMissions';
interface BlobbiDashboardSidebarProps {
  missions: DailyMissionsData | undefined; // Use any for now to match the actual return type
  stats: {
    totalBlobbis: number;
    activeBlobbis: number;
    incubatingBlobbis: number;
    evolvedBlobbis: number;
  };
  claimMission1: () => void;
  claimMission2: () => void;
  claimBonus: () => void;
  isClaiming: boolean;
  onShopOpen: () => void;
  onBuyCoins: () => void;
  onStorageOpen: () => void;
  onTabChange: (tab: string) => void;
}

export function BlobbiDashboardSidebar({
  missions,
  stats,
  claimMission1,
  claimMission2,
  claimBonus,
  isClaiming,
  onShopOpen,
  onBuyCoins,
  onStorageOpen,
  onTabChange,
}: BlobbiDashboardSidebarProps) {
  // Simple analytics tracking function
  const track = (eventName: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventName, {
        event_category: 'quick_actions',
        event_label: 'blobbi_dashboard',
      });
    }
  };

  return (
    <div className="space-y-4">
      <BlobbonautProfileCard />

      {/* Daily Missions */}
      {missions && (
        <DailyMissionsCard
          state={{
            checkIn: {
              status: missions.mission1.status || 'LOCKED',
              claimedAt: missions.mission1.claimedAt
            },
            care3: {
              status: missions.mission2.status || 'LOCKED',
              progress: missions.mission2.progress,
              progressMax: missions.mission2.progressMax,
              claimedAt: missions.mission2.claimedAt
            },
            bonus: {
              status: missions.bonus.status || 'LOCKED',
              claimedAt: missions.bonus.claimedAt
            }
          }}
          onClaimCheckIn={async () => { await claimMission1(); }}
          onClaimCare3={async () => { await claimMission2(); }}
          onClaimBonus={async () => { await claimBonus(); }}
          isClaiming={isClaiming}
        />
      )}

      {/* Navigation Links */}
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-gray-100">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col space-y-2">
          <CompanionSelector />
          <Link to="/blobbi/adopt">
            <Button variant="outline" className="w-full justify-start gap-2 border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20">
              <Heart className="w-4 h-4" />
              Adopt New Blobbi
            </Button>
          </Link>
          <Link to="/blobbi/evolution">
            <Button variant="outline" className="w-full justify-start gap-2 border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20">
              <Sparkles className="w-4 h-4" />
              Evolution Guide
            </Button>
          </Link>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-green-200 dark:border-green-600 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
            onClick={onShopOpen}
          >
            <ShoppingCart className="w-4 h-4" />
            Shop
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-yellow-200 dark:border-yellow-600 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
            onClick={() => {
              track('quick_action_buy_coins_clicked');
              onBuyCoins();
            }}
            aria-label="Buy coins with sats"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <span className="text-yellow-600 dark:text-yellow-400">⚡</span>
            </div>
            Buy Coins
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-blue-200 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            onClick={onStorageOpen}
          >
            <Package className="w-4 h-4" />
            Storage
          </Button>
          {/* {stats.incubatingBlobbis > 0 && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 border-yellow-200 dark:border-yellow-600 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
              onClick={() => onTabChange('incubation')}
            >
              <Egg className="w-4 h-4" />
              View Growth Hub ({stats.incubatingBlobbis})
            </Button>
          )} */}
        </CardContent>
      </Card>
    </div>
  );
}