import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Trophy,
  Egg,
  Activity,
  Sparkles,
} from 'lucide-react';

interface StatsTabProps {
  stats: {
    totalBlobbis: number;
    activeBlobbis: number;
    incubatingBlobbis: number;
    evolvedBlobbis: number;
    totalCoins: number;
    totalExperience: number;
    achievements: number;
    careStreak: number;
  };
  profile: {
    achievements?: string[];
  } | null;
  progress: {
    egg: {
      completed: number;
      total: number;
      percentage: number;
    };
    evolution: {
      completed: number;
      total: number;
      percentage: number;
    };
  };
  isReadyToHatch: boolean;
  isReadyToEvolve: boolean;
}

export function StatsTab({
  stats,
  profile,
  progress,
  isReadyToHatch,
  isReadyToEvolve,
}: StatsTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <BarChart3 className="w-5 h-5" />
              Blobbi Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Blobbis</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">{stats.totalBlobbis}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Active Blobbis</span>
              <span className="font-bold text-green-600 dark:text-green-400">{stats.activeBlobbis}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Incubating</span>
              <span className="font-bold text-yellow-600 dark:text-yellow-400">{stats.incubatingBlobbis}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Evolved</span>
              <span className="font-bold text-purple-600 dark:text-purple-400">{stats.evolvedBlobbis}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Experience</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">{stats.totalExperience.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Care Streak</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{stats.careStreak} days</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Trophy className="w-5 h-5" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Achievements</span>
                <span className="font-bold text-gray-900 dark:text-gray-100">{stats.achievements}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Coins Earned</span>
                <span className="font-bold text-yellow-600 dark:text-yellow-400">{stats.totalCoins.toLocaleString()}</span>
              </div>
              {profile?.achievements && profile.achievements.length > 0 && (
                <div className="pt-2">
                  <div className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Recent Achievements:</div>
                  <div className="flex flex-wrap gap-1">
                    {profile.achievements.slice(0, 6).map((achievement, index) => (
                      <Badge key={index} variant="outline" className="text-xs border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300">
                        {achievement.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Evolution Progress Summary */}
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Evolution Progress Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Egg Hatching Progress</h4>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                {progress.egg.completed}/{progress.egg.total}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {progress.egg.percentage.toFixed(1)}% complete
              </div>
              {isReadyToHatch && (
                <Badge className="mt-2 bg-green-600">Ready to Hatch!</Badge>
              )}
            </div>
            <div>
              <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Evolution Progress</h4>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                {progress.evolution.completed}/{progress.evolution.total}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {progress.evolution.percentage.toFixed(1)}% complete
              </div>
              {isReadyToEvolve && (
                <Badge className="mt-2 bg-purple-600">Ready to Evolve!</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}