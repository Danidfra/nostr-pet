import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/useToast';
import { useUserBlobbis } from '@/hooks/useUserBlobbis';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Blobbi, BlobbiStats } from '@/types/blobbi';
import { NostrEvent } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { BlobbiVisual } from '@/components/blobbi/BlobbiVisual';
import { BlobbiEvolvedVisual } from '@/components/blobbi/BlobbiEvolvedVisual';
import { EggGraphic } from '@/components/blobbi/EggGraphic';
import {
  ALL_VALID_BASE_COLORS,
  ALL_VALID_SECONDARY_COLORS,
  ALL_VALID_EYE_COLORS,
  ALL_VALID_SIZES,
  ALL_VALID_TITLES,
  VALID_PATTERNS,
  VALID_EGG_STATUSES,
  ALL_VALID_SPECIAL_MARKS,
} from '@/lib/blobbi-egg-validation';

// DEV-ONLY: This component should only be available in development on localhost
const isDevelopment = import.meta.env.DEV;
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const shouldRender = isDevelopment && isLocalhost;

// Sentinel value for "None" in Select dropdowns (never use value="")
const NONE = '__none__';

// Evolution forms for adult Blobbis
const EVOLUTION_FORMS = [
  'blobbi', 'pandi', 'owli', 'catti', 'froggi',
  'cloudi', 'crysti', 'bloomi', 'starri', 'flammi',
  'droppi', 'breezy', 'rocky', 'cacti', 'mushie',
  'leafy', 'rosey'
] as const;

const LIFE_STAGES = ['egg', 'baby', 'adult'] as const;
const MOODS = ['happy', 'sad', 'sleepy', 'hungry', 'dirty', 'sick', 'neutral', 'playful'] as const;
const STATES = ['active', 'sleeping', 'hibernating'] as const;

// DEV-ONLY option sets from the codebase
const MANIFESTATIONS = [
  'dot_center', 'oval_spots', 'side_bands', 'dot_speckle', 'light_dash', 
  'freckle_patch', 'sparkle_trail', 'light_smoke', 'dusty_aura',
  'ring_mark', 'glow_ring', 'wavy_spots', 'mist_drift',
  'rune_top', 'spirit_knot', 'crescent_moon', 'tiny_star', 'glow_blue',
  'sigil_eye', 'ethereal_rune', 'leaf_stamp', 'divine_circle', 'angel_halo'
] as const;

const VISUAL_EFFECTS = [
  'stripes', 'dots', 'gradient', 'soft_wave',
  'spiral_twist', 'galaxy_dust', 'crackled_lines',
  'nebula_bloom', 'sacred_geometry', 'shifting_rings'
] as const;

const BLESSINGS = [
  'telepathic', 'keen_sense', 'light_heal',
  'night_vision', 'inner_peace', 'sun_gifted',
  'eternal_grace', 'blessing_of_light', 'soul_touch'
] as const;

const THEME_VARIANTS = ['divine', 'standard', 'special'] as const;

interface BlobbiPatch {
  // Core fields
  name?: string;
  lifeStage?: 'egg' | 'baby' | 'adult';
  state?: 'active' | 'sleeping' | 'hibernating';
  
  // Stats
  stats?: Partial<BlobbiStats>;
  
  // Progression
  experience?: number;
  coins?: number;
  generation?: number;
  careStreak?: number;
  
  // Evolution
  evolutionForm?: typeof EVOLUTION_FORMS[number];
  evolutionTime?: number;
  
  // Appearance
  baseColor?: string;
  secondaryColor?: string;
  pattern?: string;
  eyeColor?: string;
  specialMark?: string;
  manifestation?: string;
  visualEffect?: string;
  blessing?: string;
  
  // Personality
  personality?: string[];
  traits?: string[];
  mood?: typeof MOODS[number];
  favoriteFood?: string;
  voiceType?: string;
  size?: string;
  title?: string;
  skill?: string;
  
  // Egg-specific
  incubationTime?: number;
  incubationProgress?: number;
  eggTemperature?: number;
  eggStatus?: string;
  shellIntegrity?: number;
  
  // Behavior
  isSleeping?: boolean;
  isDirty?: boolean;
  hasBuff?: string;
  hasDebuff?: string;
  
  // Divine
  themeVariant?: string;
  crossoverApp?: string | null;
}

// Generate a unique visual key based on all visual properties
// This forces remounting when any visual field changes
function generateVisualKey(blobbi: Blobbi): string {
  return [
    blobbi.id,
    blobbi.lifeStage,
    blobbi.evolutionForm,
    blobbi.baseColor,
    blobbi.secondaryColor,
    blobbi.eyeColor,
    blobbi.pattern,
    blobbi.specialMark,
    blobbi.manifestation,
    blobbi.visualEffect,
    blobbi.blessing,
    blobbi.themeVariant,
    blobbi.crossoverApp,
    blobbi.eggTemperature,
    blobbi.eggStatus,
    blobbi.shellIntegrity,
    blobbi.incubationProgress,
    blobbi.size,
    blobbi.mood,
    blobbi.state,
    // Include stats that affect visual (health for dirt/sickness)
    blobbi.stats.health,
    blobbi.stats.hygiene,
    blobbi.stats.happiness,
  ].join('|');
}

