import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BlobbiGame } from '@/components/blobbi/BlobbiGame';
import { DailyCheckIn } from '@/components/blobbi/DailyCheckIn';
import { BlobbonautProfileCard } from '@/components/blobbi/BlobbonautProfileCard';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBlobbiWithFakeStatus } from '@/hooks/useBlobbiWithFakeStatus';
import { ThemeToggle } from '@/components/theme-toggle';
import { SettingsButton } from '@/components/SettingsButton';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { EnablePushModal } from '@/components/EnablePushModal';

export default function Blobbi() {
  const { user } = useCurrentUser();
  const { blobbi } = useBlobbiWithFakeStatus();
  const [showPushModal, setShowPushModal] = useState(false);

  useEffect(() => {
    const checkPushNotificationStatus = async () => {
      // Check if service worker is not available
      if (!('serviceWorker' in navigator)) {
        return;
      }

      // Check if user has chosen "Don't ask again"
      if (localStorage.getItem("blobbiPushDontAskAgain") === "1") {
        return;
      }

      try {
        // Check if service worker is ready and get existing subscription
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();

        if (sub) {
          // Subscription exists, set enabled timestamp if not already set
          if (!localStorage.getItem("blobbiPushEnabledAt")) {
            localStorage.setItem("blobbiPushEnabledAt", new Date().toISOString());
          }
          // Don't show modal if subscription exists
          return;
        }

        // No subscription exists, show the modal
        setShowPushModal(true);
      } catch (error) {
        console.error("Error checking push notification status:", error);
        // If there's an error (e.g., service worker not available), don't show modal
      }
    };

    checkPushNotificationStatus();
  }, []); // Run only on mount

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Blobbi</h1>
        <div className="flex items-center gap-2">
          <SettingsButton />
          <ThemeToggle />
          <LoginArea />
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <BlobbiGame />
        </div>

        {/* Sidebar */}
        {user && (
          <div className="space-y-4">
            {/* Blobbanaut Profile */}
            <BlobbonautProfileCard />

            {blobbi && <DailyCheckIn />}

            <Link to="/blobbi/evolution">
              <Button variant="outline" className="w-full gap-2">
                <Sparkles className="w-4 h-4" />
                Evolution Guide
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Push Notification Modal */}
      <EnablePushModal
        open={showPushModal}
        onClose={() => setShowPushModal(false)}
      />
    </div>
  );
}