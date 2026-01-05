import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Blobbi } from '@/types/blobbi';
import { Heart, Utensils, Zap, Sparkles, Smile, Thermometer, Shield, BarChart3, Trophy, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  blobbi: Blobbi;
}

export function StatsModal({ isOpen, onClose, blobbi }: StatsModalProps) {
  const { stats, lifeStage } = blobbi;
  const eggTemperature = blobbi?.eggTemperature ?? 50;
  const shellIntegrity = blobbi?.shellIntegrity ?? 100;

  // Define stats configuration based on life stage
  const statConfig = lifeStage === 'egg' ? [
    {
      name: 'Warmth',
      value: eggTemperature,
      icon: Thermometer,
      gradient: 'from-orange-500 to-amber-500',
      description: eggTemperature < 30 ? 'Too cold!' : eggTemperature > 70 ? 'Nice and warm' : 'Getting chilly',
    },
    {
      name: 'Cleanliness',
      value: stats.hygiene,
      icon: Sparkles,
      gradient: 'from-purple-500 to-pink-500',
      description: stats.hygiene < 30 ? 'Shell needs cleaning!' : stats.hygiene > 70 ? 'Pristine shell' : 'Shell getting dusty',
    },
    {
      name: 'Happiness',
      value: stats.happiness,
      icon: Smile,
      gradient: 'from-yellow-500 to-amber-500',
      description: stats.happiness < 30 ? 'Feeling lonely' : stats.happiness > 70 ? 'Content and loved' : 'Needs attention',
    },
    {
      name: 'Health',
      value: shellIntegrity,
      icon: Shield,
      gradient: 'from-green-500 to-emerald-500',
      description: shellIntegrity < 30 ? 'Shell is fragile!' : shellIntegrity > 70 ? 'Strong shell' : 'Shell weakening',
    },
  ] : [
    {
      name: 'Health',
      value: stats.health,
      icon: Heart,
      gradient: 'from-red-500 to-rose-500',
      description: stats.health < 30 ? 'Needs care!' : stats.health > 70 ? 'Healthy' : 'Getting sick',
    },
    {
      name: 'Hunger',
      value: stats.hunger,
      icon: Utensils,
      gradient: 'from-orange-500 to-amber-500',
      description: stats.hunger < 30 ? 'Very hungry!' : stats.hunger > 70 ? 'Well fed' : 'Getting hungry',
    },
    {
      name: 'Happiness',
      value: stats.happiness,
      icon: Smile,
      gradient: 'from-yellow-500 to-amber-500',
      description: stats.happiness < 30 ? 'Feeling sad' : stats.happiness > 70 ? 'Very happy' : 'Needs fun',
    },
    {
      name: 'Energy',
      value: stats.energy,
      icon: Zap,
      gradient: 'from-blue-500 to-cyan-500',
      description: stats.energy < 30 ? 'Exhausted' : stats.energy > 70 ? 'Energetic' : 'Getting tired',
    },
    {
      name: 'Hygiene',
      value: stats.hygiene,
      icon: Sparkles,
      gradient: 'from-purple-500 to-pink-500',
      description: stats.hygiene < 30 ? 'Very dirty!' : stats.hygiene > 70 ? 'Clean' : 'Getting dirty',
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center justify-between text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            <span className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </div>
              <span>Stats</span>
            </span>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-full border border-yellow-200 dark:border-yellow-700">
                <Coins className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                <span className="font-semibold text-yellow-700 dark:text-yellow-300">{blobbi.coins}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full border border-purple-200 dark:border-purple-700">
                <Trophy className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span className="font-semibold text-purple-700 dark:text-purple-300">{blobbi.experience}</span>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pb-2">
          {statConfig.map(({ name, value, icon: Icon, gradient, description }) => (
            <div
              key={name}
              className="group relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-800/80 dark:to-gray-800/40 border border-purple-200/50 dark:border-purple-600/50 hover:border-purple-300 dark:hover:border-purple-500 transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br",
                    gradient
                  )}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{name}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{description}</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}%</span>
              </div>
              <Progress 
                value={value} 
                className="h-2"
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