// Helper component to render Blobbi visuals consistently
// NOT memoized to allow immediate re-renders on prop changes
interface BlobbiPreviewProps {
  blobbi: Blobbi;
  size?: 'tiny' | 'small' | 'medium';
  className?: string;
}

function BlobbiPreview({ blobbi, size = 'medium', className }: BlobbiPreviewProps) {
  // Generate visual key for forced remounting
  const visualKey = generateVisualKey(blobbi);
  
  // CRITICAL FIX: Create a new blobbi object with modified ID to force new gradient IDs
  // The visual components use blobbi.id as patternIdPrefix, which doesn't change
  // We need to make the ID unique based on visual properties to force gradient recreation
  const blobbiWithUniqueId = useMemo(() => {
    return {
      ...blobbi,
      // Append visual key to ID to force new gradient IDs in SVG
      id: `${blobbi.id}-${visualKey}`,
    };
  }, [blobbi, visualKey]);
  
  // Determine which visual component to use
  if (blobbi.lifeStage === 'egg') {
    return (
      <div className={`w-full h-full flex items-center justify-center ${className || ''}`}>
        <div className="w-[80%] h-[80%] flex items-center justify-center">
          <EggGraphic
            key={visualKey}
            blobbi={blobbiWithUniqueId}
            sizeVariant={size === 'tiny' ? 'tiny' : size === 'small' ? 'small' : 'medium'}
            animated={false}
            warmth={blobbi.eggTemperature || 60}
            forceInlineSvg={true}
          />
        </div>
      </div>
    );
  }
  
  // Adult with evolution form
  if (blobbi.lifeStage === 'adult' && blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi') {
    return (
      <div className={`w-full h-full flex items-center justify-center ${className || ''}`}>
        <BlobbiEvolvedVisual
          key={visualKey}
          blobbi={blobbiWithUniqueId}
          size={size}
          forceInlineSvg={true}
        />
      </div>
    );
  }
  
  // Default baby/adult blobbi
  return (
    <div className={`w-full h-full flex items-center justify-center ${className || ''}`}>
      <BlobbiVisual
        key={visualKey}
        blobbi={blobbiWithUniqueId}
        size={size}
        forceInlineSvg={true}
      />
    </div>
  );
}

// Thumbnail component for list items (NOT memoized)
interface BlobbiThumbnailProps {
  blobbi: Blobbi;
}

function BlobbiThumbnail({ blobbi }: BlobbiThumbnailProps) {
  return (
    <div className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg border border-purple-100 dark:border-purple-600/30 flex-shrink-0">
      <BlobbiPreview blobbi={blobbi} size="tiny" />
    </div>
  );
}

