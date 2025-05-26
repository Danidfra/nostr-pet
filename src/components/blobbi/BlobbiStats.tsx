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
      color: 'bg-orange-500',
      lowThreshold: 30,
      description: stats.hunger < 30 ? 'Very hungry!' : stats.hunger > 70 ? 'Well fed' : 'Getting hungry',
    },
    {
      name: 'Happiness',
      value: stats.happiness,
      icon: Smile,
      color: 'bg-yellow-500',
      lowThreshold: 30,
      description: stats.happiness < 30 ? 'Feeling sad' : stats.happiness > 70 ? 'Very happy!' : 'Content',
    },
    {
      name: 'Energy',
      value: stats.energy,
      icon: Zap,
      color: 'bg-blue-500',
      lowThreshold: 30,
      description: stats.energy < 30 ? 'Very tired' : stats.energy > 70 ? 'Full of energy!' : 'Getting sleepy',
    },
    {
      name: 'Cleanliness',
      value: stats.cleanliness,
      icon: Sparkles,
      color: 'bg-purple-500',
      lowThreshold: 30,
      description: stats.cleanliness < 30 ? 'Needs a bath!' : stats.cleanliness > 70 ? 'Squeaky clean' : 'Getting dirty',
    },
    {
      name: 'Health',
      value: stats.health,
      icon: Heart,
      color: 'bg-red-500',
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
                  <Icon className={`w-4 h-4 ${isLow ? 'text-red-500 animate-pulse' : ''}`} />
                  <span className="font-medium">{stat.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{stat.description}</span>
              </div>
              <div className="relative">
                <Progress 
                  value={stat.value} 
                  className="h-2"
                />
                <div 
                  className={`absolute top-0 left-0 h-full ${stat.color} transition-all duration-300`}
                  style={{ width: `${stat.value}%`, opacity: 0.8 }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}