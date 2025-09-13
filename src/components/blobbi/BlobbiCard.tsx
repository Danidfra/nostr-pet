import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BlobbiVisual } from './BlobbiVisual';
import { BlobbiEvolvedVisual } from './BlobbiEvolvedVisual';
import { EggGraphic } from './EggGraphic';
import { SetCompanionButton } from '@/components/SetCompanionButton';
import { Blobbi } from '@/types/blobbi';
import { formatDistanceToNow } from 'date-fns';
import { Heart, Sparkles, Zap, Smile, Crown, Activity, Eye } from 'lucide-react';
import { getBlobbiMood } from '@/lib/blobbi';
import { BlobbiFakeStatusIndicator } from './BlobbiFakeStatusIndicator';
import { useBlobbiFakeStatus } from '@/contexts/BlobbiFakeStatusContext';
import { cn } from '@/lib/utils';
import { isValidSize } from '@/lib/blobbi-egg-validation';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@/hooks/useNostr';
import { BLOBBI_EVENT_KINDS } from '@/lib/blobbi-events';

type BlobbiCardSize = 'sm' | 'md' | 'lg';

interface BlobbiCardProps {
  blobbi: Blobbi;
  size?: BlobbiCardSize;
  onClick?: () => void;
  showStats?: boolean;
  showStatus?: boolean;
  showRank?: number;
  showActions?: boolean;
  onViewDetails?: () => void;
  className?: string;
  footerContent?: React.ReactNode;
}

