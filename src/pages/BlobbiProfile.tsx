import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Coins, Trophy, Calendar } from 'lucide-react';
import { BlobbiLayout } from '@/components/BlobbiLayout';
import { LoginArea } from '@/components/auth/LoginArea';
import { useBlobbi } from '@/hooks/useBlobbi';
import { useAuthor } from '@/hooks/useAuthor';
import { BlobbiVisual } from '@/components/blobbi/BlobbiVisual';
import { BlobbiStats } from '@/components/blobbi/BlobbiStats';
import { BlobbiActions } from '@/components/blobbi/BlobbiActions';
import { formatDistanceToNow } from 'date-fns';

export default function BlobbiProfile() {
  const { pubkey } = useParams<{ pubkey: string }>();
  const navigate = useNavigate();
  const { 
    blobbi, 
    isLoading, 
    performAction, 
    isPerformingAction,
    isOwner 
  } = useBlobbi(pubkey);
  
  const author = useAuthor(pubkey || '');
  const displayName = author.data?.metadata?.name || pubkey?.slice(0, 8) || 'Unknown';
  
  if (isLoading) {
    return (
      <BlobbiLayout>
        <div className="container mx-auto py-8 px-4">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/blobbi/community')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-4xl font-bold">Loading...</h1>
            </div>
          </div>
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </BlobbiLayout>
    );
  }
  
  if (!blobbi) {
    return (
      <BlobbiLayout>
        <div className="container mx-auto py-8 px-4">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/blobbi/community')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-4xl font-bold">No Blobbi Found</h1>
            </div>
          </div>
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                This user hasn't adopted a Blobbi yet.
              </p>
              {isOwner && (
                <Button 
                  className="mt-4" 
                  onClick={() => navigate('/blobbi')}
                >
                  Adopt Your Blobbi
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </BlobbiLayout>
    );
  }
  
  return (
    <BlobbiLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/blobbi/community')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold">{blobbi.name}</h1>
              <p className="text-muted-foreground">Owned by {displayName}</p>
            </div>
          </div>
        </div>
      
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header with pet info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{blobbi.name}</CardTitle>
                <CardDescription>
                  {blobbi.lifeStage.charAt(0).toUpperCase() + blobbi.lifeStage.slice(1)} • 
                  Born {formatDistanceToNow(blobbi.birthTime, { addSuffix: true })}
                </CardDescription>
              </div>
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
            </div>
          </CardHeader>
        </Card>
        
        <div className="grid md:grid-cols-2 gap-4">
          {/* Left column - Visual and stats */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-8">
                <div className="flex justify-center">
                  <BlobbiVisual 
                    blobbi={blobbi} 
                    size="large"
                    onClick={() => isOwner && performAction('play')}
                  />
                </div>
                {blobbi.state === 'hibernating' && (
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    This Blobbi is hibernating. {isOwner ? 'Interact with it to wake it up!' : 'It needs its owner\'s attention.'}
                  </p>
                )}
              </CardContent>
            </Card>
            
            <BlobbiStats stats={blobbi.stats} lifeStage={blobbi.lifeStage} blobbi={blobbi} />
          </div>
          
          {/* Right column - Actions and info */}
          <div className="space-y-4">
            {isOwner ? (
              <BlobbiActions 
                blobbi={blobbi}
                onAction={performAction}
                isPerformingAction={isPerformingAction}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Viewing Mode</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    You're viewing {displayName}'s Blobbi. Only the owner can interact with it.
                  </p>
                  <Button 
                    className="mt-4 w-full" 
                    variant="outline"
                    onClick={() => navigate('/blobbi')}
                  >
                    Visit Your Own Blobbi
                  </Button>
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
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Owner</span>
                  <span className="font-mono text-xs">{pubkey?.slice(0, 8)}...</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      </div>
    </BlobbiLayout>
  );
}