import { BlobbiIncubationDashboard } from '@/components/blobbi/BlobbiIncubationDashboard';
import { BlobbiLayout } from '@/components/BlobbiLayout';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { AppHeader } from '@/components/AppHeader';

export function BlobbiIncubation() {
  const { user } = useCurrentUser();

  return (
    <BlobbiLayout>
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="space-y-6">
            {/* Header */}
            <AppHeader 
              title="🐣 Blobbi Incubation System"
              subtitle="Track your Blobbi's growth through Nostr interactions"
              className="text-center"
            />

            {/* Dashboard */}
            {user ? (
              <BlobbiIncubationDashboard />
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-300">
                  Please log in to view your Blobbi incubation progress.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </BlobbiLayout>
  );
}