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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/useToast';
import { useUserBlobbis } from '@/hooks/useUserBlobbis';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Blobbi, BlobbiStats, BlobbonautStorageItem } from '@/types/blobbi';
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
import {
  BlobbonautPatch,
  MergedBlobbonaut,
  parseBlobbonautFromEvent,
  generateUpdatedTags31125,
  validateStorageEntry,
  parseStorageEntry,
} from '@/lib/blobbonaut-editor';
import { processEvolution, processHatching } from '@/lib/blobbi-evolution';
import { createBlobbiRecordEvent, createBlobbiStateEvent } from '@/lib/blobbi-events';
import { mergeBlobbiStateTags } from '@/lib/blobbi-state-merge';

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

type EditorMode = 'blobbi' | 'profile';

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

  // Mode state
  const [mode, setMode] = useState<EditorMode>('blobbi');

  // Blobbi editor state (kind 31124)
  const [selectedBlobbiId, setSelectedBlobbiId] = useState<string | null>(null);
  const [blobbiPatch, setBlobbiPatch] = useState<BlobbiPatch>({});
  const [originalBlobbiEvent, setOriginalBlobbiEvent] = useState<NostrEvent | null>(null);

  // Profile editor state (kind 31125)
  const [profileData, setProfileData] = useState<MergedBlobbonaut | null>(null);
  const [profilePatch, setProfilePatch] = useState<BlobbonautPatch>({});
  const [originalProfileEvent, setOriginalProfileEvent] = useState<NostrEvent | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [newHasItem, setNewHasItem] = useState('');
  const [newStorageEntry, setNewStorageEntry] = useState('');

  const [isPublishing, setIsPublishing] = useState(false);

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

  // Fetch original Blobbi event when selected
  useEffect(() => {
    if (!selectedBlobbi || mode !== 'blobbi') {
      setOriginalBlobbiEvent(null);
      setBlobbiPatch({});
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
          setOriginalBlobbiEvent(events[0]);
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
  }, [selectedBlobbi, nostr, toast, mode]);

  // Fetch profile event when in profile mode
  useEffect(() => {
    if (mode !== 'profile' || !user) {
      setProfileData(null);
      setOriginalProfileEvent(null);
      setProfilePatch({});
      return;
    }

    const fetchProfileEvent = async () => {
      setProfileLoading(true);
      try {
        const events = await nostr.query(
          [{ 
            kinds: [31125], 
            authors: [user.pubkey],
            limit: 1
          }],
          { signal: AbortSignal.timeout(3000) }
        );
        
        if (events.length > 0) {
          const parsed = parseBlobbonautFromEvent(events[0]);
          if (parsed) {
            setProfileData(parsed);
            setOriginalProfileEvent(events[0]);
          } else {
            toast({
              title: 'Error',
              description: 'Failed to parse profile event',
              variant: 'destructive'
            });
          }
        } else {
          toast({
            title: 'No Profile Found',
            description: 'No kind 31125 profile event found for your pubkey.',
            variant: 'default'
          });
        }
      } catch (err) {
        console.error('Failed to fetch profile event:', err);
        toast({
          title: 'Error',
          description: 'Could not fetch profile event',
          variant: 'destructive'
        });
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfileEvent();
  }, [mode, user, nostr, toast]);

  // Update a field in the blobbi patch - ONLY add if value is not NONE
  const updateBlobbiPatchField = useCallback(<K extends keyof BlobbiPatch>(field: K, value: BlobbiPatch[K] | typeof NONE) => {
    setBlobbiPatch(prev => {
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
    setBlobbiPatch(prev => ({
      ...prev,
      stats: {
        ...(prev.stats || {}),
        [stat]: Math.max(0, Math.min(100, value))
      }
    }));
  }, []);

  // Update profile patch field
  const updateProfilePatchField = useCallback(<K extends keyof BlobbonautPatch>(field: K, value: BlobbonautPatch[K]) => {
    setProfilePatch(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Get merged Blobbi (original + patch) - creates NEW object on every patch change
  // Force new reference to trigger re-renders
  const mergedBlobbi = useMemo((): Blobbi | null => {
    if (!selectedBlobbi) return null;
    
    // Create a deep copy to ensure new object identity
    const merged: Blobbi = JSON.parse(JSON.stringify(selectedBlobbi));
    
    // Apply patch
    Object.keys(blobbiPatch).forEach(key => {
      const value = blobbiPatch[key as keyof BlobbiPatch];
      if (value !== undefined) {
        if (key === 'stats' && typeof value === 'object') {
          merged.stats = { ...merged.stats, ...value };
        } else {
          // Use type assertion to bypass TypeScript's over-strict checking
          (merged as unknown as Record<string, unknown>)[key] = value;
        }
      }
    });
    
    return merged;
  }, [selectedBlobbi, blobbiPatch]);

  // Get merged profile (original + patch)
  const mergedProfile = useMemo((): MergedBlobbonaut | null => {
    if (!profileData) return null;

    const merged: MergedBlobbonaut = JSON.parse(JSON.stringify(profileData));

    // Apply patch
    if (profilePatch.name !== undefined) merged.name = profilePatch.name;
    if (profilePatch.onboarding_done !== undefined) merged.onboarding_done = profilePatch.onboarding_done;
    if (profilePatch.coins !== undefined) merged.coins = profilePatch.coins;
    if (profilePatch.pettingLevel !== undefined) merged.pettingLevel = profilePatch.pettingLevel;
    if (profilePatch.lifetimeBlobbis !== undefined) merged.lifetimeBlobbis = profilePatch.lifetimeBlobbis;
    if (profilePatch.mission_daily_checkin_claimed_at !== undefined) {
      merged.mission_daily_checkin_claimed_at = profilePatch.mission_daily_checkin_claimed_at;
    }
    if (profilePatch.has !== undefined) merged.has = profilePatch.has;
    if (profilePatch.storage !== undefined) merged.storage = profilePatch.storage;

    return merged;
  }, [profileData, profilePatch]);

  // Generate diff between original and merged Blobbi
  const blobbiDiff = useMemo(() => {
    if (!selectedBlobbi || !mergedBlobbi) return null;
    
    const changes: Array<{ field: string; old: never; new: never }> = [];
    
    // Check all patch fields
    Object.keys(blobbiPatch).forEach(key => {
      const patchValue = blobbiPatch[key as keyof BlobbiPatch];
      if (patchValue === undefined) return;
      
      if (key === 'stats') {
        const statPatch = patchValue as Partial<BlobbiStats>;
        Object.keys(statPatch).forEach(statKey => {
          const oldValue = selectedBlobbi.stats[statKey as keyof BlobbiStats];
          const newValue = statPatch[statKey as keyof BlobbiStats];
          if (oldValue !== newValue) {
            changes.push({
              field: `stats.${statKey}`,
              old: oldValue as never,
              new: newValue as never
            });
          }
        });
      } else {
        const oldValue = (selectedBlobbi as never)[key];
        const newValue = patchValue;
        
        // Deep comparison for arrays
        if (Array.isArray(oldValue) && Array.isArray(newValue)) {
          if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            changes.push({ field: key, old: oldValue as never, new: newValue as never });
          }
        } else if (oldValue !== newValue) {
          changes.push({ field: key, old: oldValue as never, new: newValue as never });
        }
      }
    });
    
    return changes;
  }, [selectedBlobbi, mergedBlobbi, blobbiPatch]);

  // Generate diff for profile
  const profileDiff = useMemo(() => {
    if (!profileData || !mergedProfile) return null;

    const changes: Array<{ field: string; old: never; new: never }> = [];

    if (profilePatch.name !== undefined && profileData.name !== mergedProfile.name) {
      changes.push({ field: 'name', old: profileData.name as never, new: mergedProfile.name as never });
    }
    if (profilePatch.onboarding_done !== undefined && profileData.onboarding_done !== mergedProfile.onboarding_done) {
      changes.push({ field: 'onboarding_done', old: profileData.onboarding_done as never, new: mergedProfile.onboarding_done as never });
    }
    if (profilePatch.coins !== undefined && profileData.coins !== mergedProfile.coins) {
      changes.push({ field: 'coins', old: profileData.coins as never, new: mergedProfile.coins as never });
    }
    if (profilePatch.pettingLevel !== undefined && profileData.pettingLevel !== mergedProfile.pettingLevel) {
      changes.push({ field: 'pettingLevel', old: profileData.pettingLevel as never, new: mergedProfile.pettingLevel as never });
    }
    if (profilePatch.lifetimeBlobbis !== undefined && profileData.lifetimeBlobbis !== mergedProfile.lifetimeBlobbis) {
      changes.push({ field: 'lifetimeBlobbis', old: profileData.lifetimeBlobbis as never, new: mergedProfile.lifetimeBlobbis as never });
    }
    if (profilePatch.mission_daily_checkin_claimed_at !== undefined && profileData.mission_daily_checkin_claimed_at !== mergedProfile.mission_daily_checkin_claimed_at) {
      changes.push({ field: 'mission_daily_checkin_claimed_at', old: profileData.mission_daily_checkin_claimed_at as never, new: mergedProfile.mission_daily_checkin_claimed_at as never });
    }
    if (profilePatch.has !== undefined && JSON.stringify(profileData.has) !== JSON.stringify(mergedProfile.has)) {
      changes.push({ field: 'has', old: profileData.has as never, new: mergedProfile.has as never });
    }
    if (profilePatch.storage !== undefined && JSON.stringify(profileData.storage) !== JSON.stringify(mergedProfile.storage)) {
      changes.push({ field: 'storage', old: profileData.storage as never, new: mergedProfile.storage as never });
    }

    return changes;
  }, [profileData, mergedProfile, profilePatch]);

  // Detect significant visual changes for badges
  const visualChanges = useMemo(() => {
    if (!blobbiDiff) return { stageChanged: false, evolutionChanged: false };
    
    const stageChanged = blobbiDiff.some(d => d.field === 'lifeStage');
    const evolutionChanged = blobbiDiff.some(d => d.field === 'evolutionForm');
    
    return { stageChanged, evolutionChanged };
  }, [blobbiDiff]);

  // Convert Blobbi to tags (preserving all original tags)
  const generateUpdatedBlobbiTags = useCallback((blobbi: Blobbi): string[][] => {
    if (!originalBlobbiEvent) {
      toast({
        title: 'Error',
        description: 'Original event not loaded. Cannot safely update.',
        variant: 'destructive'
      });
      return [];
    }

    // Start with all original tags
    const tags: string[][] = [...originalBlobbiEvent.tags];
    
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
  }, [originalBlobbiEvent, toast]);

  // Force hatch egg to baby (DEV ONLY)
  const handleForceHatch = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to hatch a Blobbi',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedBlobbi) {
      toast({
        title: 'Error',
        description: 'No Blobbi selected',
        variant: 'destructive'
      });
      return;
    }

    if (selectedBlobbi.lifeStage !== 'egg') {
      toast({
        title: 'Not an Egg',
        description: 'Only eggs can be hatched',
        variant: 'default'
      });
      return;
    }

    setIsPublishing(true);

    try {
      toast({
        title: 'Hatching in Progress...',
        description: 'Your Blobbi is breaking out of its shell!',
        variant: 'default'
      });

      // Use the same hatching logic as the normal flow
      const { processHatching } = await import('@/lib/blobbi-evolution');
      const { hatchingRecord, updatedBlobbi } = processHatching(selectedBlobbi);

      // Publish hatching record event (kind 14921)
      const recordEventData = createBlobbiRecordEvent(
        selectedBlobbi.id,
        hatchingRecord,
        `${selectedBlobbi.name} has hatched! 🐣✨ (DEV)`
      );
      await publishEvent(recordEventData);

      // Wait a moment between events
      await new Promise(resolve => setTimeout(resolve, 100));

      // Publish state event (kind 31124) with filtered tags
      const stateEventData = createBlobbiStateEvent(updatedBlobbi);
      const filteredTags = mergeBlobbiStateTags(stateEventData.tags, {
        removeStartIncubation: true,
      });

      await publishEvent({
        ...stateEventData,
        tags: filteredTags,
      });

      toast({
        title: 'Hatching Complete!',
        description: `${selectedBlobbi.name} has successfully hatched into a baby Blobbi!`,
        variant: 'default'
      });

      // Reload to see changes
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (err) {
      console.error('Failed to force hatch Blobbi:', err);
      toast({
        title: 'Error',
        description: 'Failed to hatch Blobbi. Check console for details.',
        variant: 'destructive'
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Force evolve Blobbi to adult (DEV ONLY)
  const handleForceEvolveToAdult = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to evolve a Blobbi',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedBlobbi) {
      toast({
        title: 'Error',
        description: 'No Blobbi selected',
        variant: 'destructive'
      });
      return;
    }

    if (selectedBlobbi.lifeStage === 'adult') {
      toast({
        title: 'Already Adult',
        description: 'This Blobbi is already an adult',
        variant: 'default'
      });
      return;
    }

    setIsPublishing(true);

    try {
      toast({
        title: 'Evolution in Progress...',
        description: 'Your Blobbi is evolving to adult!',
        variant: 'default'
      });

      // Use the same evolution logic as the normal flow
      const { processEvolution } = await import('@/lib/blobbi-evolution');
      const { evolutionRecord, updatedBlobbi } = processEvolution(
        selectedBlobbi,
        'adult',
        'Force evolved by developer for testing'
      );

      // Publish evolution record event (kind 14921)
      const recordEventData = createBlobbiRecordEvent(
        selectedBlobbi.id,
        evolutionRecord,
        `${selectedBlobbi.name} has evolved to adult! ✨ (DEV)`
      );
      await publishEvent(recordEventData);

      // Wait a moment between events
      await new Promise(resolve => setTimeout(resolve, 100));

      // Publish state event (kind 31124) with filtered tags
      const stateEventData = createBlobbiStateEvent(updatedBlobbi);
      const filteredTags = mergeBlobbiStateTags(stateEventData.tags, {
        removeStartEvolution: true,
      });

      await publishEvent({
        ...stateEventData,
        tags: filteredTags,
      });

      toast({
        title: 'Evolution Complete!',
        description: `${selectedBlobbi.name} has successfully evolved to adult!`,
        variant: 'default'
      });

      // Reload to see changes
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (err) {
      console.error('Failed to force evolve Blobbi:', err);
      toast({
        title: 'Error',
        description: 'Failed to evolve Blobbi. Check console for details.',
        variant: 'destructive'
      });
    } finally {
      setIsPublishing(false);
    }
  };

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

    if (mode === 'blobbi') {
      if (!mergedBlobbi || !originalBlobbiEvent) {
        toast({
          title: 'Error',
          description: 'No Blobbi selected or original event not loaded',
          variant: 'destructive'
        });
        return;
      }

      if (!blobbiDiff || blobbiDiff.length === 0) {
        toast({
          title: 'No Changes',
          description: 'No changes to publish',
          variant: 'default'
        });
        return;
      }

      setIsPublishing(true);

      try {
        const updatedTags = generateUpdatedBlobbiTags(mergedBlobbi);
        
        if (updatedTags.length === 0) {
          throw new Error('Failed to generate tags');
        }

        await publishEvent({
          kind: 31124,
          content: originalBlobbiEvent.content, // Preserve original content
          tags: updatedTags,
        });

        toast({
          title: 'Success',
          description: `Successfully updated ${mergedBlobbi.name}`,
          variant: 'default'
        });

        // Reset patch
        setBlobbiPatch({});
        
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
    } else if (mode === 'profile') {
      if (!mergedProfile || !originalProfileEvent) {
        toast({
          title: 'Error',
          description: 'No profile loaded or original event not loaded',
          variant: 'destructive'
        });
        return;
      }

      if (!profileDiff || profileDiff.length === 0) {
        toast({
          title: 'No Changes',
          description: 'No changes to publish',
          variant: 'default'
        });
        return;
      }

      setIsPublishing(true);

      try {
        const updatedTags = generateUpdatedTags31125(originalProfileEvent, mergedProfile);

        await publishEvent({
          kind: 31125,
          content: originalProfileEvent.content, // Preserve original content
          tags: updatedTags,
        });

        toast({
          title: 'Success',
          description: 'Successfully updated profile',
          variant: 'default'
        });

        // Reset patch
        setProfilePatch({});
        
        // Reload to see changes
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        
      } catch (err) {
        console.error('Failed to publish profile update:', err);
        toast({
          title: 'Error',
          description: 'Failed to publish update. Check console for details.',
          variant: 'destructive'
        });
      } finally {
        setIsPublishing(false);
      }
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

  // Deduplicate colors to avoid key conflicts
  const uniqueBaseColors = Array.from(new Set(ALL_VALID_BASE_COLORS));
  const uniqueSecondaryColors = Array.from(new Set(ALL_VALID_SECONDARY_COLORS));
  const uniqueEyeColors = Array.from(new Set(ALL_VALID_EYE_COLORS));

  const currentDiff = mode === 'blobbi' ? blobbiDiff : profileDiff;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-3xl font-bold">Blobbi Editor</h1>
          <Badge variant="destructive">DEV ONLY</Badge>
        </div>
        <p className="text-muted-foreground">
          Edit existing Blobbi entities and user profile/progress for development and debugging purposes.
          Only available on localhost in dev mode.
        </p>
      </div>

      {/* Mode Switcher */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Editor Mode</CardTitle>
          <CardDescription>Choose what to edit</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={(v) => setMode(v as EditorMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="blobbi">Edit Blobbi (kind 31124)</TabsTrigger>
              <TabsTrigger value="profile">Edit User Profile/Progress (kind 31125)</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>{mode === 'blobbi' ? 'Your Blobbis' : 'Profile Event'}</CardTitle>
              <CardDescription>
                {mode === 'blobbi' ? (
                  `${blobbis?.length || 0} ${blobbis?.length === 1 ? 'Blobbi' : 'Blobbis'}`
                ) : (
                  'Your kind 31125 profile'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {mode === 'blobbi' ? (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-1 p-4">
                    {blobbis && blobbis.map(blobbi => (
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
              ) : (
                <div className="p-4">
                  {profileLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading profile...</div>
                  ) : profileData ? (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">Profile Loaded</div>
                      <div className="text-xs text-muted-foreground">
                        ID: {profileData.id}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Coins: {profileData.coins}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Blobbis owned: {profileData.has.length}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No profile event found
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Editor */}
        <div className="lg:col-span-9">
          {mode === 'blobbi' && !selectedBlobbi ? (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground">
                  Select a Blobbi from the list to edit
                </p>
              </CardContent>
            </Card>
          ) : mode === 'profile' && !profileData ? (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground">
                  {profileLoading ? 'Loading profile...' : 'No profile event found for your pubkey'}
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
                      <CardTitle>
                        {mode === 'blobbi' ? selectedBlobbi?.name : 'Profile Editor'}
                      </CardTitle>
                      <CardDescription>
                        {mode === 'blobbi' ? (
                          <>
                            {selectedBlobbi?.lifeStage} • ID: {selectedBlobbi?.id}
                            {selectedBlobbi?.themeVariant === 'divine' && (
                              <Badge variant="secondary" className="ml-2">Divine</Badge>
                            )}
                          </>
                        ) : (
                          `ID: ${profileData?.id}`
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (mode === 'blobbi') {
                            setBlobbiPatch({});
                          } else {
                            setProfilePatch({});
                          }
                        }}
                        disabled={
                          mode === 'blobbi' 
                            ? Object.keys(blobbiPatch).length === 0 
                            : Object.keys(profilePatch).length === 0
                        }
                        className="flex-1 sm:flex-none"
                      >
                        Reset
                      </Button>
                      <Button
                        onClick={handlePublish}
                        disabled={!currentDiff || currentDiff.length === 0 || isPublishing}
                        className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none"
                      >
                        {isPublishing ? 'Publishing...' : `Publish (${currentDiff?.length || 0})`}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Before/After Preview (only for Blobbi mode) */}
              {mode === 'blobbi' && selectedBlobbi && mergedBlobbi && (
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Before */}
                      <div className="space-y-3">
                        <div className="text-center">
                          <h3 className="font-semibold text-sm mb-2">Before</h3>
                        </div>
                        <div className="flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/30 dark:to-gray-800/30 rounded-xl border-2 border-gray-200 dark:border-gray-700 aspect-square max-w-[280px] mx-auto p-6">
                          <BlobbiPreview blobbi={selectedBlobbi} size="medium" />
                        </div>
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
                  {mode === 'blobbi' && mergedBlobbi ? (
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
                          {Object.entries(mergedBlobbi.stats).map(([stat, value]) => (
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
                        {mergedBlobbi.lifeStage === 'egg' && (
                          <>
                            <Separator />
                            <h3 className="font-semibold">Egg-Specific Stats</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Egg Temperature</Label>
                                <div className="flex items-center gap-4">
                                  <Slider
                                    value={[mergedBlobbi.eggTemperature || 0]}
                                    onValueChange={([value]) => updateBlobbiPatchField('eggTemperature', value)}
                                    max={100}
                                    min={0}
                                    step={1}
                                    className="flex-1"
                                  />
                                  <Input
                                    type="number"
                                    value={mergedBlobbi.eggTemperature || 0}
                                    onChange={(e) => updateBlobbiPatchField('eggTemperature', parseInt(e.target.value) || 0)}
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
                                    value={[mergedBlobbi.shellIntegrity || 100]}
                                    onValueChange={([value]) => updateBlobbiPatchField('shellIntegrity', value)}
                                    max={100}
                                    min={0}
                                    step={1}
                                    className="flex-1"
                                  />
                                  <Input
                                    type="number"
                                    value={mergedBlobbi.shellIntegrity || 100}
                                    onChange={(e) => updateBlobbiPatchField('shellIntegrity', parseInt(e.target.value) || 0)}
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
                                  value={mergedBlobbi.incubationProgress || 0}
                                  onChange={(e) => updateBlobbiPatchField('incubationProgress', parseInt(e.target.value) || 0)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Egg Status</Label>
                                <Select
                                  value={mergedBlobbi.eggStatus || NONE}
                                  onValueChange={(value) => updateBlobbiPatchField('eggStatus', value === NONE ? undefined : value)}
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
                              value={mergedBlobbi.name || ''}
                              onChange={(e) => updateBlobbiPatchField('name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Life Stage</Label>
                            <Select
                              value={mergedBlobbi.lifeStage}
                              onValueChange={(value) => updateBlobbiPatchField('lifeStage', value as typeof LIFE_STAGES[number])}
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
                              value={mergedBlobbi.state}
                              onValueChange={(value) => updateBlobbiPatchField('state', value as typeof STATES[number])}
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
                              value={mergedBlobbi.mood || NONE}
                              onValueChange={(value) => updateBlobbiPatchField('mood', value === NONE ? undefined : value as typeof MOODS[number])}
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
                              value={mergedBlobbi.experience || 0}
                              onChange={(e) => updateBlobbiPatchField('experience', parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Coins</Label>
                            <Input
                              type="number"
                              value={mergedBlobbi.coins || 0}
                              onChange={(e) => updateBlobbiPatchField('coins', parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Generation</Label>
                            <Input
                              type="number"
                              value={mergedBlobbi.generation || 1}
                              onChange={(e) => updateBlobbiPatchField('generation', parseInt(e.target.value) || 1)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Care Streak</Label>
                            <Input
                              type="number"
                              value={mergedBlobbi.careStreak || 0}
                              onChange={(e) => updateBlobbiPatchField('careStreak', parseInt(e.target.value) || 0)}
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
                              value={mergedBlobbi.baseColor || NONE}
                              onValueChange={(value) => updateBlobbiPatchField('baseColor', value === NONE ? undefined : value)}
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
                              value={mergedBlobbi.secondaryColor || NONE}
                              onValueChange={(value) => updateBlobbiPatchField('secondaryColor', value === NONE ? undefined : value)}
                              disabled={mergedBlobbi.themeVariant === 'divine'}
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
                            {mergedBlobbi.themeVariant === 'divine' && (
                              <p className="text-xs text-muted-foreground">
                                Divine Blobbis don't use secondary colors
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Eye Color</Label>
                            <Select
                              value={mergedBlobbi.eyeColor || NONE}
                              onValueChange={(value) => updateBlobbiPatchField('eyeColor', value === NONE ? undefined : value)}
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
                              value={mergedBlobbi.pattern || NONE}
                              onValueChange={(value) => updateBlobbiPatchField('pattern', value === NONE ? undefined : value)}
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
                              value={mergedBlobbi.specialMark || NONE}
                              onValueChange={(value) => updateBlobbiPatchField('specialMark', value === NONE ? undefined : value)}
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
                              value={mergedBlobbi.size || NONE}
                              onValueChange={(value) => updateBlobbiPatchField('size', value === NONE ? undefined : value)}
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
                              value={mergedBlobbi.manifestation || NONE}
                              onValueChange={(value) => updateBlobbiPatchField('manifestation', value === NONE ? undefined : value)}
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
                              value={mergedBlobbi.visualEffect || NONE}
                              onValueChange={(value) => updateBlobbiPatchField('visualEffect', value === NONE ? undefined : value)}
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
                              value={mergedBlobbi.blessing || NONE}
                              onValueChange={(value) => updateBlobbiPatchField('blessing', value === NONE ? undefined : value)}
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
                              value={mergedBlobbi.title || NONE}
                              onValueChange={(value) => updateBlobbiPatchField('title', value === NONE ? undefined : value)}
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
                              value={mergedBlobbi.skill || ''}
                              onChange={(e) => updateBlobbiPatchField('skill', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Favorite Food</Label>
                            <Input
                              value={mergedBlobbi.favoriteFood || ''}
                              onChange={(e) => updateBlobbiPatchField('favoriteFood', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Voice Type</Label>
                            <Input
                              value={mergedBlobbi.voiceType || ''}
                              onChange={(e) => updateBlobbiPatchField('voiceType', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Has Buff</Label>
                            <Input
                              value={mergedBlobbi.hasBuff || ''}
                              onChange={(e) => updateBlobbiPatchField('hasBuff', e.target.value)}
                              placeholder="energy_boost"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Has Debuff</Label>
                            <Input
                              value={mergedBlobbi.hasDebuff || ''}
                              onChange={(e) => updateBlobbiPatchField('hasDebuff', e.target.value)}
                              placeholder="slowness"
                            />
                          </div>
                          <div className="col-span-full space-y-2">
                            <Label>Personality Traits (comma-separated)</Label>
                            <Textarea
                              value={(mergedBlobbi.personality || []).join(', ')}
                              onChange={(e) => updateBlobbiPatchField('personality', 
                                e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                              )}
                              placeholder="playful, curious, brave"
                              rows={2}
                            />
                          </div>
                          <div className="col-span-full space-y-2">
                            <Label>Traits (comma-separated)</Label>
                            <Textarea
                              value={(mergedBlobbi.traits || []).join(', ')}
                              onChange={(e) => updateBlobbiPatchField('traits', 
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
                        {/* DEV-ONLY: Force Hatch Button (for eggs) */}
                        {mergedBlobbi.lifeStage === 'egg' && (
                          <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700">
                            <AlertDescription className="space-y-3">
                              <div className="font-semibold text-blue-900 dark:text-blue-100">
                                Developer Tools - Hatching
                              </div>
                              <p className="text-sm text-blue-800 dark:text-blue-200">
                                Instantly hatch this egg into a baby Blobbi for testing purposes.
                                This will publish the same events as normal hatching.
                              </p>
                              <Button
                                onClick={handleForceHatch}
                                disabled={isPublishing}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                {isPublishing ? 'Hatching...' : 'Force Hatch to Baby'}
                              </Button>
                            </AlertDescription>
                          </Alert>
                        )}
                        
                        {/* DEV-ONLY: Force Evolution Button (for babies) */}
                        {mergedBlobbi.lifeStage === 'baby' && (
                          <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700">
                            <AlertDescription className="space-y-3">
                              <div className="font-semibold text-yellow-900 dark:text-yellow-100">
                                Developer Tools - Evolution
                              </div>
                              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                Instantly evolve this Blobbi to adult stage for testing purposes.
                                This will publish the same events as normal evolution.
                              </p>
                              <Button
                                onClick={handleForceEvolveToAdult}
                                disabled={isPublishing}
                                className="bg-yellow-600 hover:bg-yellow-700"
                              >
                                {isPublishing ? 'Evolving...' : 'Force Evolve to Adult'}
                              </Button>
                            </AlertDescription>
                          </Alert>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {mergedBlobbi.lifeStage === 'adult' && (
                            <>
                              <div className="space-y-2">
                                <Label>Evolution Form</Label>
                                <Select
                                  value={mergedBlobbi.evolutionForm || 'blobbi'}
                                  onValueChange={(value) => updateBlobbiPatchField('evolutionForm', value as typeof EVOLUTION_FORMS[number])}
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
                                  value={mergedBlobbi.evolutionTime || 0}
                                  onChange={(e) => updateBlobbiPatchField('evolutionTime', parseInt(e.target.value) || 0)}
                                  placeholder="Unix timestamp"
                                />
                              </div>
                            </>
                          )}
                          <div className="space-y-2">
                            <Label>Theme Variant</Label>
                            <Select
                              value={mergedBlobbi.themeVariant || NONE}
                              onValueChange={(value) => updateBlobbiPatchField('themeVariant', value === NONE ? undefined : value)}
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
                              value={mergedBlobbi.crossoverApp || ''}
                              onChange={(e) => updateBlobbiPatchField('crossoverApp', e.target.value)}
                              placeholder="divine"
                            />
                          </div>
                        </div>
                        {mergedBlobbi.lifeStage !== 'adult' && (
                          <Alert>
                            <AlertDescription>
                              Evolution form is only applicable to adult Blobbis
                            </AlertDescription>
                          </Alert>
                        )}
                      </TabsContent>
                    </Tabs>
                  ) : mode === 'profile' && mergedProfile ? (
                    <Tabs defaultValue="core" className="w-full">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="core">Core</TabsTrigger>
                        <TabsTrigger value="has">Has</TabsTrigger>
                        <TabsTrigger value="storage">Storage</TabsTrigger>
                        <TabsTrigger value="raw">Raw Tags</TabsTrigger>
                      </TabsList>

                      {/* Core Tab */}
                      <TabsContent value="core" className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                              value={mergedProfile.name}
                              onChange={(e) => updateProfilePatchField('name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2 flex items-center gap-2">
                            <Switch
                              checked={mergedProfile.onboarding_done}
                              onCheckedChange={(checked) => updateProfilePatchField('onboarding_done', checked)}
                            />
                            <Label>Onboarding Done</Label>
                          </div>
                          <div className="space-y-2">
                            <Label>Coins</Label>
                            <Input
                              type="number"
                              value={mergedProfile.coins}
                              onChange={(e) => updateProfilePatchField('coins', parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Petting Level</Label>
                            <Input
                              type="number"
                              value={mergedProfile.pettingLevel}
                              onChange={(e) => updateProfilePatchField('pettingLevel', parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Lifetime Blobbis</Label>
                            <Input
                              type="number"
                              value={mergedProfile.lifetimeBlobbis}
                              onChange={(e) => updateProfilePatchField('lifetimeBlobbis', parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Mission Daily Checkin Claimed At</Label>
                            <Input
                              type="number"
                              value={mergedProfile.mission_daily_checkin_claimed_at || ''}
                              onChange={(e) => updateProfilePatchField('mission_daily_checkin_claimed_at', parseInt(e.target.value) || undefined)}
                              placeholder="Unix timestamp"
                            />
                          </div>
                        </div>
                      </TabsContent>

                      {/* Has Tab */}
                      <TabsContent value="has" className="space-y-4">
                        <div className="space-y-2">
                          <Label>Add Blobbi ID</Label>
                          <div className="flex gap-2">
                            <Input
                              value={newHasItem}
                              onChange={(e) => setNewHasItem(e.target.value)}
                              placeholder="blobbi-..."
                            />
                            <Button
                              onClick={() => {
                                if (newHasItem.trim()) {
                                  updateProfilePatchField('has', [...mergedProfile.has, newHasItem.trim()]);
                                  setNewHasItem('');
                                }
                              }}
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                        <ScrollArea className="h-[300px]">
                          <div className="space-y-2">
                            {mergedProfile.has.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                                <span className="font-mono text-sm">{item}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newHas = mergedProfile.has.filter((_, i) => i !== idx);
                                    updateProfilePatchField('has', newHas);
                                  }}
                                >
                                  Remove
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      {/* Storage Tab */}
                      <TabsContent value="storage" className="space-y-4">
                        <div className="space-y-2">
                          <Label>Add Storage Entry (format: item:qty)</Label>
                          <div className="flex gap-2">
                            <Input
                              value={newStorageEntry}
                              onChange={(e) => setNewStorageEntry(e.target.value)}
                              placeholder="item_name:10"
                            />
                            <Button
                              onClick={() => {
                                const validation = validateStorageEntry(newStorageEntry);
                                if (!validation.valid) {
                                  toast({
                                    title: 'Invalid Entry',
                                    description: validation.error,
                                    variant: 'destructive'
                                  });
                                  return;
                                }
                                const parsed = parseStorageEntry(newStorageEntry);
                                if (parsed) {
                                  updateProfilePatchField('storage', [...mergedProfile.storage, parsed]);
                                  setNewStorageEntry('');
                                }
                              }}
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                        <ScrollArea className="h-[300px]">
                          <div className="space-y-2">
                            {mergedProfile.storage.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                                <span className="font-mono text-sm">{item.itemId}: {item.quantity}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newStorage = mergedProfile.storage.filter((_, i) => i !== idx);
                                    updateProfilePatchField('storage', newStorage);
                                  }}
                                >
                                  Remove
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      {/* Raw Tags Tab */}
                      <TabsContent value="raw" className="space-y-4">
                        <div className="space-y-2">
                          <Label>All Tags (Read-Only)</Label>
                          <ScrollArea className="h-[400px]">
                            <pre className="text-xs bg-muted p-4 rounded">
                              {JSON.stringify(mergedProfile.rawTags, null, 2)}
                            </pre>
                          </ScrollArea>
                        </div>
                      </TabsContent>
                    </Tabs>
                  ) : null}
                </CardContent>
              </Card>

              {/* Diff Preview */}
              {currentDiff && currentDiff.length > 0 && (
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
                        {currentDiff.map((change, idx) => (
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
