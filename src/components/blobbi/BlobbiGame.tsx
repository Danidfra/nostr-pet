import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Coins, Trophy, Calendar, Heart, ShoppingBag, Palette, Sparkles, Package, Egg } from 'lucide-react';
import { useBlobbiInteractionSystem } from '@/hooks/useBlobbiInteractionSystem';
import { BlobbiFakeStatusIndicator } from './BlobbiFakeStatusIndicator';
import { BlobbiVisual } from './BlobbiVisual';
import { BlobbiEvolvedVisual } from './BlobbiEvolvedVisual';
import { BlobbiStats } from './BlobbiStats';
import { BlobbiActions } from './BlobbiActions';
import { BlobbiShop } from './BlobbiShop';
import { BlobbiStorage } from './BlobbiStorage';
import { BlobbiCustomization } from './BlobbiCustomization';
import { BlobbiGamesModal } from './BlobbiGamesModal';
import { EvolutionProgress } from './EvolutionProgress';
import { EggGraphic } from './EggGraphic';
import { BlobbiIncubationDashboard } from './BlobbiIncubationDashboard';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { LoginArea } from '@/components/auth/LoginArea';
import { formatDistanceToNow } from 'date-fns';

export function BlobbiGame() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const {
    blobbi,
    isLoading,
    performAction,
    isPerformingCareAction: isPerformingAction,
    hasPendingInteractions,
    pendingInteractionCount
  } = useBlobbiInteractionSystem();

  const isOwner = user?.pubkey === blobbi?.ownerPubkey;

  const [showShop, setShowShop] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [showStorage, setShowStorage] = useState(false);

  if (!user) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Welcome to Blobbi!</CardTitle>
          <CardDescription>
            Log in with your Nostr account to adopt your own virtual pet
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Each Nostr account can have unique Blobbi pets that live forever on the decentralized network.
            </p>
            <p className="text-muted-foreground">
              Take care of your Blobbi by feeding, playing, and keeping it clean!
            </p>
          </div>
          <LoginArea />
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!blobbi) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Welcome to Blobbi!</CardTitle>
          <CardDescription>
            You don't have a Blobbi yet. Adopt one to start your journey!
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center py-8">
            <EggGraphic
              size="medium"
              animated={true}
              warmth={60}
            />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">Adopt Your Blobbi</h3>
            <p className="text-sm text-muted-foreground">
              This magical egg is waiting for someone to care for it. With love and attention, it will hatch into your unique Blobbi companion.
            </p>
          </div>
          <Button onClick={() => navigate('/blobbi/adopt')} size="lg">
            <Heart className="mr-2 h-4 w-4" />
            Adopt a Blobbi
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-2 h-full flex flex-col overflow-hidden">
      <Tabs defaultValue="blobbi" className="w-full flex flex-col overflow-hidden flex-1">
        <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
          <TabsTrigger value="blobbi">My Blobbi</TabsTrigger>
          <TabsTrigger value="incubation" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Growth Hub
          </TabsTrigger>
        </TabsList>

        <TabsContent value="blobbi" className="space-y-2 flex-1 overflow-hidden">
          {/* Header with pet info */}
          <Card className="flex-shrink-0">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl">{blobbi.name}</CardTitle>
                    <BlobbiFakeStatusIndicator
                      hasFakeStatus={hasPendingInteractions()}
                      pendingInteractionCount={pendingInteractionCount}
                    />
                  </div>
                  <CardDescription className="text-xs">
                    {blobbi.lifeStage.charAt(0).toUpperCase() + blobbi.lifeStage.slice(1)} •
                    Born {formatDistanceToNow(blobbi.birthTime, { addSuffix: true })}
                  </CardDescription>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <div className="flex gap-3 text-sm">
                    <div className="flex items-center gap-1">
                      <Coins className="w-4 h-4 text-yellow-600" />
                      <span className="font-semibold">{blobbi.coins}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Trophy className="w-4 h-4 text-purple-600" />
                      <span className="font-semibold">{blobbi.experience} XP</span>
                    </div>
                  </div>
                  {isOwner && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowShop(true)}
                        className="gap-1 h-8"
                      >
                        <ShoppingBag className="w-3 h-3" />
                        Shop
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowStorage(true)}
                        className="gap-1 h-8"
                      >
                        <Package className="w-3 h-3" />
                        Storage
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCustomization(true)}
                        className="gap-1 h-8"
                      >
                        <Palette className="w-3 h-3" />
                        Customize
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid md:grid-cols-2 gap-2 flex-1 overflow-hidden">
            {/* Left column - Visual and stats */}
            <div className="space-y-2 overflow-hidden">
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                <CardContent className="p-4">
                  <div className="flex items-center justify-center transition-all duration-500 min-h-[280px] p-6 bg-gradient-to-br from-purple-50/60 to-pink-50/60 rounded-3xl border-2 border-purple-100/50">
                    {blobbi.lifeStage === 'egg' ? (
                      <EggGraphic
                        blobbi={blobbi}
                        size="large"
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
                        size={blobbi.lifeStage === 'baby' ? 'medium' : 'large'}
                        onClick={() => isOwner && performAction('play')}
                      />
                    )}
                  </div>
                  {blobbi.state === 'hibernating' && (
                    <p className="text-center text-xs text-muted-foreground mt-2">
                      Your Blobbi is hibernating. Interact with it to wake it up!
                    </p>
                  )}

                  {blobbi.evolutionForm && (
                    <div className="text-center mt-2 space-y-1">
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                        <Sparkles className="w-3 h-3" />
                        <span>Evolved into {blobbi.evolutionForm.charAt(0).toUpperCase() + blobbi.evolutionForm.slice(1)}</span>
                      </div>
                      {blobbi.evolutionTime && (
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(blobbi.evolutionTime, { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <BlobbiStats blobbi={blobbi} />

              {/* Evolution Progress - show for owner only */}
              {isOwner && (
                <EvolutionProgress
                  evolutionProgress={blobbi.evolutionProgress}
                  hasEvolved={!!blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi'}
                />
              )}
            </div>

            {/* Right column - Actions and info */}
            <div className="space-y-2 overflow-hidden">
              {isOwner ? (
                <BlobbiActions
                  blobbi={blobbi}
                  onAction={performAction}
                  isPerformingAction={isPerformingAction}
                  onGamesClick={() => setShowGames(true)}
                  onOpenShop={() => setShowShop(true)}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Viewing Mode</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      You're viewing someone else's Blobbi. Only the owner can interact with it.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Pet info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pet Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
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
                    <span className="text-muted-foreground">Last Care</span>
                    <span>{formatDistanceToNow(blobbi.lastInteraction * 1000, { addSuffix: true })}</span>
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
            </div>
          </div>
        </TabsContent>

        <TabsContent value="incubation" className="space-y-4">
          <BlobbiIncubationDashboard />
        </TabsContent>
      </Tabs>

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
  );
}