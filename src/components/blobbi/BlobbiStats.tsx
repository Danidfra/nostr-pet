import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BlobbiStats as Stats, BlobbiLifeStage, Blobbi } from '@/types/blobbi';
import { Heart, Utensils, Zap, Sparkles, Smile, Thermometer, Shield, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlobbiStatsProps {
  stats: Stats;
  lifeStage: BlobbiLifeStage;
  blobbi?: Blobbi; // Optional blobbi object for egg-specific properties
  className?: string;
}

export function BlobbiStats({ stats, lifeStage, blobbi, className }: BlobbiStatsProps) {
  // Get egg temperature, default to 50 if not available
  const eggTemperature = blobbi?.eggTemperature ?? 50;
  // Get shell integrity, default to 100 if not available
  const shellIntegrity = blobbi?.shellIntegrity ?? 100;
  
  // Define stats for egg stage
  const eggStatConfig = [
    {
      name: 'Warmth',
      value: eggTemperature, // Use eggTemperature for warmth
      icon: Thermometer,
      color: 'bg-orange-500/80',
      lowThreshold: 30,
      description: eggTemperature < 30 ? 'Too cold!' : eggTemperature > 70 ? 'Nice and warm' : 'Getting chilly',
    },
    {
      name: 'Cleanliness',
      value: stats.hygiene,
      icon: Sparkles,
      color: 'bg-purple-500/80',
      lowThreshold: 30,
      description: stats.hygiene < 30 ? 'Shell needs cleaning!' : stats.hygiene > 70 ? 'Pristine shell' : 'Shell getting dusty',
    },
    {
      name: 'Happiness',
      value: stats.happiness,
      icon: Smile,
      color: 'bg-yellow-500/80',
      lowThreshold: 30,
      description: stats.happiness < 30 ? 'Feeling lonely' : stats.happiness > 70 ? 'Content and loved' : 'Needs attention',
    },
    {
      name: 'Health',
      value: shellIntegrity, // Use shellIntegrity for health in egg stage
      icon: Shield,
      color: 'bg-green-500/80',
      lowThreshold: 30,
      description: shellIntegrity < 30 ? 'Shell is weak!' : shellIntegrity > 70 ? 'Strong shell' : 'Shell showing wear',
    },
  ];

  // Define stats for baby and adult stages
  const normalStatConfig = [
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
      name: 'Hygiene',
      value: stats.hygiene,
      icon: Sparkles,
      color: 'bg-purple-500/80',
      lowThreshold: 30,
      description: stats.hygiene < 30 ? 'Needs a bath!' : stats.hygiene > 70 ? 'Squeaky clean' : 'Getting dirty',
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

  // Choose the appropriate stat configuration based on life stage
  const statConfig = lifeStage === 'egg' ? eggStatConfig : normalStatConfig;

  return (
    <Card className={cn("bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Stats
        </CardTitle>
        <CardDescription>
          {lifeStage === 'egg' ? 'Monitor your egg\'s development' : 'Keep track of your Blobbi\'s wellbeing'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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