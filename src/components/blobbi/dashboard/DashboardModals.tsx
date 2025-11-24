import { BuyCoinsModal } from '@/components/blobbi/BuyCoinsModal';
import { BlobbiShop } from '@/components/blobbi/BlobbiShop';
import { BlobbiStorage } from '@/components/blobbi/BlobbiStorage';
import { WelcomeModal } from '@/components/WelcomeModal';
import { EnablePushModal } from '@/components/EnablePushModal';
import { BlobbiTour } from '@/components/BlobbiTour';
import { TourCompletionModal } from '@/components/TourCompletionModal';

interface DashboardModalsProps {
  showWelcomeModal: boolean;
  setShowWelcomeModal: (show: boolean) => void;
  isTourActive: boolean;
  setIsTourActive: (active: boolean) => void;
  showTourCompletionModal: boolean;
  setShowTourCompletionModal: (show: boolean) => void;
  showPushModal: boolean;
  setShowPushModal: (show: boolean) => void;
  isShopOpen: boolean;
  setIsShopOpen: (open: boolean) => void;
  isStorageOpen: boolean;
  setIsStorageOpen: (open: boolean) => void;
  isBuyCoinsModalOpen: boolean;
  setIsBuyCoinsModalOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
}

export function DashboardModals({
  showWelcomeModal,
  setShowWelcomeModal,
  isTourActive,
  setIsTourActive,
  showTourCompletionModal,
  setShowTourCompletionModal,
  showPushModal,
  setShowPushModal,
  isShopOpen,
  setIsShopOpen,
  isStorageOpen,
  setIsStorageOpen,
  isBuyCoinsModalOpen,
  setIsBuyCoinsModalOpen,
  setActiveTab,
}: DashboardModalsProps) {
  return (
    <>
      <BlobbiShop isOpen={isShopOpen} onClose={() => setIsShopOpen(false)} />
      <BlobbiStorage isOpen={isStorageOpen} onClose={() => setIsStorageOpen(false)} />

      {/* Buy Coins Modal */}
      <BuyCoinsModal
        isOpen={isBuyCoinsModalOpen}
        onClose={() => setIsBuyCoinsModalOpen(false)}
      />

      {/* Push Notification Modal */}
      <EnablePushModal
        open={showPushModal}
        onClose={() => setShowPushModal(false)}
      />

      {/* Welcome Modal */}
      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
        onStartTour={() => {
          setShowWelcomeModal(false);
          setIsTourActive(true);
        }}
      />

      {/* Blobbi Tour */}
      <BlobbiTour
        isOpen={isTourActive}
        onClose={() => setIsTourActive(false)}
        onComplete={() => {
          // Show tour completion modal when main tour completes
          setShowTourCompletionModal(true);
        }}
        setActiveTab={setActiveTab}
      />

      {/* Tour Completion Modal */}
      <TourCompletionModal
        isOpen={showTourCompletionModal}
        onClose={() => setShowTourCompletionModal(false)}
      />
    </>
  );
}