export function BlobbiCard({
  blobbi,
  size = 'md',
  onClick,
  showStats = true,
  showStatus = true,
  showRank,
  showActions = false,
  onViewDetails,
  className,
  footerContent
}: BlobbiCardProps) {
  const queryClient = useQueryClient();
  const { nostr } = useNostr();
  const mood = getBlobbiMood(blobbi.stats, blobbi.state);
  const { hasFakeStatus, getPendingInteractionCount } = useBlobbiFakeStatus();
  const pendingCount = getPendingInteractionCount(blobbi.id);
  const overallHealth = Math.round(
    (blobbi.stats.health + blobbi.stats.happiness + blobbi.stats.energy + blobbi.stats.hygiene) / 4
  );

  // Prefetch detailed Blobbi data on hover for faster navigation
  const handlePrefetch = () => {
    // Prefetch the specific blobbi-state data if not already cached
    queryClient.prefetchQuery({
      queryKey: ['blobbi-state', blobbi.id, blobbi.ownerPubkey],
      queryFn: async () => {
        const signal = AbortSignal.timeout(3000);
        const events = await nostr.query([
          {
            kinds: [BLOBBI_EVENT_KINDS.STATE],
            authors: [blobbi.ownerPubkey],
            '#d': [blobbi.id],
            limit: 1,
          }
        ], { signal });

        return events[0] || null;
      },
      staleTime: 30000, // Consider data fresh for 30 seconds
    });

    // Prefetch interactions for the detail page
    queryClient.prefetchQuery({
      queryKey: ['blobbi-interactions', blobbi.id, 50],
      queryFn: async () => {
        const signal = AbortSignal.timeout(5000);
        const events = await nostr.query([
          {
            kinds: [BLOBBI_EVENT_KINDS.INTERACTION],
            '#blobbi_id': [blobbi.id],
            limit: 50,
          }
        ], { signal });

        return events.sort((a, b) => b.created_at - a.created_at);
      },
      staleTime: 60000, // Consider data fresh for 1 minute
    });

    // Prefetch lifecycle records
    queryClient.prefetchQuery({
      queryKey: ['blobbi-records', blobbi.id],
      queryFn: async () => {
        const signal = AbortSignal.timeout(5000);
        const events = await nostr.query([
          {
            kinds: [BLOBBI_EVENT_KINDS.RECORD],
            '#blobbi_id': [blobbi.id],
          }
        ], { signal });

        return events.sort((a, b) => a.created_at - b.created_at);
      },
      staleTime: 120000, // Consider data fresh for 2 minutes
    });
  };

  // Helper function to get valid size for components
  const getValidSize = (size?: string): 'tiny' | 'small' | 'medium' | 'large' => {
    if (size && isValidSize(size)) {
      return size as 'tiny' | 'small' | 'medium' | 'large';
    }
    return 'medium'; // Default fallback
  };

  // Always use medium size for visual consistency across all Blobbis
  const getBlobbiVisualSize = (): 'medium' => {
    return 'medium';
  };

  // Size-based configurations
  const sizeConfig = {
    sm: {
      visualHeight: 'min-h-[120px]',
      visualPadding: 'p-3',
      titleSize: 'text-base',
      descriptionSize: 'text-xs',
      badgeSize: 'text-xs',
      headerPadding: 'pb-2',
      contentPadding: 'p-3',
      borderRadius: 'rounded-xl',
    },
    md: {
      visualHeight: 'min-h-[200px]',
      visualPadding: 'p-6',
      titleSize: 'text-lg',
      descriptionSize: 'text-sm',
      badgeSize: 'text-xs',
      headerPadding: 'pb-3',
      contentPadding: 'p-4',
      borderRadius: 'rounded-2xl',
    },
    lg: {
      visualHeight: 'min-h-[300px]',
      visualPadding: 'p-8',
      titleSize: 'text-xl',
      descriptionSize: 'text-sm',
      badgeSize: 'text-sm',
      headerPadding: 'pb-4',
      contentPadding: 'p-6',
      borderRadius: 'rounded-2xl',
    },
  };

  const config = sizeConfig[size];

  return (
    <Card
      className={cn(
        "group transition-all duration-300 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-purple-200/60 dark:border-purple-600/60 shadow-sm hover:shadow-xl hover:shadow-purple-200/20 dark:hover:shadow-purple-900/20",
        config.borderRadius,
        onClick && "cursor-pointer hover:scale-[1.02]",
        className
      )}
      onClick={onClick}
      onMouseEnter={handlePrefetch}
    >
      <CardHeader className={config.headerPadding}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className={cn(config.titleSize, "text-gray-900 dark:text-gray-100 truncate")}>
                {blobbi.name}
              </CardTitle>
              <BlobbiFakeStatusIndicator
                hasFakeStatus={hasFakeStatus(blobbi.id)}
                pendingInteractionCount={pendingCount}
              />
              {showRank && (
                <Badge variant="default" className={cn(
                  config.badgeSize,
                  "bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-900 border-0 shadow-sm"
                )}>
                  <Crown className="w-3 h-3 mr-1" />
                  #{showRank}
                </Badge>
              )}
            </div>
            {showStatus && (
              <CardDescription className={cn(config.descriptionSize, "text-gray-600 dark:text-gray-400")}>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={cn(
                      config.badgeSize,
                      "border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-900/20"
                    )}
                  >
                    {blobbi.lifeStage}
                  </Badge>
                  <span className="text-gray-400">•</span>
                  <span>{formatDistanceToNow(blobbi.birthTime)} old</span>
                </div>
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent id="tab-my-blobbies-card" className={config.contentPadding}>
        {/* Blobbi Visual - Fixed size container, only Blobbi scales */}
        <div className="flex items-center justify-center transition-all duration-500 bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/30 dark:to-pink-900/30 rounded-2xl border-2 border-purple-100/60 dark:border-purple-600/30 mb-4 group-hover:border-purple-200/80 dark:group-hover:border-purple-500/50 min-h-[300px] p-8">
          {blobbi.lifeStage === 'egg' ? (
            <EggGraphic
              blobbi={blobbi}
              size={getBlobbiVisualSize()}
              animated={true}
              warmth={blobbi.eggTemperature || 60}
            />
          ) : blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi' ? (
            <BlobbiEvolvedVisual
              blobbi={blobbi}
              size={getBlobbiVisualSize()}
            />
          ) : (
            <BlobbiVisual
              blobbi={blobbi}
              size={getBlobbiVisualSize()}
            />
          )}
        </div>

        {showStats && (
          <div className="space-y-3">
            {/* Primary Stats */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">State</span>
                <Badge
                  variant={blobbi.state === 'active' ? 'default' : 'secondary'}
                  className={cn(
                    config.badgeSize,
                    blobbi.state === 'active'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  )}
                >
                  <Activity className="w-3 h-3 mr-1" />
                  {blobbi.state}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Experience</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{blobbi.experience} XP</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Overall Health</span>
                <div className="flex items-center gap-1">
                  {overallHealth > 70 ? (
                    <Heart className="w-3 h-3 text-green-500" />
                  ) : overallHealth > 40 ? (
                    <Heart className="w-3 h-3 text-yellow-500" />
                  ) : (
                    <Heart className="w-3 h-3 text-red-500" />
                  )}
                  <span className="font-medium text-gray-900 dark:text-gray-100">{overallHealth}%</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Last Care</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {formatDistanceToNow(blobbi.lastInteraction * 1000, { addSuffix: true })}
                </span>
              </div>

              {blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi' && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Evolution</span>
                  <Badge
                    variant="default"
                    className={cn(
                      config.badgeSize,
                      "bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-600"
                    )}
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    {blobbi.evolutionForm.charAt(0).toUpperCase() + blobbi.evolutionForm.slice(1)}
                  </Badge>
                </div>
              )}
            </div>

            {/* Quick stats preview */}
            <div className="flex justify-around pt-3 border-t border-purple-100 dark:border-purple-600/30">
              <div className="flex flex-col items-center gap-1" title="Happiness">
                <Smile className="w-4 h-4 text-yellow-500" />
                <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{Math.round(blobbi.stats.happiness)}</span>
              </div>
              <div className="flex flex-col items-center gap-1" title="Energy">
                <Zap className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{Math.round(blobbi.stats.energy)}</span>
              </div>
              <div className="flex flex-col items-center gap-1" title="Cleanliness">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{Math.round(blobbi.stats.hygiene)}</span>
              </div>
              <div className="flex flex-col items-center gap-1" title="Health">
                <Heart className="w-4 h-4 text-red-500" />
                <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{Math.round(blobbi.stats.health)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer Content */}
        {footerContent && (
          <div className="mt-4 pt-3 border-t border-purple-100 dark:border-purple-600/30">
            {footerContent}
          </div>
        )}

        {/* Action Buttons - Always Vertical Layout */}
        {showActions && (
          <div className={cn(
            "pt-4 border-t border-purple-100 dark:border-purple-600/30",
            footerContent ? "mt-3" : "mt-4"
          )}>
            <div className="flex flex-col gap-2 w-full">
              {onViewDetails && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails();
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </Button>
              )}
              <div onClick={(e) => e.stopPropagation()} className="w-full">
                <SetCompanionButton
                  blobbi={blobbi}
                  size="sm"
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}