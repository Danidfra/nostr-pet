import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCommunityBlobbis } from '@/hooks/useBlobbi';
import { useNavigate } from 'react-router-dom';
import { BlobbiCard } from './BlobbiCard';

export function BlobbiFeed() {
  const { data: blobbis, isLoading } = useCommunityBlobbis(20);
  const navigate = useNavigate();
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
            <CardContent className="p-8">
              <Skeleton className="h-[380px] rounded-3xl mb-4" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  if (!blobbis || blobbis.length === 0) {
    return (
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedBlobbis.map((blobbi, index) => (
          <BlobbiCard
            key={blobbi.id}
            blobbi={blobbi}
            onClick={() => navigate(`/blobbi/${blobbi.ownerPubkey}`)}
            showRank={index < 3 ? index + 1 : undefined}
          />
        ))}
      </div>
    </div>
  );
}