import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Blobbi } from '@/types/blobbi';
import { getDecaySummary, getTimeToNextCritical } from '@/lib/blobbi-decay';
import { AlertTriangle, Clock, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlobbiStatusDecayProps {
  blobbi: Blobbi;
  className?: string;
}

export function BlobbiStatusDecay({ blobbi, className }: BlobbiStatusDecayProps) {
  const hoursSinceLastInteraction = (Date.now() / 1000 - blobbi.lastInteraction) / (60 * 60);
  const decaySummary = getDecaySummary(blobbi, hoursSinceLastInteraction);
  const nextCritical = getTimeToNextCritical(blobbi);

  const getStatColor = (value: number) => {
    if (value >= 80) return 'text-green-600';
    if (value >= 50) return 'text-yellow-600';
    if (value >= 30) return 'text-orange-600';
    return 'text-red-600';
  };

  const formatTime = (hours: number) => {
    if (hours < 1) {
      const minutes = Math.floor(hours * 60);
      return `${minutes}m`;
    }
    if (hours < 24) {
      return `${Math.floor(hours)}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  };

  const renderEggStats = () => (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Warmth</span>
          <span className={cn("text-sm font-bold", getStatColor(blobbi.eggTemperature ?? 100))}>
            {blobbi.eggTemperature ?? 100}%
          </span>
        </div>
        <Progress 
          value={blobbi.eggTemperature ?? 100} 
          className="h-2"
        />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Cleanliness</span>
          <span className={cn("text-sm font-bold", getStatColor(blobbi.stats.hygiene))}>
            {blobbi.stats.hygiene}%
          </span>
        </div>
        <Progress 
          value={blobbi.stats.hygiene} 
          className="h-2"
        />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Happiness</span>
          <span className={cn("text-sm font-bold", getStatColor(blobbi.stats.happiness))}>
            {blobbi.stats.happiness}%
          </span>
        </div>
        <Progress 
          value={blobbi.stats.happiness} 
          className="h-2"
        />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Shell Health</span>
          <span className={cn("text-sm font-bold", getStatColor(blobbi.shellIntegrity ?? 100))}>
            {blobbi.shellIntegrity ?? 100}%
          </span>
        </div>
        <Progress 
          value={blobbi.shellIntegrity ?? 100} 
          className="h-2"
        />
      </div>
    </div>
  );

  const renderPostHatchStats = () => (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Hunger</span>
          <span className={cn("text-sm font-bold", getStatColor(blobbi.stats.hunger))}>
            {blobbi.stats.hunger}%
          </span>
        </div>
        <Progress 
          value={blobbi.stats.hunger} 
          className="h-2"
        />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Happiness</span>
          <span className={cn("text-sm font-bold", getStatColor(blobbi.stats.happiness))}>
            {blobbi.stats.happiness}%
          </span>
        </div>
        <Progress 
          value={blobbi.stats.happiness} 
          className="h-2"
        />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Energy</span>
          <span className={cn("text-sm font-bold", getStatColor(blobbi.stats.energy))}>
            {blobbi.stats.energy}%
          </span>
        </div>
        <Progress 
          value={blobbi.stats.energy} 
          className="h-2"
        />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Hygiene</span>
          <span className={cn("text-sm font-bold", getStatColor(blobbi.stats.hygiene))}>
            {blobbi.stats.hygiene}%
          </span>
        </div>
        <Progress 
          value={blobbi.stats.hygiene} 
          className="h-2"
        />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Health</span>
          <span className={cn("text-sm font-bold", getStatColor(blobbi.stats.health))}>
            {blobbi.stats.health}%
          </span>
        </div>
        <Progress 
          value={blobbi.stats.health} 
          className="h-2"
        />
      </div>
    </div>
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingDown className="w-5 h-5" />
          Status & Decay
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Stats */}
        {blobbi.lifeStage === 'egg' ? renderEggStats() : renderPostHatchStats()}

        {/* Decay Information */}
        <div className="pt-3 border-t space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Last interaction: {formatTime(hoursSinceLastInteraction)} ago</span>
          </div>

          {/* Warnings */}
          {decaySummary.warnings.length > 0 && (
            <div className="space-y-2">
              {decaySummary.warnings.map((warning, index) => (
                <Badge key={index} variant="destructive" className="flex items-center gap-1 w-fit">
                  <AlertTriangle className="w-3 h-3" />
                  {warning}
                </Badge>
              ))}
            </div>
          )}

          {/* Next Critical Threshold */}
          {nextCritical && (
            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="text-sm font-medium text-yellow-800">
                Next Critical: {nextCritical.stat}
              </div>
              <div className="text-xs text-yellow-600">
                Will reach {nextCritical.threshold}% in {formatTime(nextCritical.hoursUntilCritical)}
              </div>
            </div>
          )}

          {/* Decay Rates */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Decay Rates (per hour):</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(decaySummary.decayRates).map(([stat, rate]) => (
                <div key={stat} className="flex justify-between">
                  <span className="capitalize">{stat}:</span>
                  <span className={rate < 0 ? 'text-red-600' : 'text-green-600'}>
                    {rate > 0 ? '+' : ''}{rate}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Care Recommendations */}
          {blobbi.state !== 'hibernating' && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
              <div className="text-sm font-medium text-blue-800">
                Care Recommendations:
              </div>
              <div className="text-xs text-blue-600">
                {blobbi.lifeStage === 'egg' 
                  ? 'Interact 2-3 times daily (minimum once every 12 hours)'
                  : 'Interact at least 2 times daily'
                }
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}