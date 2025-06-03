import { BlobbiIncubationDashboard } from '@/components/blobbi/BlobbiIncubationDashboard';
import { BlobbiLayout } from '@/components/BlobbiLayout';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function BlobbiIncubation() {
  const { user } = useCurrentUser();

  return (
    <BlobbiLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">🐣 Blobbi Incubation System</h1>
            <p className="text-muted-foreground">
              Track your Blobbi's growth through Nostr interactions
            </p>
          </div>

          {/* Login Area */}
          {!user && (
            <div className="flex justify-center">
              <LoginArea />
            </div>
          )}

          {/* Dashboard */}
          {user ? (
            <BlobbiIncubationDashboard />
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Please log in to view your Blobbi incubation progress.
              </p>
            </div>
          )}
        </div>
      </div>
    </BlobbiLayout>
  );
}