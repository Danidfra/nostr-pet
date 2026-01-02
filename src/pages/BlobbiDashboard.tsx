import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useUserBlobbis } from '@/hooks/useUserBlobbis';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { useCoinBalance } from '@/hooks/useCoinBalance';
import { useBlobbiIncubationSystem } from '@/hooks/useBlobbiIncubationSystem';
import { useDailyMissions } from '@/hooks/useDailyMissions';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { useWelcomeConfetti } from '@/hooks/useWelcomeConfetti';
import { BlobbiDashboardSidebar } from '@/components/blobbi/BlobbiDashboardSidebar';
import { BlobbiDashboardTabsHeader } from '@/components/blobbi/BlobbiDashboardTabsHeader';
import { BlobbisTab } from '@/components/blobbi/dashboard/BlobbisTab';
import { MissionsTab } from '@/components/blobbi/dashboard/MissionsTab';
import { IncubationTab } from '@/components/blobbi/dashboard/IncubationTab';
import { DashboardNotLoggedIn } from '@/components/blobbi/dashboard/DashboardNotLoggedIn';
import { DashboardLoading } from '@/components/blobbi/dashboard/DashboardLoading';
import { DashboardModals } from '@/components/blobbi/dashboard/DashboardModals';
import { BlobbiLayout } from '@/components/BlobbiLayout';

// Simple analytics tracking function
const track = (eventName: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, {
      event_category: 'quick_actions',
      event_label: 'blobbi_dashboard',
    });
  }
};


declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params?: unknown) => void;
  }
}

type BlobbiFilter = 'all' | 'active' | 'incubating' | 'evolved' | 'archived';

