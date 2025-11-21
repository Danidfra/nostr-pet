import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/useToast';
import { useUserBlobbis } from '@/hooks/useUserBlobbis';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Blobbi, BlobbiStats } from '@/types/blobbi';
import { isValidBaseColor, isValidSecondaryColor } from '@/lib/blobbi-egg-validation';
import { isDivineEgg } from '@/lib/blobbi-divine-utils';
import { createBlobbiStateEvent } from '@/lib/blobbi-events';
import { mergeBlobbiStateTags } from '@/lib/blobbi-state-merge';

// DEV-ONLY: This component should only be available in development
const isDevelopment = process.env.NODE_ENV === 'development' ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost');

interface EditableBlobbi extends Blobbi {
  _isModified?: boolean;
  _originalStats?: BlobbiStats;
  _originalFields?: Partial<Blobbi>;
}

export default function BlobbiStatusDebug() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { data: blobbis, isLoading, error } = useUserBlobbis();
  const { toast } = useToast();
  const { mutateAsync: publishEvent } = useNostrPublish();

  // Redirect if not in development
  React.useEffect(() => {
    if (!isDevelopment) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  // Track if we've initialized editable state to prevent re-initialization
  const initializedRef = useRef(false);

  // Create editable versions of Blobbis - only initialize once
  const [editableBlobbis, setEditableBlobbis] = useState<EditableBlobbi[]>([]);

  React.useEffect(() => {
    // Only initialize if we have blobbis and haven't initialized yet
    if (blobbis && !initializedRef.current) {
      const editable = blobbis.map(blobbi => ({
        ...blobbi,
        _isModified: false,
        _originalStats: { ...blobbi.stats },
        _originalFields: {
          baseColor: blobbi.baseColor,
          secondaryColor: blobbi.secondaryColor,
          pattern: blobbi.pattern,
          eyeColor: blobbi.eyeColor,
          specialMark: blobbi.specialMark,
          themeVariant: blobbi.themeVariant,
          mood: blobbi.mood,
          size: blobbi.size,
          title: blobbi.title,
          skill: blobbi.skill,
          personality: blobbi.personality,
          traits: blobbi.traits,
          isSleeping: blobbi.isSleeping,
          isDirty: blobbi.isDirty,
          hasBuff: blobbi.hasBuff,
          hasDebuff: blobbi.hasDebuff,
          eggTemperature: blobbi.eggTemperature,
          shellIntegrity: blobbi.shellIntegrity,
        }
      }));
      setEditableBlobbis(editable);
      initializedRef.current = true;
    }
  }, [blobbis]);

  // Update functions
  const updateBlobbiStat = useCallback((blobbiId: string, stat: keyof BlobbiStats, value: number) => {
    setEditableBlobbis(prev => prev.map(blobbi => {
      if (blobbi.id === blobbiId) {
        const clampedValue = Math.max(0, Math.min(100, value));
        const updatedStats = { ...blobbi.stats, [stat]: clampedValue };
        const isModified = JSON.stringify(updatedStats) !== JSON.stringify(blobbi._originalStats);

        return {
          ...blobbi,
          stats: updatedStats,
          _isModified: blobbi._isModified || isModified,
        };
      }
      return blobbi;
    }));
  }, []);

  const updateBlobbiField = useCallback((blobbiId: string, field: string, value: any) => {
    setEditableBlobbis(prev => prev.map(blobbi => {
      if (blobbi.id === blobbiId) {
        const updated = { ...blobbi, [field]: value };
        const isModified = JSON.stringify(updated) !== JSON.stringify({
          ...blobbi,
          ...blobbi._originalFields,
        });

        return {
          ...updated,
          _isModified: isModified,
        };
      }
      return blobbi;
    }));
  }, []);

  // Quick stat presets
  const setAllStatsToMax = useCallback(() => {
    const maxStats: BlobbiStats = {
      hunger: 100,
      happiness: 100,
      health: 100,
      hygiene: 100,
      energy: 100,
    };

    setEditableBlobbis(prev => prev.map(blobbi => ({
      ...blobbi,
      stats: maxStats,
      _isModified: true,
    })));
  }, []);

  const setAllStatsToLow = useCallback(() => {
    const lowStats: BlobbiStats = {
      hunger: 5,
      happiness: 5,
      health: 5,
      hygiene: 5,
      energy: 5,
    };

    setEditableBlobbis(prev => prev.map(blobbi => ({
      ...blobbi,
      stats: lowStats,
      _isModified: true,
    })));
  }, []);

  const setAllBlobbisToMax = useCallback(() => {
    const maxStats: BlobbiStats = {
      hunger: 100,
      happiness: 100,
      health: 100,
      hygiene: 100,
      energy: 100,
    };

    setEditableBlobbis(prev => prev.map(blobbi => ({
      ...blobbi,
      stats: maxStats,
      _isModified: true,
    })));
  }, []);

  const setAllBlobbisToLow = useCallback(() => {
    const lowStats: BlobbiStats = {
      hunger: 5,
      happiness: 5,
      health: 5,
      hygiene: 5,
      energy: 5,
    };

    setEditableBlobbis(prev => prev.map(blobbi => ({
      ...blobbi,
      stats: lowStats,
      _isModified: true,
    })));
  }, []);

  // Helper function to update a single Blobbi via Nostr
  const updateSingleBlobbi = async (editableBlobbi: EditableBlobbi) => {
    try {
      // Remove helper fields
      const { _isModified, _originalStats, _originalFields, ...updatedBlobbi } = editableBlobbi;

      console.log(`[Dev Debug] Updating Blobbi ${editableBlobbi.id}:`, {
        stats: updatedBlobbi.stats,
        fields: {
          baseColor: updatedBlobbi.baseColor,
          secondaryColor: updatedBlobbi.secondaryColor,
          pattern: updatedBlobbi.pattern,
          specialMark: updatedBlobbi.specialMark,
          personality: updatedBlobbi.personality,
          traits: updatedBlobbi.traits,
        }
      });

      // Create state event using existing pipeline
      const stateEventData = createBlobbiStateEvent(updatedBlobbi);

      // Merge with existing tags to preserve everything
      const mergedTags = mergeBlobbiStateTags([], {
        additionalTags: stateEventData.tags,
        preserveIncubationAndQuestTags: true,
      });

      // Publish the update
      await publishEvent({
        kind: 31124,
        content: `${updatedBlobbi.name} is a ${updatedBlobbi.lifeStage} Blobbi.`,
        tags: mergedTags,
      });

      return { success: true, blobbiId: editableBlobbi.id };
    } catch (error) {
      console.error(`Failed to update Blobbi ${editableBlobbi.id}:`, error);
      return { success: false, blobbiId: editableBlobbi.id, error };
    }
  };

  // Apply changes for all modified Blobbis
  const applyChanges = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to apply changes",
        variant: "destructive",
      });
      return;
    }

    const modifiedBlobbis = editableBlobbis.filter(b => b._isModified);
    if (modifiedBlobbis.length === 0) {
      toast({
        title: "No Changes",
        description: "No Blobbis have been modified",
        variant: "default",
      });
      return;
    }

    let success = 0;
    let failed = 0;
    const results: Array<{ success: boolean; blobbiId: string; error?: any }> = [];

    // Update each Blobbi individually
    for (const editableBlobbi of modifiedBlobbis) {
      const result = await updateSingleBlobbi(editableBlobbi);
      results.push(result);
      if (result.success) {
        success++;
      } else {
        failed++;
      }
    }

    toast({
      title: "Changes Applied",
      description: `Updated ${success} Blobbis successfully${failed > 0 ? `, ${failed} failed` : ''}`,
      variant: failed === 0 ? "default" : "destructive",
    });

    // Invalidate queries to refresh data
    if (success > 0) {
      // Force refetch of user Blobbis
      window.location.reload();
    }
  };

  if (!isDevelopment) {
    return null; // Don't render anything in production
  }

  if (isLoading) {
    return <div className="p-8"><div className="py-8">Loading Blobbis...</div></div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <Alert>
          <AlertDescription>
            Error loading Blobbis: {error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!blobbis || blobbis.length === 0) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground">No Blobbis found. Adopt some Blobbis first!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Blobbi Status Debug (DEV ONLY)</h1>
          <p className="text-muted-foreground">Edit stats and tags for testing purposes</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={setAllBlobbisToMax}
            variant="outline"
            size="sm"
          >
            Set ALL to MAX
          </Button>
          <Button
            onClick={setAllBlobbisToLow}
            variant="outline"
            size="sm"
          >
            Set ALL to LOW
          </Button>
          <Button
            onClick={applyChanges}
            className="bg-green-600 hover:bg-green-700"
            disabled={editableBlobbis.filter(b => b._isModified).length === 0}
          >
            Apply Changes ({editableBlobbis.filter(b => b._isModified).length})
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {editableBlobbis.map(blobbi => (
          <Card key={blobbi.id} className={`${blobbi._isModified ? 'border-orange-500 ring-2 ring-orange-500' : ''}`}>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {blobbi.name}
                    {blobbi._isModified && <Badge variant="secondary">Modified</Badge>}
                  </CardTitle>
                  <CardDescription>ID: {blobbi.id} | Stage: {blobbi.lifeStage}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAllStatsToMax()}
                  >
                    Max
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAllStatsToLow()}
                  >
                    Low
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="stats" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="stats">Stats</TabsTrigger>
                  <TabsTrigger value="appearance">Appearance</TabsTrigger>
                  <TabsTrigger value="behavior">Behavior</TabsTrigger>
                </TabsList>

                <TabsContent value="stats" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(blobbi.stats).map(([stat, value]) => (
                      <div key={stat} className="space-y-2">
                        <Label className="capitalize">{stat}</Label>
                        <div className="flex items-center gap-4">
                          <Slider
                            value={[value]}
                            onValueChange={([newValue]) => updateBlobbiStat(blobbi.id, stat as keyof BlobbiStats, newValue)}
                            max={100}
                            min={0}
                            step={1}
                            className="flex-1"
                          />
                          <span className="w-12 text-right font-mono text-sm">{value}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Egg-specific fields */}
                  {blobbi.lifeStage === 'egg' && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <Label>Egg Temperature</Label>
                        <div className="flex items-center gap-4">
                          <Slider
                            value={[blobbi.eggTemperature || 0]}
                            onValueChange={([value]) => updateBlobbiField(blobbi.id, 'eggTemperature', value)}
                            max={100}
                            min={0}
                            step={1}
                            className="flex-1"
                          />
                          <span className="w-12 text-right font-mono text-sm">{blobbi.eggTemperature || 0}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Shell Integrity</Label>
                        <div className="flex items-center gap-4">
                          <Slider
                            value={[blobbi.shellIntegrity || 100]}
                            onValueChange={([value]) => updateBlobbiField(blobbi.id, 'shellIntegrity', value)}
                            max={100}
                            min={0}
                            step={1}
                            className="flex-1"
                          />
                          <span className="w-12 text-right font-mono text-sm">{blobbi.shellIntegrity || 100}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="appearance" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Base Color</Label>
                      <Input
                        id="baseColor"
                        value={blobbi.baseColor || ''}
                        onChange={(e) => updateBlobbiField(blobbi.id, 'baseColor', e.target.value)}
                        placeholder="#ffccaa"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Secondary Color</Label>
                      <Input
                        id="secondaryColor"
                        value={blobbi.secondaryColor || ''}
                        onChange={(e) => updateBlobbiField(blobbi.id, 'secondaryColor', e.target.value)}
                        placeholder="#ffeeaa"
                        disabled={isDivineEgg(blobbi)} // Divine Blobbis don't use secondary colors
                      />
                      {isDivineEgg(blobbi) && (
                        <p className="text-sm text-muted-foreground mt-1">Divine Blobbis don't use secondary colors</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Pattern</Label>
                      <Input
                        id="pattern"
                        value={blobbi.pattern || ''}
                        onChange={(e) => updateBlobbiField(blobbi.id, 'pattern', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Eye Color</Label>
                      <Input
                        id="eyeColor"
                        value={blobbi.eyeColor || ''}
                        onChange={(e) => updateBlobbiField(blobbi.id, 'eyeColor', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Special Mark</Label>
                      <Input
                        id="specialMark"
                        value={blobbi.specialMark || ''}
                        onChange={(e) => updateBlobbiField(blobbi.id, 'specialMark', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Size</Label>
                      <Input
                        id="size"
                        value={blobbi.size || ''}
                        onChange={(e) => updateBlobbiField(blobbi.id, 'size', e.target.value)}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="behavior" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Mood</Label>
                      <Input
                        id="mood"
                        value={blobbi.mood || ''}
                        onChange={(e) => updateBlobbiField(blobbi.id, 'mood', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        id="title"
                        value={blobbi.title || ''}
                        onChange={(e) => updateBlobbiField(blobbi.id, 'title', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Skill</Label>
                      <Input
                        id="skill"
                        value={blobbi.skill || ''}
                        onChange={(e) => updateBlobbiField(blobbi.id, 'skill', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Personality (comma-separated)</Label>
                      <Textarea
                        id="personality"
                        value={(blobbi.personality || []).join(', ')}
                        onChange={(e) => updateBlobbiField(blobbi.id, 'personality', e.target.value.split(',').map(s => s.trim()))}
                        placeholder="playful, curious"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Traits (comma-separated)</Label>
                      <Textarea
                        id="traits"
                        value={(blobbi.traits || []).join(', ')}
                        onChange={(e) => updateBlobbiField(blobbi.id, 'traits', e.target.value.split(',').map(s => s.trim()))}
                        placeholder="fast_learner, friendly"
                      />
                    </div>

                    {/* Toggles */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="isSleeping"
                          checked={blobbi.isSleeping || false}
                          onCheckedChange={(checked) => updateBlobbiField(blobbi.id, 'isSleeping', checked)}
                        />
                        <Label htmlFor="isSleeping">Is Sleeping</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="isDirty"
                          checked={blobbi.isDirty || false}
                          onCheckedChange={(checked) => updateBlobbiField(blobbi.id, 'isDirty', checked)}
                        />
                        <Label htmlFor="isDirty">Is Dirty</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Label>Has Buff</Label>
                        <Input
                          id="hasBuff"
                          value={blobbi.hasBuff || ''}
                          onChange={(e) => updateBlobbiField(blobbi.id, 'hasBuff', e.target.value)}
                          placeholder="energy_boost"
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Label>Has Debuff</Label>
                        <Input
                          id="hasDebuff"
                          value={blobbi.hasDebuff || ''}
                          onChange={(e) => updateBlobbiField(blobbi.id, 'hasDebuff', e.target.value)}
                          placeholder="slowness"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}