import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BlobbiDashboardTabsHeaderProps {
  activeTab: string;
  onChange: (tab: string) => void;
}

export function BlobbiDashboardTabsHeader({
  activeTab,
  onChange,
}: BlobbiDashboardTabsHeaderProps) {
  return (
    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
      <CardContent className="p-2">
        <TabsList className="flex flex-wrap justify-center items-center gap-1 bg-purple-50/50 dark:bg-purple-900/20 p-1 rounded-lg h-auto min-h-10">
          <TabsTrigger
            value="blobbis"
            id="tab-my-blobbies"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-md text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-md"
          >
            My Blobbies
          </TabsTrigger>
          <TabsTrigger
            value="missions"
            id="tab-missions"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-md text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-md"
          >
            Missions
          </TabsTrigger>
          <TabsTrigger
            value="incubation"
            id="tab-growth-hub"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-md text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-md"
          >
            Growth Hub
          </TabsTrigger>
        </TabsList>
      </CardContent>
    </Card>
  );
}