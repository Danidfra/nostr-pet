import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Trophy,
  Calendar,
  Heart,
  Sparkles,
  Archive,
  Clock,
  Star,
  Activity,
  Zap,
  MessageCircle,
  TrendingUp,
  Settings,
  Share,
  MoreHorizontal,
  ShoppingBag,
  Package,
  Palette,
  Target,
  CheckCircle,
  Circle,
  Users,
  ExternalLink,
  Egg
} from 'lucide-react';
import { useBlobbiWithFakeStatus } from '@/hooks/useBlobbiWithFakeStatus';
import { useBlobbiById } from '@/hooks/useUserBlobbis';
import { useBlobbiIncubationSystem } from '@/hooks/useBlobbiIncubationSystem';
import { useBlobbiQuestSystem } from '@/hooks/useBlobbiQuestSystem';
import { BlobbiVisual } from '@/components/blobbi/BlobbiVisual';
import { BlobbiEvolvedVisual } from '@/components/blobbi/BlobbiEvolvedVisual';
import { BlobbiStats } from '@/components/blobbi/BlobbiStats';
import { BlobbiActions } from '@/components/blobbi/BlobbiActions';
import { BlobbiShop } from '@/components/blobbi/BlobbiShop';
import { BlobbiStorage } from '@/components/blobbi/BlobbiStorage';
import { BlobbiCustomization } from '@/components/blobbi/BlobbiCustomization';
import { BlobbiGamesModal } from '@/components/blobbi/BlobbiGamesModal';
import { EvolutionProgress } from '@/components/blobbi/EvolutionProgress';
import { EggGraphic } from '@/components/blobbi/EggGraphic';
import { BlobbiLayout } from '@/components/BlobbiLayout';
import { useCurrentUser } from '@/hooks/useCurrentUser';

import { formatDistanceToNow } from 'date-fns';
import { getActionDisplayName } from '@/lib/utils';
import { BlobbiAction } from '@/types/blobbi';
import { checkEggHatchingReadiness, checkBabyEvolutionReadiness } from '@/lib/blobbi-evolution';
import { isValidSize } from '@/lib/blobbi-egg-validation';
import { SetCompanionButton } from '@/components/SetCompanionButton';
import { useBlobbiSleepSystem } from '@/hooks/useBlobbiSleepSystem';