export default function BlobbiEditor() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { data: blobbis, isLoading, error } = useUserBlobbis();
  const { toast } = useToast();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { nostr } = useNostr();

  const [selectedBlobbiId, setSelectedBlobbiId] = useState<string | null>(null);
  const [patch, setPatch] = useState<BlobbiPatch>({});
  const [isPublishing, setIsPublishing] = useState(false);
  const [originalEvent, setOriginalEvent] = useState<NostrEvent | null>(null);

  // Redirect if not in development or not localhost
  useEffect(() => {
    if (!shouldRender) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  // Get selected Blobbi
  const selectedBlobbi = useMemo(() => {
    if (!selectedBlobbiId || !blobbis) return null;
    return blobbis.find(b => b.id === selectedBlobbiId) || null;
  }, [selectedBlobbiId, blobbis]);

  // Fetch original event when Blobbi is selected
  useEffect(() => {
    if (!selectedBlobbi) {
      setOriginalEvent(null);
      setPatch({});
      return;
    }

    const fetchOriginalEvent = async () => {
      try {
        const events = await nostr.query(
          [{ 
            kinds: [31124], 
            authors: [selectedBlobbi.ownerPubkey],
            '#d': [selectedBlobbi.id],
            limit: 1
          }],
          { signal: AbortSignal.timeout(3000) }
        );
        
        if (events.length > 0) {
          setOriginalEvent(events[0]);
        }
      } catch (err) {
        console.error('Failed to fetch original event:', err);
        toast({
          title: 'Warning',
          description: 'Could not fetch original event. Changes may overwrite existing data.',
          variant: 'destructive'
        });
      }
    };

    fetchOriginalEvent();
  }, [selectedBlobbi, nostr, toast]);

  // Update a field in the patch - ONLY add if value is not NONE
  const updatePatchField = useCallback(<K extends keyof BlobbiPatch>(field: K, value: BlobbiPatch[K] | typeof NONE) => {
    setPatch(prev => {
      const newPatch = { ...prev };
      
      if (value === NONE || value === undefined || value === '') {
        // Remove from patch when selecting "None"
        delete newPatch[field];
      } else {
        newPatch[field] = value as BlobbiPatch[K];
      }
      
      return newPatch;
    });
  }, []);

  // Update a stat
  const updateStat = useCallback((stat: keyof BlobbiStats, value: number) => {
    setPatch(prev => ({
      ...prev,
      stats: {
        ...(prev.stats || {}),
        [stat]: Math.max(0, Math.min(100, value))
      }
    }));
  }, []);

  // Get merged Blobbi (original + patch) - creates NEW object on every patch change
  // Force new reference to trigger re-renders
  const mergedBlobbi = useMemo((): Blobbi | null => {
    if (!selectedBlobbi) return null;
    
    // Create a deep copy to ensure new object identity
    const merged: Blobbi = JSON.parse(JSON.stringify(selectedBlobbi));
    
    // Apply patch
    Object.keys(patch).forEach(key => {
      const value = patch[key as keyof BlobbiPatch];
      if (value !== undefined) {
        if (key === 'stats' && typeof value === 'object') {
          merged.stats = { ...merged.stats, ...value };
        } else {
          (merged as any)[key] = value;
        }
      }
    });
    
    return merged;
  }, [selectedBlobbi, patch]);

  // Generate diff between original and merged
  const diff = useMemo(() => {
    if (!selectedBlobbi || !mergedBlobbi) return null;
    
    const changes: Array<{ field: string; old: any; new: any }> = [];
    
    // Check all patch fields
    Object.keys(patch).forEach(key => {
      const patchValue = patch[key as keyof BlobbiPatch];
      if (patchValue === undefined) return;
      
      if (key === 'stats') {
        const statPatch = patchValue as Partial<BlobbiStats>;
        Object.keys(statPatch).forEach(statKey => {
          const oldValue = selectedBlobbi.stats[statKey as keyof BlobbiStats];
          const newValue = statPatch[statKey as keyof BlobbiStats];
          if (oldValue !== newValue) {
            changes.push({
              field: `stats.${statKey}`,
              old: oldValue,
              new: newValue
            });
          }
        });
      } else {
        const oldValue = (selectedBlobbi as any)[key];
        const newValue = patchValue;
        
        // Deep comparison for arrays
        if (Array.isArray(oldValue) && Array.isArray(newValue)) {
          if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            changes.push({ field: key, old: oldValue, new: newValue });
          }
        } else if (oldValue !== newValue) {
          changes.push({ field: key, old: oldValue, new: newValue });
        }
      }
    });
    
    return changes;
  }, [selectedBlobbi, mergedBlobbi, patch]);

  // Detect significant visual changes for badges
  const visualChanges = useMemo(() => {
    if (!diff) return { stageChanged: false, evolutionChanged: false };
    
    const stageChanged = diff.some(d => d.field === 'lifeStage');
    const evolutionChanged = diff.some(d => d.field === 'evolutionForm');
    
    return { stageChanged, evolutionChanged };
  }, [diff]);

  // Convert Blobbi to tags (preserving all original tags)
  const generateUpdatedTags = useCallback((blobbi: Blobbi): string[][] => {
    if (!originalEvent) {
      toast({
        title: 'Error',
        description: 'Original event not loaded. Cannot safely update.',
        variant: 'destructive'
      });
      return [];
    }

    // Start with all original tags
    const tags: string[][] = [...originalEvent.tags];
    
    // Helper to update or add a tag
    const setTag = (tagName: string, value: string | number | boolean | undefined | null) => {
      if (value === undefined || value === null || value === '') return;
      
      const strValue = String(value);
      const existingIndex = tags.findIndex(t => t[0] === tagName);
      
      if (existingIndex >= 0) {
        tags[existingIndex] = [tagName, strValue];
      } else {
        tags.push([tagName, strValue]);
      }
    };

    // Helper to remove a tag
    const removeTag = (tagName: string) => {
      const index = tags.findIndex(t => t[0] === tagName);
      if (index >= 0) {
        tags.splice(index, 1);
      }
    };

    // Helper to set multi-value tags (personality, traits)
    const setMultiTag = (tagName: string, values: string[] | undefined) => {
      // Remove all existing tags with this name
      const filtered = tags.filter(t => t[0] !== tagName);
      tags.length = 0;
      tags.push(...filtered);
      
      // Add new tags
      if (values && values.length > 0) {
        values.forEach(value => {
          if (value && value.trim()) {
            tags.push([tagName, value.trim()]);
          }
        });
      }
    };

    // Update required tags
    setTag('d', blobbi.id);
    setTag('stage', blobbi.lifeStage);
    setTag('generation', blobbi.generation);
    setTag('breeding_ready', blobbi.breedingReady);
    
    // Update stats
    Object.entries(blobbi.stats).forEach(([stat, value]) => {
      setTag(stat, value);
    });
    
    // Update state
    setTag('state', blobbi.state);
    setTag('is_sleeping', blobbi.isSleeping || false);
    if (blobbi.isSleeping && blobbi.sleepStartedAt) {
      setTag('sleep_started_at', blobbi.sleepStartedAt);
    } else {
      removeTag('sleep_started_at');
      removeTag('last_sleep_update');
    }
    
    // Update progression
    setTag('experience', blobbi.experience);
    setTag('care_streak', blobbi.careStreak);
    setTag('last_interaction', blobbi.lastInteraction);
    
    // Update appearance
    setTag('base_color', blobbi.baseColor);
    
    // Handle divine Blobbis - they should NOT have secondary_color
    if (blobbi.themeVariant === 'divine' || blobbi.crossoverApp === 'divine') {
      removeTag('secondary_color');
      setTag('theme', 'divine');
      setTag('crossover_app', 'divine');
    } else {
      setTag('secondary_color', blobbi.secondaryColor);
    }
    
    setTag('pattern', blobbi.pattern);
    setTag('eye_color', blobbi.eyeColor);
    setTag('special_mark', blobbi.specialMark);
    setTag('manifestation', blobbi.manifestation);
    setTag('visual_effect', blobbi.visualEffect);
    setTag('blessing', blobbi.blessing);
    
    // Update personality (multi-value)
    setMultiTag('personality', blobbi.personality);
    setMultiTag('trait', blobbi.traits);
    
    setTag('mood', blobbi.mood);
    setTag('favorite_food', blobbi.favoriteFood);
    setTag('voice_type', blobbi.voiceType);
    setTag('size', blobbi.size);
    setTag('title', blobbi.title);
    setTag('skill', blobbi.skill);
    
    // Update egg-specific fields
    if (blobbi.lifeStage === 'egg') {
      setTag('incubation_time', blobbi.incubationTime);
      setTag('incubation_progress', blobbi.incubationProgress);
      setTag('egg_temperature', blobbi.eggTemperature);
      setTag('egg_status', blobbi.eggStatus);
      setTag('shell_integrity', blobbi.shellIntegrity);
    } else {
      // Remove egg tags for non-eggs
      removeTag('incubation_time');
      removeTag('incubation_progress');
      removeTag('egg_temperature');
      removeTag('egg_status');
      removeTag('shell_integrity');
    }
    
    // Update evolution
    if (blobbi.lifeStage === 'adult' && blobbi.evolutionForm) {
      setTag('adult_type', blobbi.evolutionForm);
      setTag('evolution_time', blobbi.evolutionTime);
    }
    
    // Update behavior
    setTag('is_dirty', blobbi.isDirty || false);
    setTag('has_buff', blobbi.hasBuff);
    setTag('has_debuff', blobbi.hasDebuff);
    
    return tags;
  }, [originalEvent, toast]);

  // Publish the update
  const handlePublish = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to publish changes',
        variant: 'destructive'
      });
      return;
    }

    if (!mergedBlobbi || !originalEvent) {
      toast({
        title: 'Error',
        description: 'No Blobbi selected or original event not loaded',
        variant: 'destructive'
      });
      return;
    }

    if (!diff || diff.length === 0) {
      toast({
        title: 'No Changes',
        description: 'No changes to publish',
        variant: 'default'
      });
      return;
    }

    setIsPublishing(true);

    try {
      const updatedTags = generateUpdatedTags(mergedBlobbi);
      
      if (updatedTags.length === 0) {
        throw new Error('Failed to generate tags');
      }

      await publishEvent({
        kind: 31124,
        content: originalEvent.content, // Preserve original content
        tags: updatedTags,
      });

      toast({
        title: 'Success',
        description: `Successfully updated ${mergedBlobbi.name}`,
        variant: 'default'
      });

      // Reset patch
      setPatch({});
      
      // Reload to see changes
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (err) {
      console.error('Failed to publish update:', err);
      toast({
        title: 'Error',
        description: 'Failed to publish update. Check console for details.',
        variant: 'destructive'
      });
    } finally {
      setIsPublishing(false);
    }
  };

  if (!shouldRender) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="py-8">Loading Blobbis...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-8">
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
      <div className="container mx-auto p-8">
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground">
              No Blobbis found. Adopt some Blobbis first!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Deduplicate colors to avoid key conflicts
  const uniqueBaseColors = Array.from(new Set(ALL_VALID_BASE_COLORS));
  const uniqueSecondaryColors = Array.from(new Set(ALL_VALID_SECONDARY_COLORS));
  const uniqueEyeColors = Array.from(new Set(ALL_VALID_EYE_COLORS));

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-3xl font-bold">Blobbi Editor</h1>
          <Badge variant="destructive">DEV ONLY</Badge>
        </div>
        <p className="text-muted-foreground">
          Edit existing Blobbi entities for development and debugging purposes.
          Only available on localhost in dev mode.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel - Blobbi List */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Your Blobbis</CardTitle>
              <CardDescription>
                {blobbis.length} {blobbis.length === 1 ? 'Blobbi' : 'Blobbis'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="space-y-1 p-4">
                  {blobbis.map(blobbi => (
                    <Button
                      key={blobbi.id}
                      variant={selectedBlobbiId === blobbi.id ? 'default' : 'ghost'}
                      className="w-full justify-start h-auto py-3"
                      onClick={() => setSelectedBlobbiId(blobbi.id)}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <BlobbiThumbnail blobbi={blobbi} />
                        <div className="flex flex-col items-start flex-1 min-w-0">
                          <div className="font-semibold truncate w-full">{blobbi.name}</div>
                          <div className="text-xs opacity-70 truncate w-full">
                            {blobbi.lifeStage}
                            {blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi' && (
                              <> • {blobbi.evolutionForm}</>
                            )}
                          </div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Editor */}
        <div className="lg:col-span-9">
          {!selectedBlobbi ? (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground">
                  Select a Blobbi from the list to edit
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                      <CardTitle>{selectedBlobbi.name}</CardTitle>
                      <CardDescription>
                        {selectedBlobbi.lifeStage} • ID: {selectedBlobbi.id}
                        {selectedBlobbi.themeVariant === 'divine' && (
                          <Badge variant="secondary" className="ml-2">Divine</Badge>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        onClick={() => setPatch({})}
                        disabled={Object.keys(patch).length === 0}
                        className="flex-1 sm:flex-none"
                      >
                        Reset
                      </Button>
                      <Button
                        onClick={handlePublish}
                        disabled={!diff || diff.length === 0 || isPublishing}
                        className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none"
                      >
                        {isPublishing ? 'Publishing...' : `Publish (${diff?.length || 0})`}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Before/After Preview */}
              {selectedBlobbi && mergedBlobbi && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Visual Preview
                      {visualChanges.stageChanged && (
                        <Badge variant="secondary" className="text-xs">Stage Changed</Badge>
                      )}
                      {visualChanges.evolutionChanged && (
                        <Badge variant="secondary" className="text-xs">Evolution Changed</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Compare the current state (Before) with your changes (After)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* DEV-ONLY DEBUG OUTPUT */}
                    {isDevelopment && (
                      <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-mono">
                        <div className="font-bold mb-2">🔍 Debug State (DEV-ONLY)</div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="font-semibold mb-1">Before (selectedBlobbi):</div>
                            <div>baseColor: {selectedBlobbi.baseColor || 'null'}</div>
                            <div>secondaryColor: {selectedBlobbi.secondaryColor || 'null'}</div>
                            <div>eyeColor: {selectedBlobbi.eyeColor || 'null'}</div>
                            <div>pattern: {selectedBlobbi.pattern || 'null'}</div>
                            {selectedBlobbi.lifeStage === 'egg' && (
                              <>
                                <div>eggTemperature: {selectedBlobbi.eggTemperature || 'null'}</div>
                                <div>eggStatus: {selectedBlobbi.eggStatus || 'null'}</div>
                              </>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold mb-1">After (mergedBlobbi):</div>
                            <div>baseColor: {mergedBlobbi.baseColor || 'null'}</div>
                            <div>secondaryColor: {mergedBlobbi.secondaryColor || 'null'}</div>
                            <div>eyeColor: {mergedBlobbi.eyeColor || 'null'}</div>
                            <div>pattern: {mergedBlobbi.pattern || 'null'}</div>
                            {mergedBlobbi.lifeStage === 'egg' && (
                              <>
                                <div>eggTemperature: {mergedBlobbi.eggTemperature || 'null'}</div>
                                <div>eggStatus: {mergedBlobbi.eggStatus || 'null'}</div>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                          <div className="font-semibold">Patch keys: {Object.keys(patch).join(', ') || 'none'}</div>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Before */}
                      <div className="space-y-3">
                        <div className="text-center">
                          <h3 className="font-semibold text-sm mb-2">Before</h3>
                        </div>
                        <div className="flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/30 dark:to-gray-800/30 rounded-xl border-2 border-gray-200 dark:border-gray-700 aspect-square max-w-[280px] mx-auto p-6">
                          <BlobbiPreview blobbi={selectedBlobbi} size="medium" />
                        </div>
                        {/* Truth Test: Actual prop colors */}
                        {isDevelopment && (
                          <div className="flex justify-center gap-2 px-4">
                            {selectedBlobbi.baseColor && (
                              <div className="flex flex-col items-center gap-1">
                                <div 
                                  className="w-6 h-6 rounded border-2 border-gray-400" 
                                  style={{ backgroundColor: selectedBlobbi.baseColor }}
                                  title={`Base: ${selectedBlobbi.baseColor}`}
                                />
                                <span className="text-[10px] font-mono">base</span>
                              </div>
                            )}
                            {selectedBlobbi.secondaryColor && (
                              <div className="flex flex-col items-center gap-1">
                                <div 
                                  className="w-6 h-6 rounded border-2 border-gray-400" 
                                  style={{ backgroundColor: selectedBlobbi.secondaryColor }}
                                  title={`Secondary: ${selectedBlobbi.secondaryColor}`}
                                />
                                <span className="text-[10px] font-mono">2nd</span>
                              </div>
                            )}
                            {selectedBlobbi.eyeColor && (
                              <div className="flex flex-col items-center gap-1">
                                <div 
                                  className="w-6 h-6 rounded border-2 border-gray-400" 
                                  style={{ backgroundColor: selectedBlobbi.eyeColor }}
                                  title={`Eye: ${selectedBlobbi.eyeColor}`}
                                />
                                <span className="text-[10px] font-mono">eye</span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="text-center text-xs text-muted-foreground">
                          {selectedBlobbi.name} • {selectedBlobbi.lifeStage}
                          {selectedBlobbi.evolutionForm && selectedBlobbi.evolutionForm !== 'blobbi' && (
                            <> • {selectedBlobbi.evolutionForm}</>
                          )}
                        </div>
                      </div>

                      {/* After */}
                      <div className="space-y-3">
                        <div className="text-center">
                          <h3 className="font-semibold text-sm mb-2">After</h3>
                        </div>
                        <div className="flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl border-2 border-purple-200 dark:border-purple-600 aspect-square max-w-[280px] mx-auto p-6">
                          <BlobbiPreview blobbi={mergedBlobbi} size="medium" />
                        </div>
                        {/* Truth Test: Actual prop colors */}
                        {isDevelopment && (
                          <div className="flex justify-center gap-2 px-4">
                            {mergedBlobbi.baseColor && (
                              <div className="flex flex-col items-center gap-1">
                                <div 
                                  className="w-6 h-6 rounded border-2 border-gray-400" 
                                  style={{ backgroundColor: mergedBlobbi.baseColor }}
                                  title={`Base: ${mergedBlobbi.baseColor}`}
                                />
                                <span className="text-[10px] font-mono">base</span>
                              </div>
                            )}
                            {mergedBlobbi.secondaryColor && (
                              <div className="flex flex-col items-center gap-1">
                                <div 
                                  className="w-6 h-6 rounded border-2 border-gray-400" 
                                  style={{ backgroundColor: mergedBlobbi.secondaryColor }}
                                  title={`Secondary: ${mergedBlobbi.secondaryColor}`}
                                />
                                <span className="text-[10px] font-mono">2nd</span>
                              </div>
                            )}
                            {mergedBlobbi.eyeColor && (
                              <div className="flex flex-col items-center gap-1">
                                <div 
                                  className="w-6 h-6 rounded border-2 border-gray-400" 
                                  style={{ backgroundColor: mergedBlobbi.eyeColor }}
                                  title={`Eye: ${mergedBlobbi.eyeColor}`}
                                />
                                <span className="text-[10px] font-mono">eye</span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="text-center text-xs text-muted-foreground">
                          {mergedBlobbi.name} • {mergedBlobbi.lifeStage}
                          {mergedBlobbi.evolutionForm && mergedBlobbi.evolutionForm !== 'blobbi' && (
                            <> • {mergedBlobbi.evolutionForm}</>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Editor Tabs */}
              <Card>
                <CardContent className="pt-6">
                  <Tabs defaultValue="stats" className="w-full">
                    <TabsList className="grid w-full grid-cols-5">
                      <TabsTrigger value="stats">Stats</TabsTrigger>
                      <TabsTrigger value="core">Core</TabsTrigger>
                      <TabsTrigger value="appearance">Appearance</TabsTrigger>
                      <TabsTrigger value="personality">Personality</TabsTrigger>
                      <TabsTrigger value="evolution">Evolution</TabsTrigger>
                    </TabsList>

                    {/* Stats Tab */}
                    <TabsContent value="stats" className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {Object.entries(mergedBlobbi?.stats || {}).map(([stat, value]) => (
                          <div key={stat} className="space-y-2">
                            <Label className="capitalize">{stat}</Label>
                            <div className="flex items-center gap-4">
                              <Slider
                                value={[value]}
                                onValueChange={([newValue]) => updateStat(stat as keyof BlobbiStats, newValue)}
                                max={100}
                                min={0}
                                step={1}
                                className="flex-1"
                              />
                              <Input
                                type="number"
                                value={value}
                                onChange={(e) => updateStat(stat as keyof BlobbiStats, parseInt(e.target.value) || 0)}
                                className="w-20"
                                min={0}
                                max={100}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Egg-specific stats */}
                      {mergedBlobbi?.lifeStage === 'egg' && (
                        <>
                          <Separator />
                          <h3 className="font-semibold">Egg-Specific Stats</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Egg Temperature</Label>
                              <div className="flex items-center gap-4">
                                <Slider
                                  value={[mergedBlobbi?.eggTemperature || 0]}
                                  onValueChange={([value]) => updatePatchField('eggTemperature', value)}
                                  max={100}
                                  min={0}
                                  step={1}
                                  className="flex-1"
                                />
                                <Input
                                  type="number"
                                  value={mergedBlobbi?.eggTemperature || 0}
                                  onChange={(e) => updatePatchField('eggTemperature', parseInt(e.target.value) || 0)}
                                  className="w-20"
                                  min={0}
                                  max={100}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Shell Integrity</Label>
                              <div className="flex items-center gap-4">
                                <Slider
                                  value={[mergedBlobbi?.shellIntegrity || 100]}
                                  onValueChange={([value]) => updatePatchField('shellIntegrity', value)}
                                  max={100}
                                  min={0}
                                  step={1}
                                  className="flex-1"
                                />
                                <Input
                                  type="number"
                                  value={mergedBlobbi?.shellIntegrity || 100}
                                  onChange={(e) => updatePatchField('shellIntegrity', parseInt(e.target.value) || 0)}
                                  className="w-20"
                                  min={0}
                                  max={100}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Incubation Progress</Label>
                              <Input
                                type="number"
                                value={mergedBlobbi?.incubationProgress || 0}
                                onChange={(e) => updatePatchField('incubationProgress', parseInt(e.target.value) || 0)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Egg Status</Label>
                              <Select
                                value={mergedBlobbi?.eggStatus || NONE}
                                onValueChange={(value) => updatePatchField('eggStatus', value === NONE ? undefined : value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NONE}>None</SelectItem>
                                  {VALID_EGG_STATUSES.map(status => (
                                    <SelectItem key={status} value={status}>{status}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </>
                      )}
                    </TabsContent>

                    {/* Core Tab */}
                    <TabsContent value="core" className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            value={mergedBlobbi?.name || ''}
                            onChange={(e) => updatePatchField('name', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Life Stage</Label>
                          <Select
                            value={mergedBlobbi?.lifeStage}
                            onValueChange={(value) => updatePatchField('lifeStage', value as typeof LIFE_STAGES[number])}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LIFE_STAGES.map(stage => (
                                <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>State</Label>
                          <Select
                            value={mergedBlobbi?.state}
                            onValueChange={(value) => updatePatchField('state', value as typeof STATES[number])}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATES.map(state => (
                                <SelectItem key={state} value={state}>{state}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Mood</Label>
                          <Select
                            value={mergedBlobbi?.mood || NONE}
                            onValueChange={(value) => updatePatchField('mood', value === NONE ? undefined : value as typeof MOODS[number])}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>None</SelectItem>
                              {MOODS.map(mood => (
                                <SelectItem key={mood} value={mood}>{mood}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Experience</Label>
                          <Input
                            type="number"
                            value={mergedBlobbi?.experience || 0}
                            onChange={(e) => updatePatchField('experience', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Coins</Label>
                          <Input
                            type="number"
                            value={mergedBlobbi?.coins || 0}
                            onChange={(e) => updatePatchField('coins', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Generation</Label>
                          <Input
                            type="number"
                            value={mergedBlobbi?.generation || 1}
                            onChange={(e) => updatePatchField('generation', parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Care Streak</Label>
                          <Input
                            type="number"
                            value={mergedBlobbi?.careStreak || 0}
                            onChange={(e) => updatePatchField('careStreak', parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                    </TabsContent>

                    {/* Appearance Tab */}
                    <TabsContent value="appearance" className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Base Color</Label>
                          <Select
                            value={mergedBlobbi?.baseColor || NONE}
                            onValueChange={(value) => updatePatchField('baseColor', value === NONE ? undefined : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select color..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>None</SelectItem>
                              {uniqueBaseColors.map((color, idx) => (
                                <SelectItem key={`base-${color}-${idx}`} value={color}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded border" style={{ backgroundColor: color }} />
                                    {color}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Secondary Color</Label>
                          <Select
                            value={mergedBlobbi?.secondaryColor || NONE}
                            onValueChange={(value) => updatePatchField('secondaryColor', value === NONE ? undefined : value)}
                            disabled={mergedBlobbi?.themeVariant === 'divine'}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select color..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>None</SelectItem>
                              {uniqueSecondaryColors.map((color, idx) => (
                                <SelectItem key={`secondary-${color}-${idx}`} value={color}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded border" style={{ backgroundColor: color }} />
                                    {color}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {mergedBlobbi?.themeVariant === 'divine' && (
                            <p className="text-xs text-muted-foreground">
                              Divine Blobbis don't use secondary colors
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Eye Color</Label>
                          <Select
                            value={mergedBlobbi?.eyeColor || NONE}
                            onValueChange={(value) => updatePatchField('eyeColor', value === NONE ? undefined : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select color..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>None</SelectItem>
                              {uniqueEyeColors.map((color, idx) => (
                                <SelectItem key={`eye-${color}-${idx}`} value={color}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded border" style={{ backgroundColor: color }} />
                                    {color}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Pattern</Label>
                          <Select
                            value={mergedBlobbi?.pattern || NONE}
                            onValueChange={(value) => updatePatchField('pattern', value === NONE ? undefined : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select pattern..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>None</SelectItem>
                              {VALID_PATTERNS.map(pattern => (
                                <SelectItem key={pattern} value={pattern}>{pattern}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Special Mark</Label>
                          <Select
                            value={mergedBlobbi?.specialMark || NONE}
                            onValueChange={(value) => updatePatchField('specialMark', value === NONE ? undefined : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select mark..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>None</SelectItem>
                              {ALL_VALID_SPECIAL_MARKS.map(mark => (
                                <SelectItem key={mark} value={mark}>{mark}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Size</Label>
                          <Select
                            value={mergedBlobbi?.size || NONE}
                            onValueChange={(value) => updatePatchField('size', value === NONE ? undefined : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select size..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>None</SelectItem>
                              {ALL_VALID_SIZES.map(size => (
                                <SelectItem key={size} value={size}>{size}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Manifestation</Label>
                          <Select
                            value={mergedBlobbi?.manifestation || NONE}
                            onValueChange={(value) => updatePatchField('manifestation', value === NONE ? undefined : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select manifestation..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>None</SelectItem>
                              {MANIFESTATIONS.map(manif => (
                                <SelectItem key={manif} value={manif}>{manif}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Visual Effect</Label>
                          <Select
                            value={mergedBlobbi?.visualEffect || NONE}
                            onValueChange={(value) => updatePatchField('visualEffect', value === NONE ? undefined : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select effect..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>None</SelectItem>
                              {VISUAL_EFFECTS.map(effect => (
                                <SelectItem key={effect} value={effect}>{effect}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Blessing</Label>
                          <Select
                            value={mergedBlobbi?.blessing || NONE}
                            onValueChange={(value) => updatePatchField('blessing', value === NONE ? undefined : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select blessing..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>None</SelectItem>
                              {BLESSINGS.map(blessing => (
                                <SelectItem key={blessing} value={blessing}>{blessing}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Personality Tab */}
                    <TabsContent value="personality" className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Title</Label>
                          <Select
                            value={mergedBlobbi?.title || NONE}
                            onValueChange={(value) => updatePatchField('title', value === NONE ? undefined : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select title..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>None</SelectItem>
                              {ALL_VALID_TITLES.map(title => (
                                <SelectItem key={title} value={title}>{title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Skill</Label>
                          <Input
                            value={mergedBlobbi?.skill || ''}
                            onChange={(e) => updatePatchField('skill', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Favorite Food</Label>
                          <Input
                            value={mergedBlobbi?.favoriteFood || ''}
                            onChange={(e) => updatePatchField('favoriteFood', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Voice Type</Label>
                          <Input
                            value={mergedBlobbi?.voiceType || ''}
                            onChange={(e) => updatePatchField('voiceType', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Has Buff</Label>
                          <Input
                            value={mergedBlobbi?.hasBuff || ''}
                            onChange={(e) => updatePatchField('hasBuff', e.target.value)}
                            placeholder="energy_boost"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Has Debuff</Label>
                          <Input
                            value={mergedBlobbi?.hasDebuff || ''}
                            onChange={(e) => updatePatchField('hasDebuff', e.target.value)}
                            placeholder="slowness"
                          />
                        </div>
                        <div className="col-span-full space-y-2">
                          <Label>Personality Traits (comma-separated)</Label>
                          <Textarea
                            value={(mergedBlobbi?.personality || []).join(', ')}
                            onChange={(e) => updatePatchField('personality', 
                              e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                            )}
                            placeholder="playful, curious, brave"
                            rows={2}
                          />
                        </div>
                        <div className="col-span-full space-y-2">
                          <Label>Traits (comma-separated)</Label>
                          <Textarea
                            value={(mergedBlobbi?.traits || []).join(', ')}
                            onChange={(e) => updatePatchField('traits', 
                              e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                            )}
                            placeholder="fast_learner, friendly"
                            rows={2}
                          />
                        </div>
                      </div>
                    </TabsContent>

                    {/* Evolution Tab */}
                    <TabsContent value="evolution" className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {mergedBlobbi?.lifeStage === 'adult' && (
                          <>
                            <div className="space-y-2">
                              <Label>Evolution Form</Label>
                              <Select
                                value={mergedBlobbi?.evolutionForm || 'blobbi'}
                                onValueChange={(value) => updatePatchField('evolutionForm', value as typeof EVOLUTION_FORMS[number])}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {EVOLUTION_FORMS.map(form => (
                                    <SelectItem key={form} value={form}>{form}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Evolution Time</Label>
                              <Input
                                type="number"
                                value={mergedBlobbi?.evolutionTime || 0}
                                onChange={(e) => updatePatchField('evolutionTime', parseInt(e.target.value) || 0)}
                                placeholder="Unix timestamp"
                              />
                            </div>
                          </>
                        )}
                        <div className="space-y-2">
                          <Label>Theme Variant</Label>
                          <Select
                            value={mergedBlobbi?.themeVariant || NONE}
                            onValueChange={(value) => updatePatchField('themeVariant', value === NONE ? undefined : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select theme..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>None</SelectItem>
                              {THEME_VARIANTS.map(theme => (
                                <SelectItem key={theme} value={theme}>{theme}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Crossover App</Label>
                          <Input
                            value={mergedBlobbi?.crossoverApp || ''}
                            onChange={(e) => updatePatchField('crossoverApp', e.target.value)}
                            placeholder="divine"
                          />
                        </div>
                      </div>
                      {mergedBlobbi?.lifeStage !== 'adult' && (
                        <Alert>
                          <AlertDescription>
                            Evolution form is only applicable to adult Blobbis
                          </AlertDescription>
                        </Alert>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Diff Preview */}
              {diff && diff.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Changes Preview</CardTitle>
                    <CardDescription>
                      The following fields will be updated when you publish
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-2">
                        {diff.map((change, idx) => (
                          <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm font-mono p-2 rounded bg-muted/50">
                            <span className="font-semibold sm:w-40 shrink-0">{change.field}</span>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-red-500 line-through">
                                {JSON.stringify(change.old)}
                              </span>
                              <span>→</span>
                              <span className="text-green-500">
                                {JSON.stringify(change.new)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
