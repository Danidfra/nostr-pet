import { BlobbiLayout } from '@/components/BlobbiLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LoginArea } from '@/components/auth/LoginArea';

export function DashboardNotLoggedIn() {
  return (
    <BlobbiLayout>
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
        <div className="container mx-auto py-8 px-4">
          <Card className="max-w-2xl mx-auto bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-gray-100">Welcome to Blobbi!</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">
                Log in with your Nostr account to access your Blobbi dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="text-center space-y-2">
                <p className="text-gray-600 dark:text-gray-300">
                  Manage your virtual pets, track their evolution, and explore the Blobbi community.
                </p>
              </div>
              <LoginArea />
            </CardContent>
          </Card>
        </div>
      </div>
    </BlobbiLayout>
  );
}