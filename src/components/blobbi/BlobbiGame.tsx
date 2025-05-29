import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Coins, Trophy, Calendar, Heart, ShoppingBag, Palette, Sparkles, Package } from 'lucide-react';
import { useBlobbi } from '@/hooks/useBlobbi';
import { BlobbiVisual } from './BlobbiVisual';
import { BlobbiEvolvedVisual } from './BlobbiEvolvedVisual';
import { BlobbiStats } from './BlobbiStats';
import { BlobbiActions } from './BlobbiActions';
import { BlobbiShop } from './BlobbiShop';
import { BlobbiStorage } from './BlobbiStorage';
import { BlobbiCustomization } from './BlobbiCustomization';
import { BlobbiGamesModal } from './BlobbiGamesModal';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { LoginArea } from '@/components/auth/LoginArea';
import { formatDistanceToNow } from 'date-fns';

export function BlobbiGame() {
  const { user } = useCurrentUser();
  const { 
    blobbi, 
    isLoading, 
    createBlobbi, 
    performAction, 
    isCreating, 
    isPerformingAction,
    isOwner 
  } = useBlobbi();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [petName, setPetName] = useState('Blobbi');
  const [showShop, setShowShop] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [showStorage, setShowStorage] = useState(false);
  
  const handleCreateBlobbi = () => {
    createBlobbi(petName);
    setShowCreateDialog(false);
  };
  
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
              Each Nostr account can have one unique Blobbi pet that lives forever on the decentralized network.
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
      <>
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Welcome to Blobbi!</CardTitle>
            <CardDescription>
              You don't have a Blobbi yet. Adopt one to start your journey!
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="w-48 h-48 bg-muted rounded-full flex items-center justify-center">
              <span className="text-4xl">🥚</span>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} size="lg">
              Adopt a Blobbi
            </Button>
          </CardContent>
        </Card>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Name Your Blobbi</DialogTitle>
              <DialogDescription>
                Choose a name for your new pet. This will be permanent!
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pet-name">Pet Name</Label>
                <Input
                  id="pet-name"
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  placeholder="Enter a name..."
                  maxLength={20}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateBlobbi} disabled={!petName.trim() || isCreating}>
                {isCreating ? 'Creating...' : 'Adopt'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header with pet info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-2xl">{blobbi.name}</CardTitle>
              <CardDescription>
                {blobbi.lifeStage.charAt(0).toUpperCase() + blobbi.lifeStage.slice(1)} • 
                Born {formatDistanceToNow(blobbi.birthTime, { addSuffix: true })}
              </CardDescription>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <div className="flex gap-4 text-sm">
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
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowShop(true)}
                    className="gap-1"
                  >
                    <ShoppingBag className="w-3 h-3" />
                    Shop
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowStorage(true)}
                    className="gap-1"
                  >
                    <Package className="w-3 h-3" />
                    Storage
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCustomization(true)}
                    className="gap-1"
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
      
      <div className="grid md:grid-cols-2 gap-4">
        {/* Left column - Visual and stats */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-8">
              <div className="flex justify-center">
                {blobbi.evolutionForm ? (
                  <BlobbiEvolvedVisual 
                    blobbi={blobbi} 
                    size="large"
                    onClick={() => isOwner && performAction('play')}
                  />
                ) : (
                  <BlobbiVisual 
                    blobbi={blobbi} 
                    size="large"
                    onClick={() => isOwner && performAction('play')}
                  />
                )}
              </div>
              {blobbi.state === 'hibernating' && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Your Blobbi is hibernating. Interact with it to wake it up!
                </p>
              )}
              {!blobbi.evolutionForm && (
                <div className="text-center mt-4">
                  <p className="text-sm text-muted-foreground animate-pulse">
                    <Sparkles className="w-4 h-4 inline mr-1" />
                    Ready to evolve! Care for your Blobbi to trigger evolution.
                  </p>
                </div>
              )}
              {blobbi.evolutionForm && (
                <div className="text-center mt-4 space-y-1">
                  <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                    <Sparkles className="w-4 h-4" />
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
          
          <BlobbiStats stats={blobbi.stats} />
        </div>
        
        {/* Right column - Actions and info */}
        <div className="space-y-4">
          {isOwner ? (
            <BlobbiActions 
              blobbi={blobbi}
              onAction={performAction}
              isPerformingAction={isPerformingAction}
              onGamesClick={() => setShowGames(true)}
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
                <span>{formatDistanceToNow(blobbi.lastInteraction, { addSuffix: true })}</span>
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
              {!blobbi.evolutionForm && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Evolution</span>
                  <span className="text-xs text-muted-foreground">
                    After first care action
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
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
  );
}