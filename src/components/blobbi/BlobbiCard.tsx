import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BlobbiVisual } from './BlobbiVisual';
import { BlobbiEvolvedVisual } from './BlobbiEvolvedVisual';
import { EggGraphic } from './EggGraphic';
import { Blobbi } from '@/types/blobbi';
import { formatDistanceToNow } from 'date-fns';
import { Heart, Sparkles, Zap, Smile } from 'lucide-react';
import { getBlobbiMood } from '@/lib/blobbi';
import { cn } from '@/lib/utils';
import { isValidSize } from '@/lib/blobbi-egg-validation';

interface BlobbiCardProps {
  blobbi: Blobbi;
  onClick?: () => void;
  showStats?: boolean;
  showRank?: number;
  className?: string;
}

export function BlobbiCard({ 
  blobbi, 
  onClick, 
  showStats = true,
  showRank,
  className 
}: BlobbiCardProps) {
  const mood = getBlobbiMood(blobbi.stats, blobbi.state);
  const overallHealth = Math.round(
    (blobbi.stats.health + blobbi.stats.happiness + blobbi.stats.energy + blobbi.stats.hygiene) / 4
  );
  
  // Helper function to get valid size for components
  const getValidSize = (size?: string): 'tiny' | 'small' | 'medium' | 'large' => {
    if (size && isValidSize(size)) {
      return size as 'tiny' | 'small' | 'medium' | 'large';
    }
    return 'medium'; // Default fallback
  };

  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-lg transition-all duration-300 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{blobbi.name}</CardTitle>
          {showRank && (
            <Badge variant="default" className="text-xs">
              #{showRank}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            {blobbi.lifeStage}
          </Badge>
          <span>•</span>
          <span>{formatDistanceToNow(blobbi.birthTime)} old</span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Fixed size container for Blobbi visual - matching egg-demo style */}
        <div className="flex items-center justify-center transition-all duration-500 min-h-[380px] p-12 bg-gradient-to-br from-purple-50/60 to-pink-50/60 rounded-3xl border-2 border-purple-100/50 mb-4">
          {blobbi.lifeStage === 'egg' ? (
            <EggGraphic 
              blobbi={blobbi}
              size={getValidSize(blobbi.size)} 
              animated={true}
              warmth={blobbi.eggTemperature || 60}
            />
          ) : blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi' ? (
            <BlobbiEvolvedVisual 
              blobbi={blobbi} 
              size={getValidSize(blobbi.size)}
            />
          ) : (
            <BlobbiVisual 
              blobbi={blobbi} 
              size={getValidSize(blobbi.size)}
            />
          )}
        </div>
        
        {showStats && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Mood</span>
                <Badge variant={mood === 'happy' ? 'default' : 'secondary'}>
                  {mood}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall Health</span>
                <div className="flex items-center gap-1">
                  {overallHealth > 70 ? (
                    <Heart className="w-3 h-3 text-green-500" />
                  ) : overallHealth > 40 ? (
                    <Heart className="w-3 h-3 text-yellow-500" />
                  ) : (
                    <Heart className="w-3 h-3 text-red-500" />
                  )}
                  <span className="font-medium">{overallHealth}%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last Care</span>
                <span className="text-xs">
                  {formatDistanceToNow(blobbi.lastInteraction * 1000, { addSuffix: true })}
                </span>
              </div>
            </div>
            
            {/* Quick stats preview */}
            <div className="flex justify-around mt-3 pt-3 border-t">
              <div className="flex items-center gap-1" title="Happiness">
                <Smile className="w-3 h-3" />
                <span className="text-xs">{Math.round(blobbi.stats.happiness)}</span>
              </div>
              <div className="flex items-center gap-1" title="Energy">
                <Zap className="w-3 h-3" />
                <span className="text-xs">{Math.round(blobbi.stats.energy)}</span>
              </div>
              <div className="flex items-center gap-1" title="Cleanliness">
                <Sparkles className="w-3 h-3" />
                <span className="text-xs">{Math.round(blobbi.stats.hygiene)}</span>
              </div>
              <div className="flex items-center gap-1" title="Health">
                <Heart className="w-3 h-3" />
                <span className="text-xs">{Math.round(blobbi.stats.health)}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}