import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCreateBlobbi } from '@/hooks/useBlobbiEvents';
import { useToast } from '@/hooks/useToast';
import { BlobbiLifeStage, BlobbiRecordData } from '@/types/blobbi';
import { Plus, Egg, Baby, Crown } from 'lucide-react';

interface CreateBlobbiDialogProps {
  children?: React.ReactNode;
}

export const CreateBlobbiDialog: React.FC<CreateBlobbiDialogProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [stage, setStage] = useState<BlobbiLifeStage>('egg');
  const [origin, setOrigin] = useState('wild');
  const [rarity, setRarity] = useState('common');
  
  const { createBlobbi, isCreating } = useCreateBlobbi();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a name for your Blobbi.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const birthData: Partial<BlobbiRecordData> = {
        origin,
        rarity,
        birthLocation: origin === 'wild' ? 'enchanted_grove' : 'laboratory',
        weatherAtBirth: 'misty_morning',
        birthSeason: 'spring',
        birthMoonPhase: 'new_moon',
        initialTrait: getInitialTraits(rarity),
      };

      await createBlobbi({
        name: name.trim(),
        stage,
        birthData,
      });

      toast({
        title: 'Blobbi Created!',
        description: `${name} has been born and is ready for care!`,
      });

      setOpen(false);
      setName('');
      setStage('egg');
      setOrigin('wild');
      setRarity('common');
    } catch (error) {
      toast({
        title: 'Creation Failed',
        description: error instanceof Error ? error.message : 'Failed to create Blobbi',
        variant: 'destructive',
      });
    }
  };

  const getInitialTraits = (rarity: string): string[] => {
    const baseTraits = ['curious', 'friendly'];
    
    switch (rarity) {
      case 'uncommon':
        return [...baseTraits, 'energetic'];
      case 'rare':
        return [...baseTraits, 'energetic', 'intelligent'];
      case 'epic':
        return [...baseTraits, 'energetic', 'intelligent', 'magical'];
      case 'legendary':
        return [...baseTraits, 'energetic', 'intelligent', 'magical', 'ancient_wisdom'];
      default:
        return baseTraits;
    }
  };

  const getStageDescription = (stage: BlobbiLifeStage) => {
    switch (stage) {
      case 'egg':
        return 'Requires 4 days of consistent care to hatch. Perfect for learning the basics!';
      case 'baby':
        return 'Already hatched and ready for immediate interaction. Great for experienced caretakers.';
      case 'adult':
        return 'Fully grown and capable of breeding. Ideal for advanced gameplay.';
      default:
        return '';
    }
  };

  const getRarityDescription = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'Standard traits, perfect for beginners';
      case 'uncommon':
        return 'Enhanced energy, more active personality';
      case 'rare':
        return 'High intelligence, learns faster';
      case 'epic':
        return 'Magical abilities, unique interactions';
      case 'legendary':
        return 'Ancient wisdom, extremely rare traits';
      default:
        return '';
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'default';
      case 'uncommon':
        return 'secondary';
      case 'rare':
        return 'outline';
      case 'epic':
        return 'destructive';
      case 'legendary':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Blobbi
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Your Blobbi</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your Blobbi's name"
              maxLength={20}
            />
          </div>

          {/* Life Stage Selection */}
          <div className="space-y-3">
            <Label>Starting Life Stage</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(['egg', 'baby', 'adult'] as BlobbiLifeStage[]).map((stageOption) => (
                <Card 
                  key={stageOption}
                  className={`cursor-pointer transition-all ${
                    stage === stageOption 
                      ? 'ring-2 ring-primary bg-primary/5' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setStage(stageOption)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {stageOption === 'egg' && <Egg className="h-4 w-4" />}
                      {stageOption === 'baby' && <Baby className="h-4 w-4" />}
                      {stageOption === 'adult' && <Crown className="h-4 w-4" />}
                      {stageOption.charAt(0).toUpperCase() + stageOption.slice(1)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-xs">
                      {getStageDescription(stageOption)}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Origin Selection */}
          <div className="space-y-2">
            <Label htmlFor="origin">Origin</Label>
            <Select value={origin} onValueChange={setOrigin}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wild">Wild - Found in nature</SelectItem>
                <SelectItem value="lab">Laboratory - Scientifically created</SelectItem>
                <SelectItem value="gift">Gift - Received from another trainer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rarity Selection */}
          <div className="space-y-3">
            <Label>Rarity</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {['common', 'uncommon', 'rare', 'epic', 'legendary'].map((rarityOption) => (
                <Card 
                  key={rarityOption}
                  className={`cursor-pointer transition-all ${
                    rarity === rarityOption 
                      ? 'ring-2 ring-primary bg-primary/5' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setRarity(rarityOption)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      {rarityOption.charAt(0).toUpperCase() + rarityOption.slice(1)}
                      <Badge variant={getRarityColor(rarityOption) as 'default' | 'secondary' | 'destructive' | 'outline'} className="text-xs">
                        {getInitialTraits(rarityOption).length} traits
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-xs">
                      {getRarityDescription(rarityOption)}
                    </CardDescription>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {getInitialTraits(rarityOption).map((trait, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {trait}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !name.trim()}>
              {isCreating ? 'Creating...' : 'Create Blobbi'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};