export default function BlobbiDashboard() {
  // All hooks must be called unconditionally at the top
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { data: profile, isLoading: isProfileLoading } = useBlobbonautProfile();
  const { data: userBlobbis = [] } = useUserBlobbis();
  const { data: coinBalance } = useCoinBalance();
  const { progress, isReadyToHatch, isReadyToEvolve } = useBlobbiIncubationSystem();
  const { missions, claimMission1, claimMission2, claimBonus, isClaiming } = useDailyMissions();

  // State hooks
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const [showTourCompletionModal, setShowTourCompletionModal] = useState(false);
  const [filter, setFilter] = useState<BlobbiFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('blobbis');
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isStorageOpen, setIsStorageOpen] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [isBuyCoinsModalOpen, setIsBuyCoinsModalOpen] = useState(false);

  // Effect hooks
  const { toast } = useToast();
  useWelcomeConfetti(showTourCompletionModal);

  // Handle tour completion from details page
  useEffect(() => {
    const resume = sessionStorage.getItem('tour.resume');
    if (resume) {
      try {
        const data = JSON.parse(resume);
        if (data?.next === 'dashboard-complete') {
          sessionStorage.removeItem('tour.resume');
          setShowTourCompletionModal(true);
          toast({
            title: "Tour Complete! 🎉",
            description: "You've successfully completed Blobbi tour. Your Blobbi is ready for adventure!",
            duration: 5000,
          });
        }
      } catch (error) {
        console.error('Error parsing tour resume data:', error);
        sessionStorage.removeItem('tour.resume');
      }
    }
  }, [toast]);

  // Redirect to adoption page if user doesn't have a profile
  useEffect(() => {
    if (user && !isProfileLoading && !profile) {
      console.log('No profile found, redirecting to adoption page');
      navigate('/blobbi/adopt');
    }
  }, [user, profile, isProfileLoading, navigate]);

  // Check push notification status
  useEffect(() => {
    const checkPushNotificationStatus = async () => {
      if (!('serviceWorker' in navigator) || localStorage.getItem("blobbiPushDontAskAgain") === "1") {
        return;
      }

      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();

        if (sub) {
          if (!localStorage.getItem("blobbiPushEnabledAt")) {
            localStorage.setItem("blobbiPushEnabledAt", new Date().toISOString());
          }
          return;
        }

        setShowPushModal(true);
      } catch (error) {
        console.error("Error checking push notification status:", error);
      }
    };

    checkPushNotificationStatus();
  }, []);

  // Check if we should show welcome modal
  useEffect(() => {
    if (user && !isProfileLoading && !profile?.onboardingDone) {
      setShowWelcomeModal(true);
    }
  }, [user, profile, isProfileLoading]);

  // Memoized computations - called before any conditional returns
  const filteredBlobbis = useMemo(() => {
    return userBlobbis.filter(blobbi => {
      if (filter === 'all') return true;
      if (filter === 'active') return blobbi.state === 'active' && blobbi.lifeStage !== 'egg';
      if (filter === 'incubating') return blobbi.lifeStage === 'egg';
      if (filter === 'evolved') return blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi';
      if (filter === 'archived') return blobbi.state === 'hibernating';
      return true;
    }).filter(blobbi =>
      searchQuery === '' ||
      blobbi.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [userBlobbis, filter, searchQuery]);

  const stats = useMemo(() => ({
    totalBlobbis: userBlobbis.length,
    activeBlobbis: userBlobbis.filter(b => b.state === 'active').length,
    incubatingBlobbis: userBlobbis.filter(b => b.lifeStage === 'egg').length,
    evolvedBlobbis: userBlobbis.filter(b => b.evolutionForm && b.evolutionForm !== 'blobbi').length,
    totalCoins: coinBalance?.balance || profile?.coins || 0,
    totalExperience: userBlobbis.reduce((sum, b) => sum + b.experience, 0),
    achievements: profile?.achievements.length || 0,
    careStreak: Math.max(...userBlobbis.map(b => b.careStreak || 0), 0),
  }), [userBlobbis, coinBalance, profile]);

  const recentActivity = useMemo(() =>
    userBlobbis
      .map(blobbi => ({
        blobbi,
        lastActivity: blobbi.lastInteraction * 1000,
        type: (blobbi.lifeStage === 'egg' ? 'incubating' : 'interaction') as 'incubating' | 'interaction'
      }))
      .sort((a, b) => b.lastActivity - a.lastActivity)
      .slice(0, 5),
    [userBlobbis]
  );

  // Conditional returns
  if (!user) return <DashboardNotLoggedIn />;
  if (user && isProfileLoading) return <DashboardLoading />;
  if (user && !profile) return <DashboardLoading />;

  return (
    <BlobbiLayout>
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
        <div className="container mx-auto pt-2 pb-8 px-4">
          <div className="grid lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <BlobbiDashboardSidebar
                missions={missions}
                stats={stats}
                claimMission1={() => claimMission1()}
                claimMission2={() => claimMission2()}
                claimBonus={() => claimBonus()}
                isClaiming={isClaiming}
                onShopOpen={() => setIsShopOpen(true)}
                onBuyCoins={() => setIsBuyCoinsModalOpen(true)}
                onStorageOpen={() => setIsStorageOpen(true)}
                onTabChange={setActiveTab}
              />
            </div>

            <div className="lg:col-span-3">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <BlobbiDashboardTabsHeader
                  activeTab={activeTab}
                  onChange={setActiveTab}
                />

                <TabsContent value="blobbis" className="space-y-6">
                  <BlobbisTab
                    filteredBlobbis={filteredBlobbis}
                    userBlobbis={userBlobbis}
                    filter={filter}
                    setFilter={setFilter}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    navigate={navigate}
                  />
                </TabsContent>

                <TabsContent value="missions">
                  <MissionsTab />
                </TabsContent>

                <TabsContent value="incubation">
                  <IncubationTab />
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <DashboardModals
            showWelcomeModal={showWelcomeModal}
            setShowWelcomeModal={setShowWelcomeModal}
            isTourActive={isTourActive}
            setIsTourActive={setIsTourActive}
            showTourCompletionModal={showTourCompletionModal}
            setShowTourCompletionModal={setShowTourCompletionModal}
            showPushModal={showPushModal}
            setShowPushModal={setShowPushModal}
            isShopOpen={isShopOpen}
            setIsShopOpen={setIsShopOpen}
            isStorageOpen={isStorageOpen}
            setIsStorageOpen={setIsStorageOpen}
            isBuyCoinsModalOpen={isBuyCoinsModalOpen}
            setIsBuyCoinsModalOpen={setIsBuyCoinsModalOpen}
            setActiveTab={setActiveTab}
          />
        </div>
      </div>
    </BlobbiLayout>
  );
}