import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useBlobbiLifecycle } from '@/hooks/useBlobbiLifecycle';
import { useBlobbiDecayManager, useBlobbiDecayInfo } from '@/hooks/useBlobbiDecayManager';
import { BlobbiTimeline } from '@/components/blobbi/BlobbiTimeline';
import { BlobbiAction } from '@/types/blobbi';
import { 
  Egg, 
  Baby, 
  Sparkles, 
  Heart, 
  Utensils, 
  Bath, 
  Bed, 
  Gamepad2,
  Thermometer,
  Eye,
  Music,
  MessageCircle,
  Stethoscope,
  Trophy,
  Star,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

interface BlobbiLifecycleManagerProps {
  blobbiId: string;
}

export const BlobbiLifecycleManager: React.FC<BlobbiLifecycleManagerProps> = ({ blobbiId }) => {
  const {
    blobbi,
    lifecycleStatus,
    isLoading,
    performCare,
    evolve,
    createMemory,
    isPerformingCare,
    isEvolving,
    isCreatingMemory,
  } = useBlobbiLifecycle(blobbiId);

  // Integrate decay management
  const { isShellIntegrityCritical, shellIntegrityValue } = useBlobbiDecayManager({
    blobbi,
    updateBlobbi: async (updatedBlobbi) => {
      // This would need to be connected to the actual update function
      // For now, we'll just log the decay
      console.log('Blobbi decay applied:', updatedBlobbi);
    },
    enabled: !!blobbi,
  });

  const decayInfo = useBlobbiDecayInfo(blobbi);

  const [selectedAction, setSelectedAction] = useState<string>('');

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-20 bg-muted rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!blobbi) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Blobbi not found. Please check the ID and try again.
        </AlertDescription>
      </Alert>
    );
  }

  const handleCareAction = async (action: string) => {
    try {
      setSelectedAction(action);
      
      // Import logger and log the interaction attempt
      const { logInteractionTriggered } = await import('@/lib/interaction-logger');
      
      await performCare({ action });
      
      // Log successful interaction (performCare doesn't return stat changes, so we'll log basic info)
      logInteractionTriggered(
        action as BlobbiAction,
        blobbi.id,
        blobbi.lifeStage,
        {
          experienceGained: 5, // Default experience gain
        }
      );
    } catch (error) {
      // Import logger and log the error
      const { logInteractionError } = await import('@/lib/interaction-logger');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logInteractionError(
        action as BlobbiAction,
        blobbi.id,
        blobbi.lifeStage,
        errorMessage
      );
      
      console.error('Care action failed:', error);
    } finally {
      setSelectedAction('');
    }
  };

  const handleEvolution = async () => {
    try {
      if (blobbi.lifeStage === 'egg') {
        await evolve({ newStage: 'baby', evolutionReason: 'Manual hatching triggered' });
      } else if (blobbi.lifeStage === 'baby') {
        await evolve({ newStage: 'adult', evolutionReason: 'Manual evolution triggered' });
      }
    } catch (error) {
      console.error('Evolution failed:', error);
    }
  };

  const handleCreateMemory = async () => {
    try {
      await createMemory({
        memoryTitle: 'Special Moment',
        memoryDescription: 'A wonderful moment shared with my Blobbi',
        milestone: 'user_created_memory',
      });
    } catch (error) {
      console.error('Memory creation failed:', error);
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'egg': return <Egg className="h-5 w-5" />;
      case 'baby': return <Baby className="h-5 w-5" />;
      case 'adult': return <Sparkles className="h-5 w-5" />;
      default: return <Heart className="h-5 w-5" />;
    }
  };

  const getStatColor = (value: number) => {
    if (value >= 80) return 'bg-green-500';
    if (value >= 60) return 'bg-yellow-500';
    if (value >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const careActions = [
    { id: 'feed', label: 'Feed', icon: Utensils, description: 'Increase hunger' },
    { id: 'play', label: 'Play', icon: Gamepad2, description: 'Increase happiness' },
    { id: 'clean', label: 'Clean', icon: Bath, description: 'Increase hygiene' },
    { id: 'rest', label: 'Rest', icon: Bed, description: 'Increase energy' },
    { id: 'medicine', label: 'Medicine', icon: Stethoscope, description: 'Increase health' },
  ];

  const eggActions = [
    { id: 'warm', label: 'Warm', icon: Thermometer, description: 'Keep egg warm' },
    { id: 'check', label: 'Check', icon: Eye, description: 'Check egg health' },
    { id: 'sing', label: 'Sing', icon: Music, description: 'Sing to egg' },
    { id: 'talk', label: 'Talk', icon: MessageCircle, description: 'Talk to egg' },
    { id: 'medicine', label: 'Medicine', icon: Stethoscope, description: 'Apply medicine to strengthen egg' },
    { id: 'clean', label: 'Clean', icon: Bath, description: 'Clean the egg shell' },
  ];

  const availableActions = blobbi.lifeStage === 'egg' ? eggActions : careActions;

  return (
    <div className="space-y-6">
      {/* Blobbi Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStageIcon(blobbi.lifeStage)}
            {blobbi.name}
            <Badge variant="secondary" className="ml-auto">
              {blobbi.lifeStage}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(blobbi.stats).map(([stat, value]) => (
              <div key={stat} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{stat}</span>
                  <span>{value}%</span>
                </div>
                <Progress 
                  value={value} 
                  className="h-2"
                  // @ts-expect-error - Progress component styling
                  style={{ '--progress-background': getStatColor(value) }}
                />
              </div>
            ))}
          </div>

          {/* Experience and Care Streak */}
          <div className="flex justify-between items-center pt-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Experience: {blobbi.experience}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Care Streak: {blobbi.careStreak} days</span>
            </div>
          </div>

          {/* Decay and Shell Integrity Warnings */}
          {blobbi.lifeStage === 'egg' && isShellIntegrityCritical && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                ⚠️ Shell integrity is critically low ({shellIntegrityValue}%)! Care points are being deducted every hour.
              </AlertDescription>
            </Alert>
          )}

          {decayInfo?.needsAttention && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {decayInfo.isCritical 
                  ? `🚨 Your Blobbi needs immediate attention! It's been ${Math.floor(decayInfo.hoursSinceLastInteraction)} hours since last care.`
                  : `⏰ Your Blobbi could use some attention. It's been ${Math.floor(decayInfo.hoursSinceLastInteraction)} hours since last care.`
                }
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Evolution Status */}
      {lifecycleStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Evolution Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lifecycleStatus.isEligibleForEvolution ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Your Blobbi is ready to evolve!</span>
                  <Button 
                    onClick={handleEvolution}
                    disabled={isEvolving}
                    size="sm"
                  >
                    {isEvolving ? 'Evolving...' : 'Evolve Now'}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {lifecycleStatus.evolutionStatus?.message || 'Continue caring for your Blobbi'}
                </p>
                {lifecycleStatus.evolutionStatus?.requirements && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(lifecycleStatus.evolutionStatus.requirements).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Care Streak Status */}
            {lifecycleStatus.careStreak && (
              <div className="pt-2 border-t">
                <p className="text-sm font-medium">Care Streak</p>
                <p className="text-xs text-muted-foreground">
                  {lifecycleStatus.careStreak.message}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Care Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Care Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {availableActions.map((action) => {
              const Icon = action.icon;
              const isSelected = selectedAction === action.id;
              const isDisabled = isPerformingCare || isEvolving;
              
              return (
                <Button
                  key={action.id}
                  variant={isSelected ? "default" : "outline"}
                  className="h-auto p-3 flex flex-col gap-2"
                  onClick={() => handleCareAction(action.id)}
                  disabled={isDisabled}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{action.label}</span>
                </Button>
              );
            })}
          </div>
          
          <Separator className="my-4" />
          
          {/* Special Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateMemory}
              disabled={isCreatingMemory}
              className="flex items-center gap-2"
            >
              <Star className="h-4 w-4" />
              {isCreatingMemory ? 'Creating...' : 'Create Memory'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Information Tabs */}
      <Tabs defaultValue="timeline" className="w-full">
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
          <CardContent className="p-2">
            <TabsList className="grid w-full grid-cols-3 bg-purple-50/50 dark:bg-purple-900/20">
              <TabsTrigger 
                value="timeline"
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
              >
                Timeline
              </TabsTrigger>
              <TabsTrigger 
                value="stats"
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
              >
                Detailed Stats
              </TabsTrigger>
              <TabsTrigger 
                value="records"
                className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
              >
                Records
              </TabsTrigger>
            </TabsList>
          </CardContent>
        </Card>
        
        <TabsContent value="timeline" className="space-y-4">
          <BlobbiTimeline blobbiId={blobbiId} />
        </TabsContent>
        
        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Basic Info</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Birth Time:</span>
                      <span>{new Date(blobbi.birthTime).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Interaction:</span>
                      <span>{new Date(blobbi.lastInteraction * 1000).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Generation:</span>
                      <span>{blobbi.generation}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Breeding Ready:</span>
                      <span>{blobbi.breedingReady ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Evolution Progress</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Total Care Days:</span>
                      <span>{blobbi.evolutionProgress.totalCareDays}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Current Streak:</span>
                      <span>{blobbi.evolutionProgress.currentStreak}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Care Sessions:</span>
                      <span>{blobbi.evolutionProgress.careSessions.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Eligible for Evolution:</span>
                      <span>{blobbi.evolutionProgress.isEligibleForEvolution ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lifecycle Records</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View all lifecycle records in the Timeline tab for a complete history.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};