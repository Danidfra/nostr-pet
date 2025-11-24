import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BlobbiCard } from '@/components/blobbi/BlobbiCard';
import { formatDistanceToNow } from 'date-fns';
import { Blobbi } from '@/types/blobbi';

interface ActivityTabProps {
  recentActivity: {
    blobbi: Blobbi;
    lastActivity: number;
    type: 'incubating' | 'interaction';
  }[];
  navigate: (path: string) => void;
}

export function ActivityTab({ recentActivity, navigate }: ActivityTabProps) {
  return (
    <div className="space-y-6">
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Activity Feed</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300">
            Recent interactions and events with your Blobbis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentActivity.map(({ blobbi, lastActivity, type }) => (
              <div key={blobbi.id} className="relative">
                <BlobbiCard
                  blobbi={blobbi}
                  size="md"
                  onClick={() => navigate(`/blobbi/${blobbi.id}`)}
                  showStats={true}
                  showStatus={true}
                  showActions={true}
                  onViewDetails={() => navigate(`/blobbi/${blobbi.id}`)}
                  className="h-full"
                  footerContent={
                    <div className="text-xs text-gray-600 dark:text-gray-400 text-center bg-purple-50/50 dark:bg-purple-900/20 rounded-lg p-2">
                      Last activity: {formatDistanceToNow(lastActivity, { addSuffix: true })}
                    </div>
                  }
                />
                {/* Activity Overlay */}
                <div className="absolute top-2 right-2 z-10">
                  <Badge
                    variant="secondary"
                    className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300 text-xs"
                  >
                    {type === 'incubating' ? 'Incubating' : 'Active'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          {recentActivity.length === 0 && (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              No recent activity to show.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}