import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft,
  Coins, 
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
import { useBlobbi } from '@/hooks/useBlobbi';
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
import { AppHeader } from '@/components/AppHeader';
import { formatDistanceToNow } from 'date-fns';
import { getActionDisplayName } from '@/lib/utils';
import { BlobbiAction } from '@/types/blobbi';
import { checkEggHatchingReadiness, checkBabyEvolutionReadiness } from '@/lib/blobbi-evolution';
import { isValidSize } from '@/lib/blobbi-egg-validation';
import { SetCompanionButton } from '@/components/SetCompanionButton';

export default function BlobbiDetail() {
  const { blobbiId } = useParams<{ blobbiId: string }>();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { data: blobbi, isLoading } = useBlobbiById(blobbiId || '');
  const { 
    performAction, 
    isPerformingAction,
    triggerEvolution,
    isEvolving 
  } = useBlobbi(undefined, blobbiId);
  
  const isOwner = user?.pubkey === blobbi?.ownerPubkey;
  
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
    if (!blobbi || !blobbiId) return;
    
    if (blobbi.lifeStage === 'egg') {
      // Select egg and start incubation
      selectEgg(blobbiId);
      // Small delay to ensure selection is processed
      setTimeout(() => {
        startIncubation();
      }, 100);
    } else if (blobbi.lifeStage === 'baby') {
      // Select baby and start quest tracking
      selectBaby(blobbiId);
      // Small delay to ensure selection is processed
      setTimeout(() => {
        startQuestTracking();
      }, 100);
    }
  }, [blobbi, blobbiId, selectEgg, selectBaby, startIncubation, startQuestTracking]);

  // Check if this blobbi is currently selected
  const isCurrentlySelected = selectedEggId === blobbiId || selectedBabyId === blobbiId;
  const isCurrentlyListening = (blobbi?.lifeStage === 'egg' && taskSubscriptionActive) || 
                               (blobbi?.lifeStage === 'baby' && questSubscriptionActive);
  
  if (isLoading) {
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
  
  if (!blobbi) {
    return (
      <BlobbiLayout>
        <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
          <div className="container mx-auto py-8 px-4">
            <Card className="max-w-2xl mx-auto bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-gray-100">Blobbi Not Found</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  The Blobbi you're looking for doesn't exist or couldn't be loaded.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/blobbi">
                  <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </BlobbiLayout>
    );
  }

  // Calculate evolution readiness
  const eggReadiness = blobbi.lifeStage === 'egg' ? checkEggHatchingReadiness(blobbi) : null;
  const babyReadiness = blobbi.lifeStage === 'baby' ? checkBabyEvolutionReadiness(blobbi) : null;

  // Mock interaction history (in a real app, this would come from Nostr events)
  const interactionHistory: Array<{ id: string; action: BlobbiAction; timestamp: number; result: string }> = [
    { id: '1', action: 'feed', timestamp: Date.now() - 3600000, result: 'Blobbi enjoyed the meal!' },
    { id: '2', action: 'play', timestamp: Date.now() - 7200000, result: 'Blobbi had fun playing!' },
    { id: '3', action: 'clean', timestamp: Date.now() - 10800000, result: 'Blobbi feels fresh and clean!' },
  ];

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
        {/* Header */}
        <AppHeader 
          title={blobbi.name}
          subtitle={`${blobbi.lifeStage.charAt(0).toUpperCase() + blobbi.lifeStage.slice(1)} • Born ${formatDistanceToNow(blobbi.birthTime, { addSuffix: true })}`}
          leftContent={
            <Button variant="outline" size="sm" onClick={() => navigate('/blobbi')} className="border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          }
        />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Visual and Stats */}
        <div className="lg:col-span-1 space-y-4">
          {/* Blobbi Visual */}
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
            <CardContent className="p-8">
              <div className="flex items-center justify-center transition-all duration-500 min-h-[380px] p-12 bg-gradient-to-br from-purple-50/60 to-pink-50/60 rounded-3xl border-2 border-purple-100/50">
                {blobbi.lifeStage === 'egg' ? (
                  <EggGraphic 
                    blobbi={blobbi} // Pass the full blobbi object for unique characteristics
                    size={getValidSize(blobbi.size)} 
                    animated={true}
                    warmth={blobbi.eggTemperature || 60}
                  />
                ) : blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi' ? (
                  <BlobbiEvolvedVisual 
                    blobbi={blobbi} 
                    size={getValidSize(blobbi.size)}
                    onClick={() => isOwner && performAction('play')}
                  />
                ) : (
                  <BlobbiVisual 
                    blobbi={blobbi} 
                    size={getValidSize(blobbi.size)}
                    onClick={() => isOwner && performAction('play')}
                  />
                )}
              </div>
              
              {blobbi.state === 'hibernating' && (
                <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-4">
                  Your Blobbi is hibernating. Interact with it to wake it up!
                </p>
              )}

              {blobbi.evolutionForm && (
                <div className="text-center mt-4 space-y-1">
                  <div className="flex items-center justify-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                    <Sparkles className="w-4 h-4" />
                    <span>Evolved into {blobbi.evolutionForm.charAt(0).toUpperCase() + blobbi.evolutionForm.slice(1)}</span>
                  </div>
                  {blobbi.evolutionTime && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {formatDistanceToNow(blobbi.evolutionTime, { addSuffix: true })}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Stats */}
          <BlobbiStats stats={blobbi.stats} lifeStage={blobbi.lifeStage} blobbi={blobbi} />
          
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
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Experience</span>
                <div className="flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-purple-600" />
                  <span className="font-semibold">{blobbi.experience} XP</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Coins</span>
                <div className="flex items-center gap-1">
                  <Coins className="w-3 h-3 text-yellow-600" />
                  <span className="font-semibold">{blobbi.coins}</span>
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
                <SetCompanionButton blobbi={blobbi} className="w-full" />
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
                >
                  <Palette className="w-4 h-4" />
                  Customize
                </Button>
                {/* Incubation System Hatch Button (Priority) */}
                {blobbi.lifeStage === 'egg' && isReadyToHatch && (
                  <Button
                    className="w-full justify-start gap-2 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => hatchBlobbi(blobbi.id)}
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
                    {blobbi.lifeStage === 'egg' ? 'Hatch Egg (Traditional)' : 'Evolve to Adult'}
                  </Button>
                )}
                {blobbi.state === 'hibernating' && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => performAction('check')}
                  >
                    <Activity className="w-4 h-4" />
                    Wake Up
                  </Button>
                )}
                {blobbi.state === 'active' && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => {/* Archive logic */}}
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
                <TabsList className="grid w-full grid-cols-4 bg-purple-50/50 dark:bg-purple-900/20">
                  <TabsTrigger 
                    value="actions"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                  >
                    Actions
                  </TabsTrigger>
                  <TabsTrigger 
                    value="overview"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger 
                    value="interactions"
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                  >
                    Interactions
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

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Evolution Path */}
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Evolution Path
                  </CardTitle>
                  <CardDescription>
                    Track your Blobbi's journey from egg to adult
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        blobbi.lifeStage !== 'egg' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        ✓
                      </div>
                      <span className="text-sm font-medium">Egg</span>
                    </div>
                    <div className="flex-1 h-0.5 bg-gray-200 mx-4">
                      <div className={`h-full transition-all duration-500 ${
                        blobbi.lifeStage !== 'egg' ? 'bg-green-500 w-full' : 'bg-gray-200 w-0'
                      }`} />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        blobbi.lifeStage === 'adult' ? 'bg-green-100 text-green-600' : 
                        blobbi.lifeStage === 'baby' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {blobbi.lifeStage === 'adult' ? '✓' : blobbi.lifeStage === 'baby' ? '○' : '○'}
                      </div>
                      <span className="text-sm font-medium">Baby</span>
                    </div>
                    <div className="flex-1 h-0.5 bg-gray-200 mx-4">
                      <div className={`h-full transition-all duration-500 ${
                        blobbi.lifeStage === 'adult' ? 'bg-green-500 w-full' : 'bg-gray-200 w-0'
                      }`} />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        blobbi.lifeStage === 'adult' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {blobbi.lifeStage === 'adult' ? '✓' : '○'}
                      </div>
                      <span className="text-sm font-medium">Adult</span>
                    </div>
                  </div>
                  
                  {/* Current Stage Info */}
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Current Stage: {blobbi.lifeStage.charAt(0).toUpperCase() + blobbi.lifeStage.slice(1)}</h4>
                    {blobbi.lifeStage === 'egg' && eggReadiness && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">{eggReadiness.message}</p>
                        <div className="space-y-1 text-xs">
                          <div>Days: {eggReadiness.requirements.daysPassed}/{eggReadiness.requirements.daysRequired}</div>
                          <div>Care Points: {eggReadiness.requirements.carePointsEarned}/{eggReadiness.requirements.carePointsRequired}</div>
                          <div>Health: {eggReadiness.requirements.currentHealth}%/{eggReadiness.requirements.healthRequirement}%</div>
                        </div>
                      </div>
                    )}
                    {blobbi.lifeStage === 'baby' && babyReadiness && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">{babyReadiness.message}</p>
                        <div className="space-y-1 text-xs">
                          <div>Age: {babyReadiness.requirements.currentAge}/{babyReadiness.requirements.ageRequired} days</div>
                          <div>Care Score: {babyReadiness.requirements.currentCareScore}/{babyReadiness.requirements.careScoreRequired}</div>
                          <div>Interactions: {babyReadiness.requirements.currentInteractions}/{babyReadiness.requirements.interactionsRequired}</div>
                        </div>
                      </div>
                    )}
                    {blobbi.lifeStage === 'adult' && (
                      <p className="text-sm text-muted-foreground">
                        Your Blobbi has reached full maturity! {blobbi.evolutionForm && `It evolved into a ${blobbi.evolutionForm}.`}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity Summary */}
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>
                    Latest interactions and care activities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {interactionHistory.slice(0, 3).map((interaction) => (
                      <div key={interaction.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <Activity className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{getActionDisplayName(interaction.action)}</div>
                          <div className="text-sm text-muted-foreground">{interaction.result}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(interaction.timestamp, { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    ))}
                    {interactionHistory.length === 0 && (
                      <div className="text-center py-4 text-muted-foreground">
                        No recent interactions
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Interactions Tab */}
            <TabsContent value="interactions" className="space-y-6">
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Interaction History
                  </CardTitle>
                  <CardDescription>
                    Complete history of interactions with this Blobbi
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {interactionHistory.map((interaction) => (
                      <div key={interaction.id} className="flex items-start gap-3 p-4 border rounded-lg">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Activity className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-medium">{getActionDisplayName(interaction.action)}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(interaction.timestamp, { addSuffix: true })}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">{interaction.result}</div>
                        </div>
                      </div>
                    ))}
                    {interactionHistory.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No interactions recorded yet
                      </div>
                    )}
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