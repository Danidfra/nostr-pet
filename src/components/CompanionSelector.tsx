import { useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { useSetCurrentCompanion } from '@/hooks/useSetCurrentCompanion';
import { useUserBlobbis } from '@/hooks/useUserBlobbis';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Heart, Baby } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

export function CompanionSelector() {
  const { user } = useCurrentUser();
  const { data: profile } = useBlobbonautProfile();
  const { data: blobbis, isLoading } = useUserBlobbis();
  const { mutate: setCompanion, isPending } = useSetCurrentCompanion();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  if (!user || !profile) {
    return null;
  }

  const currentCompanionId = profile.currentCompanion;
  const currentCompanion = blobbis?.find(b => b.id === currentCompanionId);

  const handleSelectCompanion = (blobbiId: string | null) => {
    setCompanion(blobbiId, {
      onSuccess: () => {
        toast({
          title: blobbiId ? "Companion Selected!" : "Companion Removed",
          description: blobbiId 
            ? "Your new companion will follow you around the site!" 
            : "Your companion has been dismissed.",
        });
        setOpen(false);
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          {currentCompanion ? `Companion: ${currentCompanion.name}` : 'Select Companion'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Your Companion</DialogTitle>
          <DialogDescription>
            Choose a Blobbi to accompany you as you browse the site. Your companion will appear on all Blobbi pages.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {isLoading ? (
            <div className="text-center py-8">Loading your Blobbis...</div>
          ) : blobbis && blobbis.length > 0 ? (
            <>
              {blobbis.map((blobbi) => (
                <Card 
                  key={blobbi.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    currentCompanionId === blobbi.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => handleSelectCompanion(blobbi.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">
                          {blobbi.lifeStage === 'egg' ? '🥚' : 
                           blobbi.lifeStage === 'baby' ? '👶' : '🎭'}
                        </div>
                        <div>
                          <h3 className="font-semibold">{blobbi.name}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="secondary" className="text-xs">
                              {blobbi.lifeStage}
                            </Badge>
                            {blobbi.evolutionForm && (
                              <Badge variant="outline" className="text-xs">
                                {blobbi.evolutionForm}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Heart className="h-4 w-4 text-red-500" />
                          <span>{Math.round(blobbi.stats.happiness)}%</span>
                        </div>
                        {currentCompanionId === blobbi.id && (
                          <Badge>Current</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {currentCompanionId && (
                <Button
                  variant="outline"
                  onClick={() => handleSelectCompanion(null)}
                  disabled={isPending}
                  className="w-full"
                >
                  Remove Companion
                </Button>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                You don't have any Blobbis yet. Adopt one to select it as your companion!
              </p>
              <Button onClick={() => window.location.href = '/blobbi/adopt'}>
                Adopt a Blobbi
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}