export function BlobbiDetailContent({ blobbiId }: { blobbiId: string }) {
  const { user } = useCurrentUser();
  const {
    blobbi,
    performAction,
    isPerformingAction,
    triggerEvolution,
    isEvolving
  } = useBlobbiWithFakeStatus(undefined, blobbiId);
  const { data: realBlobbi, isLoading } = useBlobbiById(blobbiId);

  const isOwner = user?.pubkey === realBlobbi?.ownerPubkey;

  // Use the sleep system
  const {
    isSleeping,
    sleepStartTime,
    calculatePassiveRecovery,
    wakeUp
  } = useBlobbiSleepSystem({
    blobbi: realBlobbi || null,
    isOwner
  });

  useEffect(() => {
    if (realBlobbi && realBlobbi.stats.energy === 100 && isSleeping && isOwner) {
      wakeUp();
    }
  }, [realBlobbi, isSleeping, isOwner, wakeUp]);


  // Helper function to get valid size for components
  const getValidSize = (size?: string): 'tiny' | 'small' | 'medium' | 'large' => {
    if (size && isValidSize(size)) {
      return size as 'tiny' | 'small' | 'medium' | 'large';
    }
    return 'medium'; // Default fallback
  };

  const {
    eggTasks,
    evolutionTasks,
    progress,
    isReadyToHatch,
    isReadyToEvolve,
    metadataSubscriptionActive,
    taskSubscriptionActive,
    isStartingIncubation,
    selectedEggId,
    incubationStartTime,
    selectEgg,
    startIncubation,
    stopIncubation,
    hatchBlobbi
  } = useBlobbiIncubationSystem();

  // New quest system for Baby to Adult evolution
  const {
    babyToAdultQuests,
    questProgress,
    isReadyToEvolve: isQuestReadyToEvolve,
    isBabyReadyToEvolve,
    questSubscriptionActive,
    blobbiHashtagSubscriptionActive,
    isListening: isQuestListening,
    isStartingQuestTracking,
    selectedBabyId,
    questStartTime,
    selectBaby,
    startQuestTracking,
    stopQuestTracking,
  } = useBlobbiQuestSystem();

  const [showShop, setShowShop] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [showStorage, setShowStorage] = useState(false);
  const [activeTab, setActiveTab] = useState('actions');

  // Handle egg/baby selection when user manually starts listening
  const handleStartListening = useCallback(() => {
    if (!realBlobbi || !blobbiId) return;

    if (realBlobbi.lifeStage === 'egg') {
      // Select egg and start incubation
      selectEgg(blobbiId);
      // Small delay to ensure selection is processed
      setTimeout(() => {
        startIncubation();
      }, 100);
    } else if (realBlobbi.lifeStage === 'baby') {
      // Select baby and start quest tracking
      selectBaby(blobbiId);
      // Small delay to ensure selection is processed
      setTimeout(() => {
        startQuestTracking();
      }, 100);
    }
  }, [realBlobbi, blobbiId, selectEgg, selectBaby, startIncubation, startQuestTracking]);

  if (isLoading || !realBlobbi || !blobbi) {
    return (
      <BlobbiLayout>
        <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
          <div className="container mx-auto py-8 px-4">
            <Card className="max-w-2xl mx-auto bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
              <CardContent className="p-8">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </BlobbiLayout>
    );
  }

  // Check if this blobbi is currently selected
  const isCurrentlySelected = selectedEggId === blobbiId || selectedBabyId === blobbiId;
  const isCurrentlyListening = (realBlobbi?.lifeStage === 'egg' && taskSubscriptionActive) ||
                               (realBlobbi?.lifeStage === 'baby' && questSubscriptionActive);

  // Calculate evolution readiness
  const eggReadiness = realBlobbi.lifeStage === 'egg' ? checkEggHatchingReadiness(realBlobbi) : null;
  const babyReadiness = realBlobbi.lifeStage === 'baby' ? checkBabyEvolutionReadiness(realBlobbi) : null;



  // Mock zaps received (in a real app, this would come from Nostr events)
  const zapsReceived = [
    { id: '1', amount: 100, from: 'npub1...', timestamp: Date.now() - 86400000, message: 'Cute Blobbi!' },
    { id: '2', amount: 50, from: 'npub2...', timestamp: Date.now() - 172800000, message: 'Love the evolution!' },
  ];

  // Mock comments (in a real app, this would come from Nostr events)
  const comments = [
    { id: '1', author: 'npub1...', content: 'Your Blobbi looks amazing!', timestamp: Date.now() - 3600000 },
    { id: '2', author: 'npub2...', content: 'How did you get it to evolve so quickly?', timestamp: Date.now() - 7200000 },
  ];

  return (
    <BlobbiLayout>
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
        <div className="container mx-auto py-8 px-4">


      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Visual and Stats */}
        <div className="lg:col-span-1 space-y-4">
          {/* Blobbi Visual */}
          <Card className="relative overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600 group">
            <CardContent className="p-4 sm:p-6">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/30 dark:to-pink-900/30 transition-all duration-300 z-0"></div>
              <div className="relative z-10">
                <div className="text-center mb-4">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 capitalize">{blobbi.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {blobbi.lifeStage.charAt(0).toUpperCase() + blobbi.lifeStage.slice(1)} • {formatDistanceToNow(blobbi.birthTime, { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center justify-center transition-all duration-500 min-h-[300px] sm:min-h-[380px]">
                  {blobbi.lifeStage === 'egg' ? (
                    <EggGraphic
                      blobbi={blobbi}
                      size="medium"
                      animated={true}
                      warmth={blobbi.eggTemperature || 60}
                    />
                  ) : blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi' ? (
                    <BlobbiEvolvedVisual
                      blobbi={blobbi}
                      size="medium"
                      onClick={() => isOwner && performAction('play')}
                    />
                  ) : (
                    <BlobbiVisual
                      blobbi={blobbi}
                      size="medium"
                      onClick={() => isOwner && performAction('play')}
                    />
                  )}
                </div>

                {blobbi.state === 'hibernating' && (
                  <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-4">
                    Your Blobbi is hibernating. Interact with it to wake it up!
                  </p>
                )}

              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <BlobbiStats blobbi={blobbi} />

          {/* Quick Info */}
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5" />
                Quick Info
              </CardTitle>
              <CardDescription>
                Essential details about your Blobbi
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Life Stage</span>
                <Badge variant="outline">
                  {blobbi.lifeStage.charAt(0).toUpperCase() + blobbi.lifeStage.slice(1)}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">State</span>
                <Badge variant={blobbi.state === 'active' ? 'default' : 'secondary'}>
                  {blobbi.state.charAt(0).toUpperCase() + blobbi.state.slice(1)}
                  {isSleeping && ' 💤'}
                </Badge>
              </div>
              {isSleeping && sleepStartTime && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sleeping Since</span>
                  <span className="font-medium">{formatDistanceToNow(sleepStartTime, { addSuffix: true })}</span>
                </div>
              )}
              {isSleeping && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Energy Recovery</span>
                  <span className="font-medium text-green-600">+{calculatePassiveRecovery()} pending</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Experience</span>
                <div className="flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-purple-600" />
                  <span className="font-semibold">{blobbi.experience} XP</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last Care</span>
                <span className="font-medium">{formatDistanceToNow(blobbi.lastInteraction * 1000, { addSuffix: true })}</span>
              </div>
              {blobbi.evolutionForm && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Evolution</span>
                  <Badge variant="default" className="gap-1">
                    <Sparkles className="w-3 h-3" />
                    {blobbi.evolutionForm.charAt(0).toUpperCase() + blobbi.evolutionForm.slice(1)}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Owner Actions */}
          {isOwner && (
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Manage your Blobbi's needs and activities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <SetCompanionButton blobbi={realBlobbi} className="w-full" />
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setShowShop(true)}
                >
                  <ShoppingBag className="w-4 h-4" />
                  Shop
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setShowStorage(true)}
                >
                  <Package className="w-4 h-4" />
                  Storage
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setShowCustomization(true)}
                  disabled
                >
                  <Palette className="w-4 h-4" />
                  Customize
                </Button>
                {/* Incubation System Hatch Button (Priority) */}
                {realBlobbi.lifeStage === 'egg' && isReadyToHatch && (
                  <Button
                    className="w-full justify-start gap-2 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => hatchBlobbi(realBlobbi.id)}
                    disabled={isEvolving}
                  >
                    <Sparkles className="w-4 h-4" />
                    Hatch the Egg
                  </Button>
                )}

                {/* Traditional Evolution Button (Fallback) */}
                {((eggReadiness?.isReady && !isReadyToHatch) || babyReadiness?.isReady) && (
                  <Button
                    className="w-full justify-start gap-2"
                    onClick={() => triggerEvolution()}
                    disabled={isEvolving}
                  >
                    <Sparkles className="w-4 h-4" />
                    {realBlobbi.lifeStage === 'egg' ? 'Hatch Egg (Traditional)' : 'Evolve to Adult'}
                  </Button>
                )}
                {realBlobbi.state === 'hibernating' && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={wakeUp}
                  >
                    <Activity className="w-4 h-4" />
                    Wake Up
                  </Button>
                )}
                {realBlobbi.state === 'active' && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => {/* Archive logic */}}
                    disabled
                  >
                    <Archive className="w-4 h-4" />
                    Archive
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Detailed Information */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
              <CardContent className="p-2">
                <TabsList className="grid w-full grid-cols-3 bg-purple-50/50 dark:bg-purple-900/20">
                  <TabsTrigger
                    value="actions"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                  >
                    Actions
                  </TabsTrigger>
                  <TabsTrigger
                    value="info"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                  >
                    Info
                  </TabsTrigger>

                  <TabsTrigger
                    value="social"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                  >
                    Social
                  </TabsTrigger>
                </TabsList>
              </CardContent>
            </Card>

            {/* Actions Tab */}
            <TabsContent value="actions">
              {isOwner ? (
                <BlobbiActions
                  blobbi={blobbi}
                  onAction={performAction}
                  isPerformingAction={isPerformingAction}
                  onGamesClick={() => setShowGames(true)}
                  onOpenShop={() => setShowShop(true)}
                />
              ) : (
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Share className="w-5 h-5" />
                      Viewing Mode
                    </CardTitle>
                    <CardDescription>
                      You're viewing someone else's Blobbi
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Only the owner can interact with this Blobbi. You can view its stats and evolution progress.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Info Tab */}
            <TabsContent value="info" className="space-y-6">
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <Settings className="w-5 h-5" />
                    Blobbi Information
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    Detailed metadata and characteristics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-6">
                    {/* Basic Information */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Basic Information</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">ID</span>
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            {blobbi.id.slice(0, 8)}...{blobbi.id.slice(-8)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Size</span>
                          <Badge variant="outline" className="border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300">
                            {blobbi.size || 'medium'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Base Color</span>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
                              style={{ backgroundColor: blobbi.baseColor || '#8B5CF6' }}
                            />
                            <span className="font-mono text-xs">{blobbi.baseColor || '#8B5CF6'}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Birth Time</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {new Date(blobbi.birthTime).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Owner</span>
                          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            {realBlobbi.ownerPubkey.slice(0, 8)}...{realBlobbi.ownerPubkey.slice(-8)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Advanced Information */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Advanced Information</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Care Streak</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{blobbi.careStreak || 0} days</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Total Interactions</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{blobbi.evolutionProgress?.careSessions?.reduce((total, session) => total + (session.actions || 0), 0) || 0}</span>
                        </div>
                        {blobbi.evolutionTime && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Evolution Time</span>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {new Date(blobbi.evolutionTime).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {blobbi.eggTemperature && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Egg Temperature</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{blobbi.eggTemperature}°</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Version</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">v1.0</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Raw Data Section */}
                  <div className="mt-6 pt-6 border-t border-purple-100 dark:border-purple-600/30">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Raw Data</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto max-w-[290px] sm:max-w-full">
                      <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words sm:break-normal">
                        {JSON.stringify(realBlobbi, null, 2)}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>



            {/* Social Tab */}
            <TabsContent value="social" className="space-y-6">
              {/* Zaps Received */}
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Zaps Received
                  </CardTitle>
                  <CardDescription>
                    Lightning tips received for this Blobbi
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {zapsReceived.map((zap) => (
                      <div key={zap.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                          <Zap className="w-4 h-4 text-yellow-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-medium">{zap.amount} sats</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(zap.timestamp, { addSuffix: true })}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground mb-1">
                            From {zap.from.slice(0, 12)}...
                          </div>
                          {zap.message && (
                            <div className="text-sm">"{zap.message}"</div>
                          )}
                        </div>
                      </div>
                    ))}
                    {zapsReceived.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No zaps received yet
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Comments */}
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Comments
                  </CardTitle>
                  <CardDescription>
                    What others are saying about this Blobbi
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <MessageCircle className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-medium">{comment.author.slice(0, 12)}...</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(comment.timestamp, { addSuffix: true })}
                            </div>
                          </div>
                          <div className="text-sm">{comment.content}</div>
                        </div>
                      </div>
                    ))}
                    {comments.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No comments yet
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>


          </Tabs>
        </div>
      </div>

      {/* Shop, Storage, Customization, and Games Dialogs */}
      {isOwner && (
        <>
          <BlobbiShop isOpen={showShop} onClose={() => setShowShop(false)} />
          <BlobbiStorage isOpen={showStorage} onClose={() => setShowStorage(false)} />
          <BlobbiCustomization isOpen={showCustomization} onClose={() => setShowCustomization(false)} />
          <BlobbiGamesModal
            isOpen={showGames}
            onClose={() => setShowGames(false)}
            blobbiId={blobbi.id}
          />
        </>
      )}
        </div>
      </div>
    </BlobbiLayout>
  );
}
