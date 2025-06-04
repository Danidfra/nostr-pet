import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Calendar, TrendingUp, Clock } from 'lucide-react';
import { BlobbiEvolutionProgress } from '@/types/blobbi';
import { getEvolutionReadinessMessage, getCareStreakStatus } from '@/lib/blobbi-evolution';

interface EvolutionProgressProps {
  evolutionProgress: BlobbiEvolutionProgress;
  hasEvolved: boolean;
}

export function EvolutionProgress({ evolutionProgress, hasEvolved }: EvolutionProgressProps) {
  const streakStatus = getCareStreakStatus(evolutionProgress);
  const progressPercentage = Math.min(100, (evolutionProgress.currentStreak / 4) * 100);
  const readinessMessage = getEvolutionReadinessMessage(evolutionProgress);

  if (hasEvolved) {
    return (
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Evolution Complete!
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300">
            Your Blobbi has evolved after {evolutionProgress.totalCareDays} days of loving care!
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <Sparkles className="w-5 h-5 text-purple-500" />
          Evolution Progress
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-300">{readinessMessage}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Care Streak Progress</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{evolutionProgress.currentStreak}/4 days</span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Current Streak */}
          <div className="space-y-1 p-3 border border-purple-200 dark:border-purple-600 rounded-lg bg-purple-50/50 dark:bg-purple-900/20">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              Current Streak
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{evolutionProgress.currentStreak}</span>
              <Badge 
                variant={streakStatus.isActive ? "default" : "secondary"}
                className={streakStatus.isActive ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"}
              >
                {streakStatus.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          {/* Total Care Days */}
          <div className="space-y-1 p-3 border border-purple-200 dark:border-purple-600 rounded-lg bg-purple-50/50 dark:bg-purple-900/20">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Calendar className="w-4 h-4 text-purple-500" />
              Total Care Days
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{evolutionProgress.totalCareDays}</div>
          </div>
        </div>

        {/* Streak Status Message */}
        <div className="flex items-center gap-2 p-3 bg-purple-50/50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-600 rounded-lg">
          <Clock className="w-4 h-4 text-purple-500" />
          <p className="text-sm text-gray-700 dark:text-gray-300">{streakStatus.message}</p>
        </div>

        {/* Evolution Ready Badge */}
        {evolutionProgress.isEligibleForEvolution && (
          <div className="flex justify-center pt-2">
            <Badge variant="default" className="gap-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
              <Sparkles className="w-3 h-3" />
              Ready to Evolve!
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}