import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { BlobbiStats as Stats } from '@/types/blobbi';
import { Heart, Utensils, Zap, Sparkles, Smile } from 'lucide-react';

interface BlobbiStatsProps {
  stats: Stats;
  className?: string;
}

export function BlobbiStats({ stats, className }: BlobbiStatsProps) {
  const statConfig = [
    {
      name: 'Hunger',
      value: stats.hunger,
      icon: Utensils,
      color: 'bg-orange-500/80',
      lowThreshold: 30,
      description: stats.hunger < 30 ? 'Very hungry!' : stats.hunger > 70 ? 'Well fed' : 'Getting hungry',
    },
    {
      name: 'Happiness',
      value: stats.happiness,
      icon: Smile,
      color: 'bg-yellow-500/80',
      lowThreshold: 30,
      description: stats.happiness < 30 ? 'Feeling sad' : stats.happiness > 70 ? 'Very happy!' : 'Content',
    },
    {
      name: 'Energy',
      value: stats.energy,
      icon: Zap,
      color: 'bg-blue-500/80',
      lowThreshold: 30,
      description: stats.energy < 30 ? 'Very tired' : stats.energy > 70 ? 'Full of energy!' : 'Getting sleepy',
    },
    {
      name: 'Cleanliness',
      value: stats.cleanliness,
      icon: Sparkles,
      color: 'bg-purple-500/80',
      lowThreshold: 30,
      description: stats.cleanliness < 30 ? 'Needs a bath!' : stats.cleanliness > 70 ? 'Squeaky clean' : 'Getting dirty',
    },
    {
      name: 'Health',
      value: stats.health,
      icon: Heart,
      color: 'bg-red-500/80',
      lowThreshold: 30,
      description: stats.health < 30 ? 'Feeling sick' : stats.health > 70 ? 'Very healthy!' : 'Doing okay',
    },
  ];

  return (
    <Card className={className}>
      <CardContent className="p-4 space-y-3">
        {statConfig.map((stat) => {
          const Icon = stat.icon;
          const isLow = stat.value < stat.lowThreshold;
          
          return (
            <div key={stat.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${isLow ? 'text-red-500 animate-pulse' : 'text-foreground/70'}`} />
                  <span className="font-medium text-foreground/80">{stat.name}</span>
                  <span className="text-xs text-muted-foreground/70">
                    {Math.round(stat.value)}/100
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{stat.description}</span>
              </div>
              <div className="relative">
                <div className="w-full bg-secondary/50 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`h-full ${stat.color} transition-all duration-300`}
                    style={{ width: `${stat.value}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}