import { BlobbiLayout } from '@/components/BlobbiLayout';
import { Card, CardContent } from '@/components/ui/card';

export function DashboardLoading() {
  return (
    <BlobbiLayout>
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
        <div className="container mx-auto py-8 px-4">
          <Card className="max-w-2xl mx-auto bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
            <CardContent className="p-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </BlobbiLayout>
  );
}