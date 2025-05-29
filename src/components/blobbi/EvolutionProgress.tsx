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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Evolution Complete!
          </CardTitle>
          <CardDescription>
            Your Blobbi has evolved after {evolutionProgress.totalCareDays} days of loving care!
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Evolution Progress
        </CardTitle>
        <CardDescription>{readinessMessage}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Care Streak Progress</span>
            <span className="font-medium">{evolutionProgress.currentStreak}/4 days</span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Current Streak */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              Current Streak
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{evolutionProgress.currentStreak}</span>
              <Badge variant={streakStatus.isActive ? "default" : "secondary"}>
                {streakStatus.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          {/* Total Care Days */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              Total Care Days
            </div>
            <div className="text-2xl font-bold">{evolutionProgress.totalCareDays}</div>
          </div>
        </div>

        {/* Streak Status Message */}
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm">{streakStatus.message}</p>
        </div>

        {/* Evolution Ready Badge */}
        {evolutionProgress.isEligibleForEvolution && (
          <div className="flex justify-center pt-2">
            <Badge variant="default" className="gap-1">
              <Sparkles className="w-3 h-3" />
              Ready to Evolve!
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}