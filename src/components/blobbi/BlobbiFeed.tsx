import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useBlobbis } from '@/hooks/useBlobbi';
import { BlobbiVisual } from './BlobbiVisual';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Heart, Sparkles, Zap, Smile } from 'lucide-react';
import { getBlobbiMood } from '@/lib/blobbi';

export function BlobbiFeed() {
  const { data: blobbis, isLoading } = useBlobbis(20);
  const navigate = useNavigate();
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-32 rounded-full mx-auto" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  if (!blobbis || blobbis.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No Blobbis found yet. Be the first to adopt one!</p>
        </CardContent>
      </Card>
    );
  }
  
  // Sort by health and happiness for "best cared for" ranking
  const sortedBlobbis = [...blobbis].sort((a, b) => {
    const scoreA = (a.stats.health + a.stats.happiness) / 2;
    const scoreB = (b.stats.health + b.stats.happiness) / 2;
    return scoreB - scoreA;
  });
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Blobbi Community</h2>
        <p className="text-muted-foreground mb-6">
          Discover other Blobbis in the Nostr network
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedBlobbis.map((blobbi, index) => {
          const mood = getBlobbiMood(blobbi.stats, blobbi.state);
          const overallHealth = Math.round(
            (blobbi.stats.health + blobbi.stats.happiness + blobbi.stats.energy + blobbi.stats.hygiene) / 4
          );
          
          return (
            <Card 
              key={blobbi.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/blobbi/${blobbi.ownerPubkey}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{blobbi.name}</CardTitle>
                  {index < 3 && (
                    <Badge variant="default" className="text-xs">
                      #{index + 1}
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
                <div className="flex justify-center mb-4">
                  <BlobbiVisual blobbi={blobbi} size="small" />
                </div>
                
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}