import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Sparkles, Palette, Ruler, Star, Baby, Egg } from 'lucide-react';
import { BlobbiEggVisual } from '@/components/egg/BlobbiEggVisual';
import { BlobbiVisual } from '@/components/blobbi/BlobbiVisual';
import { generateSampleBlobbiEgg } from '@/lib/blobbi-adoption';
import { generateRandomVisualEffects, getVisualEffectRarity } from '@/lib/blobbi-visual-tags';
import { Blobbi } from '@/types/blobbi';
import { 
  ALL_VALID_BASE_COLORS,
  ALL_VALID_SECONDARY_COLORS,
  ALL_VALID_SIZES,
  ALL_VALID_SPECIAL_MARKS,
  ALL_VALID_TITLES,
  VALID_PATTERNS,
  VALID_EGG_STATUSES,
  getColorRarity,
  getSizeRarity,
  getSpecialMarkRarity,
  getTitleRarity
} from '@/lib/blobbi-egg-validation';
import { AppHeader } from '@/components/AppHeader';

interface EggProperties {
  d: string;
  base_color: string;
  secondary_color?: string;
  size: string;
  pattern: string;
  special_mark?: string;
  egg_status: string;
  shell_integrity: string;
  incubation_progress: string;
  happiness: string;
  hygiene: string;
  egg_temperature: string;
  title?: string;
}

interface BabyBlobbiProperties {
  manifestation?: string;
  visualEffect?: string;
  blessing?: string;
  eyeColor: string;
  personality: string[];
  traits: string[];
  mood: string;
  favoriteFood: string;
  voiceType: string;
}

// Available options based on the specification - using centralized validation
const BASE_COLORS = [...ALL_VALID_BASE_COLORS];
const SECONDARY_COLORS = [...ALL_VALID_SECONDARY_COLORS];
const SIZES = [...ALL_VALID_SIZES];
const PATTERNS = [...VALID_PATTERNS];
const EGG_STATUSES = [...VALID_EGG_STATUSES];
const SPECIAL_MARKS = [...ALL_VALID_SPECIAL_MARKS];
const TITLES = [...ALL_VALID_TITLES];

// Baby Blobbi visual effects options
const MANIFESTATIONS = [
  'dot_center', 'oval_spots', 'side_bands', 'dot_speckle', 'light_dash',
  'freckle_patch', 'sparkle_trail', 'light_smoke', 'dusty_aura',
  'ring_mark', 'blush_sides', 'tiger_stripe', 'glow_ring', 'wavy_spots', 'mist_drift',
  'rune_top', 'shimmer_band', 'spirit_knot', 'crescent_moon', 'tiny_star',
  'wave_stroke', 'glow_blue', 'glimmer_gold', 'mist_wisp',
  'sigil_eye', 'glow_crack_pattern', 'ethereal_rune', 'leaf_stamp', 'divine_circle',
  'ancestral_knot', 'angel_halo', 'aurora_waves', 'radiant_line'
];

const BABY_PATTERNS = [
  'stripes', 'dots', 'gradient', 'soft_wave',
  'spiral_twist', 'galaxy_dust', 'crackled_lines',
  'nebula_bloom', 'sacred_geometry', 'shifting_rings'
];

const BLESSINGS = [
  'telepathic', 'keen_sense', 'light_heal',
  'night_vision', 'inner_peace', 'sun_gifted',
  'eternal_grace', 'blessing_of_light', 'soul_touch'
];

const EYE_COLORS = [
  '#6b4423', '#6699ff', '#a0522d', // Common: brown, blue, hazel
  '#50c878', '#8a2be2', '#c0c0c0', // Uncommon: emerald, violet, silver
  '#ff66cc', '#ffd700', '#ff0033'  // Rare: glow_pink, golden_flare, red_shift
];

const PERSONALITIES = [
  'brave', 'shy', 'curious', 'playful', 'calm', 'energetic', 'gentle', 'mischievous'
];

const TRAITS = [
  'resilient', 'telepathic', 'water_breath', 'fireproof', 'ghost_touch', 'storm_whisper',
  'light_shift', 'introverted', 'strategist', 'explorer', 'listener', 'prophetic',
  'guardian_instinct', 'blessed_aura', 'night_owl'
];

const MOODS = ['happy', 'sad', 'sleepy', 'hungry', 'dirty', 'sick', 'neutral', 'playful'];

const FAVORITE_FOODS = [
  'glowberries', 'starfruit', 'moondrops', 'crystalnuts', 'dewdrops', 'sunseeds'
];

const VOICE_TYPES = [
  'squeaky', 'melodic', 'whisper', 'chirpy', 'deep', 'musical', 'soft', 'bubbly'
];

export default function EggDemo() {
  const [eggData, setEggData] = useState<EggProperties | null>(null);
  const [babyData, setBabyData] = useState<BabyBlobbiProperties | null>(null);
  const [showSecondaryColor, setShowSecondaryColor] = useState(false);
  const [showSpecialMark, setShowSpecialMark] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [showManifestation, setShowManifestation] = useState(false);
  const [showVisualEffect, setShowVisualEffect] = useState(false);
  const [showBlessing, setShowBlessing] = useState(false);

  const generateRandomBaby = () => {
    const visualEffects = generateRandomVisualEffects();
    const randomEyeColor = EYE_COLORS[Math.floor(Math.random() * EYE_COLORS.length)];
    const randomPersonalities = PERSONALITIES.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);
    const randomTraits = TRAITS.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 2) + 1);
    
    const newBaby: BabyBlobbiProperties = {
      manifestation: visualEffects.manifestation,
      visualEffect: visualEffects.visualEffect,
      blessing: visualEffects.blessing,
      eyeColor: randomEyeColor,
      personality: randomPersonalities,
      traits: randomTraits,
      mood: MOODS[Math.floor(Math.random() * MOODS.length)],
      favoriteFood: FAVORITE_FOODS[Math.floor(Math.random() * FAVORITE_FOODS.length)],
      voiceType: VOICE_TYPES[Math.floor(Math.random() * VOICE_TYPES.length)],
    };
    
    setBabyData(newBaby);
    setShowManifestation(!!newBaby.manifestation);
    setShowVisualEffect(!!newBaby.visualEffect);
    setShowBlessing(!!newBaby.blessing);
  };

  const generateRandomEgg = () => {
    const rawEgg = generateSampleBlobbiEgg();
    const newEgg: EggProperties = {
      d: rawEgg.d,
      base_color: rawEgg.base_color,
      secondary_color: rawEgg.secondary_color,
      size: rawEgg.size,
      pattern: rawEgg.pattern,
      special_mark: rawEgg.special_mark,
      egg_status: rawEgg.egg_status,
      shell_integrity: rawEgg.shell_integrity,
      incubation_progress: rawEgg.incubation_progress,
      happiness: rawEgg.happiness,
      hygiene: rawEgg.hygiene,
      egg_temperature: rawEgg.egg_temperature,
      title: rawEgg.title,
    };
    
    setEggData(newEgg);
    setShowSecondaryColor(!!newEgg.secondary_color);
    setShowSpecialMark(!!newEgg.special_mark);
    setShowTitle(!!newEgg.title);
    
    // Also generate baby data
    generateRandomBaby();
  };

  const updateProperty = (key: keyof EggProperties, value: string) => {
    if (!eggData) return;
    
    // Validate colors before updating
    if (key === 'base_color' && !(ALL_VALID_BASE_COLORS as readonly string[]).includes(value)) {
      console.warn(`Invalid base color: ${value}. Must be specification-compliant.`);
      return;
    }
    
    if (key === 'secondary_color' && !(ALL_VALID_SECONDARY_COLORS as readonly string[]).includes(value)) {
      console.warn(`Invalid secondary color: ${value}. Must be specification-compliant.`);
      return;
    }
    
    setEggData(prev => prev ? { ...prev, [key]: value } : null);
  };

  const updateBabyProperty = (key: keyof BabyBlobbiProperties, value: string | string[]) => {
    if (!babyData) return;
    setBabyData(prev => prev ? { ...prev, [key]: value } : null);
  };

  const createBabyBlobbi = (): Blobbi | null => {
    if (!eggData || !babyData) return null;
    
    return {
      id: `demo-baby-${eggData.d}`,
      ownerPubkey: 'demo',
      name: `Baby ${eggData.d}`,
      birthTime: Date.now(),
      lastInteraction: Math.floor(Date.now() / 1000),
      lifeStage: 'baby',
      state: 'active',
      stats: {
        hunger: parseInt(eggData.happiness) || 80,
        happiness: parseInt(eggData.happiness) || 80,
        energy: 80,
        hygiene: parseInt(eggData.hygiene) || 80,
        health: 100,
      },
      customization: {
        color: eggData.base_color,
        accessories: [],
      },
      experience: 0,
      coins: 100,
      inventory: [],
      evolutionProgress: {
        totalCareDays: 0,
        currentStreak: 0,
        lastCareDate: 0,
        careSessions: [],
        isEligibleForEvolution: false,
        nextEvolutionCheck: 0,
      },
      generation: 1,
      breedingReady: false,
      careStreak: 0,
      // Visual appearance from egg
      baseColor: eggData.base_color,
      secondaryColor: eggData.secondary_color,
      eyeColor: babyData.eyeColor,
      // Visual effects from baby generation
      manifestation: babyData.manifestation,
      visualEffect: babyData.visualEffect,
      blessing: babyData.blessing,
      pattern: eggData.pattern !== 'none' ? eggData.pattern : undefined,
      // Personality traits
      personality: babyData.personality,
      traits: babyData.traits,
      mood: babyData.mood as Blobbi['mood'],
      favoriteFood: babyData.favoriteFood,
      voiceType: babyData.voiceType,
      size: eggData.size,
      title: eggData.title,
      specialMark: eggData.special_mark,
    };
  };

  const toggleOptionalProperty = (property: 'secondary_color' | 'special_mark' | 'title', show: boolean) => {
    if (!eggData) return;

    if (show) {
      // Add the property with a default value (using first valid option)
      const defaultValues = {
        secondary_color: SECONDARY_COLORS[0],
        special_mark: SPECIAL_MARKS[0],
        title: TITLES[0]
      };
      
      // Validate the default value before setting
      const defaultValue = defaultValues[property];
      if (property === 'secondary_color' && !(ALL_VALID_SECONDARY_COLORS as readonly string[]).includes(defaultValue)) {
        console.warn(`Invalid default secondary color: ${defaultValue}`);
        return;
      }
      
      updateProperty(property, defaultValue);
    } else {
      // Remove the property
      setEggData(prev => {
        if (!prev) return null;
        const newData = { ...prev };
        delete newData[property];
        return newData;
      });
    }

    // Update toggle state
    if (property === 'secondary_color') setShowSecondaryColor(show);
    if (property === 'special_mark') setShowSpecialMark(show);
    if (property === 'title') setShowTitle(show);
  };

  const toggleBabyOptionalProperty = (property: 'manifestation' | 'visualEffect' | 'blessing', show: boolean) => {
    if (!babyData) return;

    if (show) {
      const defaultValues = {
        manifestation: MANIFESTATIONS[0],
        visualEffect: BABY_PATTERNS[0],
        blessing: BLESSINGS[0]
      };
      
      updateBabyProperty(property, defaultValues[property]);
    } else {
      setBabyData(prev => {
        if (!prev) return null;
        const newData = { ...prev };
        delete newData[property];
        return newData;
      });
    }

    // Update toggle state
    if (property === 'manifestation') setShowManifestation(show);
    if (property === 'visualEffect') setShowVisualEffect(show);
    if (property === 'blessing') setShowBlessing(show);
  };

  const getRarityInfo = (value: string, type: 'color' | 'size' | 'mark' | 'title') => {
    let rarity: string | null = null;
    let chance: string = '50%';

    switch (type) {
      case 'color':
        rarity = getColorRarity(value, 'base') || getColorRarity(value, 'secondary');
        chance = rarity === 'legendary' ? '5%' : rarity === 'rare' ? '15%' : rarity === 'uncommon' ? '30%' : '50%';
        break;
      case 'size':
        rarity = getSizeRarity(value);
        chance = rarity === 'legendary' ? '5%' : rarity === 'rare' ? '10%' : rarity === 'uncommon' ? '25%' : '60%';
        break;
      case 'mark':
        rarity = getSpecialMarkRarity(value);
        chance = rarity === 'legendary' ? '5%' : rarity === 'rare' ? '15%' : rarity === 'uncommon' ? '30%' : '50%';
        break;
      case 'title':
        rarity = getTitleRarity(value);
        chance = rarity === 'legendary' ? '5%' : rarity === 'rare' ? '15%' : rarity === 'uncommon' ? '30%' : '50%';
        break;
    }
    
    return { rarity: rarity || 'common', chance };
  };

  const getRarityBadgeVariant = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'destructive';
      case 'rare': return 'secondary';
      case 'uncommon': return 'outline';
      default: return 'default';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <AppHeader 
            title="🥚 Blobbi Lifecycle Demo"
            subtitle="Interactive demonstration of Blobbi egg generation and baby hatching with all visual effects based on the blobbi-hatch-31124.md specification. This is a visual demo only - no events are published to Nostr."
          />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Visual Display */}
          <Card className={cn(
            "lg:sticky lg:top-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600 transition-all duration-500",
            // Size-based card scaling
            eggData?.size === 'tiny' ? 'max-w-md' :
            eggData?.size === 'small' ? 'max-w-lg' :
            eggData?.size === 'large' ? 'max-w-4xl' :
            'max-w-2xl' // medium (default)
          )}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Sparkles className="h-5 w-5" />
                Blobbi Visualization
                {eggData && <Badge variant="secondary">ID: {eggData.d}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs defaultValue="egg" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="egg" className="flex items-center gap-2">
                    <Egg className="h-4 w-4" />
                    Egg Stage
                  </TabsTrigger>
                  <TabsTrigger value="baby" className="flex items-center gap-2">
                    <Baby className="h-4 w-4" />
                    Baby Stage
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="egg" className="space-y-4">
                  {eggData ? (
                    <>
                      <div className={cn(
                        "flex items-center justify-center transition-all duration-500",
                        // Size-based container scaling for eggs
                        eggData.size === 'tiny' ? 'min-h-[180px] p-4 bg-gradient-to-br from-amber-50/30 to-orange-50/30 rounded-lg' :
                        eggData.size === 'small' ? 'min-h-[220px] p-6 bg-gradient-to-br from-amber-50/40 to-orange-50/40 rounded-xl' :
                        eggData.size === 'large' ? 'min-h-[380px] p-12 bg-gradient-to-br from-amber-50/60 to-orange-50/60 rounded-3xl border-2 border-amber-100/50' :
                        'min-h-[300px] p-8 bg-gradient-to-br from-amber-50/50 to-orange-50/50 rounded-2xl' // medium (default)
                      )}>
                        <BlobbiEggVisual
                          baseColor={eggData.base_color}
                          secondaryColor={eggData.secondary_color}
                          size={eggData.size}
                          pattern={eggData.pattern}
                          specialMark={eggData.special_mark}
                          eggStatus={eggData.egg_status}
                          shellIntegrity={parseInt(eggData.shell_integrity)}
                          incubationProgress={parseInt(eggData.incubation_progress)}
                          eggTemperature={parseInt(eggData.egg_temperature)}
                        />
                      </div>
                      
                      {/* Egg Stats Display */}
                      <div className={cn(
                        "w-full",
                        // Size-based spacing
                        eggData.size === 'tiny' ? 'space-y-2' :
                        eggData.size === 'small' ? 'space-y-2' :
                        eggData.size === 'large' ? 'space-y-4' :
                        'space-y-3' // medium (default)
                      )}>
                        <h4 className={cn(
                          "text-gray-900 dark:text-gray-100",
                          // Size-based text scaling
                          eggData.size === 'tiny' ? 'text-xs font-medium' :
                          eggData.size === 'small' ? 'text-sm font-semibold' :
                          eggData.size === 'large' ? 'text-lg font-bold' :
                          'text-sm font-semibold' // medium (default)
                        )}>Egg Stats</h4>
                        <div className={cn(
                          "grid grid-cols-2",
                          // Size-based grid spacing and text
                          eggData.size === 'tiny' ? 'gap-2 text-xs' :
                          eggData.size === 'small' ? 'gap-2 text-xs' :
                          eggData.size === 'large' ? 'gap-4 text-base' :
                          'gap-3 text-sm' // medium (default)
                        )}>
                          <div className="flex justify-between">
                            <span>Happiness:</span>
                            <Badge 
                              variant="outline" 
                              className={eggData.size === 'large' ? 'text-sm px-3 py-1' : eggData.size === 'tiny' ? 'text-xs px-1.5 py-0.5' : ''}
                            >
                              {eggData.happiness}/100
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Hygiene:</span>
                            <Badge 
                              variant="outline"
                              className={eggData.size === 'large' ? 'text-sm px-3 py-1' : eggData.size === 'tiny' ? 'text-xs px-1.5 py-0.5' : ''}
                            >
                              {eggData.hygiene}/100
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Temperature:</span>
                            <Badge 
                              variant="outline"
                              className={eggData.size === 'large' ? 'text-sm px-3 py-1' : eggData.size === 'tiny' ? 'text-xs px-1.5 py-0.5' : ''}
                            >
                              {eggData.egg_temperature}/100
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Shell Integrity:</span>
                            <Badge 
                              variant="outline"
                              className={eggData.size === 'large' ? 'text-sm px-3 py-1' : eggData.size === 'tiny' ? 'text-xs px-1.5 py-0.5' : ''}
                            >
                              {eggData.shell_integrity}/100
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Incubation Progress */}
                        <div className="space-y-1">
                          <div className={cn(
                            "flex justify-between",
                            eggData.size === 'large' ? 'text-sm' : eggData.size === 'tiny' ? 'text-xs' : 'text-xs'
                          )}>
                            <span>Incubation Progress:</span>
                            <span>{eggData.incubation_progress}%</span>
                          </div>
                          <div className={cn(
                            "w-full bg-gray-200 rounded-full transition-all duration-300",
                            eggData.size === 'large' ? 'h-3' : eggData.size === 'tiny' ? 'h-1.5' : 'h-2'
                          )}>
                            <div 
                              className={cn(
                                "bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-300",
                                eggData.size === 'large' ? 'h-3' : eggData.size === 'tiny' ? 'h-1.5' : 'h-2'
                              )}
                              style={{ width: `${eggData.incubation_progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-600 dark:text-gray-400">
                      <Egg className="h-12 w-12 mb-4 opacity-50" />
                      <p>Generate an egg to see the visualization</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="baby" className="space-y-4">
                  {eggData && babyData ? (
                    <>
                      <div className={cn(
                        "flex items-center justify-center transition-all duration-500",
                        // Size-based container scaling
                        eggData.size === 'tiny' ? 'min-h-[200px] p-4 bg-gradient-to-br from-purple-50/30 to-pink-50/30 rounded-lg' :
                        eggData.size === 'small' ? 'min-h-[250px] p-6 bg-gradient-to-br from-purple-50/40 to-pink-50/40 rounded-xl' :
                        eggData.size === 'large' ? 'min-h-[400px] p-12 bg-gradient-to-br from-purple-50/60 to-pink-50/60 rounded-3xl border-2 border-purple-100/50' :
                        'min-h-[300px] p-8 bg-gradient-to-br from-purple-50/50 to-pink-50/50 rounded-2xl' // medium (default)
                      )}>
                        <BlobbiVisual
                          blobbi={createBabyBlobbi()!}
                        />
                      </div>
                      
                      {/* Baby Traits Display */}
                      <div className={cn(
                        "w-full",
                        // Size-based spacing
                        eggData.size === 'tiny' ? 'space-y-2' :
                        eggData.size === 'small' ? 'space-y-2' :
                        eggData.size === 'large' ? 'space-y-4' :
                        'space-y-3' // medium (default)
                      )}>
                        <h4 className={cn(
                          "text-gray-900 dark:text-gray-100",
                          // Size-based text scaling
                          eggData.size === 'tiny' ? 'text-xs font-medium' :
                          eggData.size === 'small' ? 'text-sm font-semibold' :
                          eggData.size === 'large' ? 'text-lg font-bold' :
                          'text-sm font-semibold' // medium (default)
                        )}>Baby Traits</h4>
                        <div className={cn(
                          // Size-based text and spacing
                          eggData.size === 'tiny' ? 'space-y-1 text-xs' :
                          eggData.size === 'small' ? 'space-y-1.5 text-xs' :
                          eggData.size === 'large' ? 'space-y-3 text-base' :
                          'space-y-2 text-sm' // medium (default)
                        )}>
                          <div className="flex justify-between">
                            <span>Eye Color:</span>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full border"
                                style={{ backgroundColor: babyData.eyeColor }}
                              />
                              <span>{babyData.eyeColor}</span>
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <span>Mood:</span>
                            <Badge variant="outline" className="capitalize">{babyData.mood}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Voice:</span>
                            <Badge variant="outline" className="capitalize">{babyData.voiceType}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Favorite Food:</span>
                            <Badge variant="outline" className="capitalize">{babyData.favoriteFood}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Size:</span>
                            <Badge 
                              variant={getRarityBadgeVariant(getRarityInfo(eggData.size, 'size').rarity)} 
                              className="capitalize"
                            >
                              {eggData.size}
                            </Badge>
                          </div>
                          
                          {/* Personality */}
                          <div className="space-y-1">
                            <span className="font-medium">Personality:</span>
                            <div className="flex flex-wrap gap-1">
                              {babyData.personality.map((trait, index) => (
                                <Badge key={index} variant="secondary" className="text-xs capitalize">
                                  {trait}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          
                          {/* Traits */}
                          <div className="space-y-1">
                            <span className="font-medium">Special Traits:</span>
                            <div className="flex flex-wrap gap-1">
                              {babyData.traits.map((trait, index) => (
                                <Badge key={index} variant="outline" className="text-xs capitalize">
                                  {trait.replace('_', ' ')}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          
                          {/* Visual Effects */}
                          {(babyData.manifestation || babyData.visualEffect || babyData.blessing) && (
                            <div className="space-y-1">
                              <span className="font-medium">Visual Effects:</span>
                              <div className="flex flex-wrap gap-1">
                                {babyData.manifestation && (
                                  <Badge 
                                    variant="destructive" 
                                    className={`text-xs ${
                                      getVisualEffectRarity(babyData.manifestation) === 'legendary' ? 'bg-purple-500' :
                                      getVisualEffectRarity(babyData.manifestation) === 'rare' ? 'bg-blue-500' :
                                      getVisualEffectRarity(babyData.manifestation) === 'uncommon' ? 'bg-green-500' :
                                      'bg-gray-500'
                                    }`}
                                  >
                                    {babyData.manifestation.replace('_', ' ')}
                                  </Badge>
                                )}
                                {babyData.visualEffect && (
                                  <Badge 
                                    variant="destructive" 
                                    className={`text-xs ${
                                      getVisualEffectRarity(babyData.visualEffect) === 'legendary' ? 'bg-purple-500' :
                                      getVisualEffectRarity(babyData.visualEffect) === 'rare' ? 'bg-blue-500' :
                                      getVisualEffectRarity(babyData.visualEffect) === 'uncommon' ? 'bg-green-500' :
                                      'bg-gray-500'
                                    }`}
                                  >
                                    {babyData.visualEffect.replace('_', ' ')}
                                  </Badge>
                                )}
                                {babyData.blessing && (
                                  <Badge 
                                    variant="destructive" 
                                    className={`text-xs ${
                                      getVisualEffectRarity(babyData.blessing) === 'legendary' ? 'bg-purple-500' :
                                      getVisualEffectRarity(babyData.blessing) === 'rare' ? 'bg-blue-500' :
                                      getVisualEffectRarity(babyData.blessing) === 'uncommon' ? 'bg-green-500' :
                                      'bg-gray-500'
                                    }`}
                                  >
                                    {babyData.blessing.replace('_', ' ')}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-600 dark:text-gray-400">
                      <Baby className="h-12 w-12 mb-4 opacity-50" />
                      <p>Generate an egg first to see the baby visualization</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Controls */}
          <div className="space-y-6">
            {/* Generation Controls */}
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <RefreshCw className="h-5 w-5" />
                  Generation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={generateRandomEgg}
                  className="w-full flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                  size="lg"
                >
                  <RefreshCw className="h-4 w-4" />
                  Generate Random Egg & Baby
                </Button>
                
                {eggData && (
                  <Button 
                    onClick={generateRandomBaby}
                    variant="outline"
                    className="w-full flex items-center gap-2"
                    size="sm"
                  >
                    <Baby className="h-4 w-4" />
                    Regenerate Baby Traits Only
                  </Button>
                )}
              </CardContent>
            </Card>

            {eggData && (
              <>
                {/* Required Properties */}
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                      <Palette className="h-5 w-5" />
                      Required Properties
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Base Color */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        Base Color
                        {(() => {
                          const rarity = getRarityInfo(eggData.base_color, 'color');
                          return (
                            <Badge variant={getRarityBadgeVariant(rarity.rarity)} className="text-xs">
                              {rarity.rarity} ({rarity.chance})
                            </Badge>
                          );
                        })()}
                      </Label>
                      <Select value={eggData.base_color} onValueChange={(value) => updateProperty('base_color', value)}>
                        <SelectTrigger>
                          <SelectValue>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded border"
                                style={{ backgroundColor: eggData.base_color }}
                              />
                              {eggData.base_color}
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {BASE_COLORS.map((color) => {
                            const rarity = getRarityInfo(color, 'color');
                            return (
                              <SelectItem key={color} value={color}>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-4 h-4 rounded border"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span>{color}</span>
                                  <Badge variant={getRarityBadgeVariant(rarity.rarity)} className="text-xs ml-auto">
                                    {rarity.rarity}
                                  </Badge>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Size */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Ruler className="h-4 w-4" />
                        Size
                        {(() => {
                          const rarity = getRarityInfo(eggData.size, 'size');
                          return (
                            <Badge variant={getRarityBadgeVariant(rarity.rarity)} className="text-xs">
                              {rarity.rarity} ({rarity.chance})
                            </Badge>
                          );
                        })()}
                      </Label>
                      <Select value={eggData.size} onValueChange={(value) => updateProperty('size', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SIZES.map((size) => {
                            const rarity = getRarityInfo(size, 'size');
                            return (
                              <SelectItem key={size} value={size}>
                                <div className="flex items-center gap-2">
                                  <span className="capitalize">{size}</span>
                                  <Badge variant={getRarityBadgeVariant(rarity.rarity)} className="text-xs ml-auto">
                                    {rarity.rarity}
                                  </Badge>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Pattern */}
                    <div className="space-y-2">
                      <Label>Pattern</Label>
                      <Select value={eggData.pattern} onValueChange={(value) => updateProperty('pattern', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PATTERNS.map((pattern) => (
                            <SelectItem key={pattern} value={pattern}>
                              <span className="capitalize">{pattern}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Egg Status */}
                    <div className="space-y-2">
                      <Label>Egg Status</Label>
                      <Select value={eggData.egg_status} onValueChange={(value) => updateProperty('egg_status', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EGG_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              <span className="capitalize">{status}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Optional Properties */}
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                      <Star className="h-5 w-5" />
                      Optional Properties
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-300">
                      These properties have spawn chances and add rarity to your egg
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Secondary Color Toggle */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="secondary-color-toggle" className="flex items-center gap-2">
                          Secondary Color
                          <Badge variant="outline" className="text-xs">45% spawn chance</Badge>
                        </Label>
                        <Switch
                          id="secondary-color-toggle"
                          checked={showSecondaryColor}
                          onCheckedChange={(checked) => toggleOptionalProperty('secondary_color', checked)}
                        />
                      </div>
                      {showSecondaryColor && (
                        <Select value={eggData.secondary_color || ''} onValueChange={(value) => updateProperty('secondary_color', value)}>
                          <SelectTrigger>
                            <SelectValue>
                              {eggData.secondary_color && (
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-4 h-4 rounded border"
                                    style={{ backgroundColor: eggData.secondary_color }}
                                  />
                                  {eggData.secondary_color}
                                </div>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {SECONDARY_COLORS.map((color) => {
                              const rarity = getRarityInfo(color, 'color');
                              return (
                                <SelectItem key={color} value={color}>
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-4 h-4 rounded border"
                                      style={{ backgroundColor: color }}
                                    />
                                    <span>{color}</span>
                                    <Badge variant={getRarityBadgeVariant(rarity.rarity)} className="text-xs ml-auto">
                                      {rarity.rarity}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <Separator />

                    {/* Special Mark Toggle */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="special-mark-toggle" className="flex items-center gap-2">
                          Special Mark
                          <Badge variant="outline" className="text-xs">15% spawn chance</Badge>
                        </Label>
                        <Switch
                          id="special-mark-toggle"
                          checked={showSpecialMark}
                          onCheckedChange={(checked) => toggleOptionalProperty('special_mark', checked)}
                        />
                      </div>
                      {showSpecialMark && (
                        <Select value={eggData.special_mark || ''} onValueChange={(value) => updateProperty('special_mark', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SPECIAL_MARKS.map((mark) => {
                              const rarity = getRarityInfo(mark, 'mark');
                              return (
                                <SelectItem key={mark} value={mark}>
                                  <div className="flex items-center gap-2">
                                    <span className="capitalize">{mark.replace('_', ' ')}</span>
                                    <Badge variant={getRarityBadgeVariant(rarity.rarity)} className="text-xs ml-auto">
                                      {rarity.rarity}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <Separator />

                    {/* Title Toggle */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="title-toggle" className="flex items-center gap-2">
                          Title
                          <Badge variant="outline" className="text-xs">10% spawn chance</Badge>
                        </Label>
                        <Switch
                          id="title-toggle"
                          checked={showTitle}
                          onCheckedChange={(checked) => toggleOptionalProperty('title', checked)}
                        />
                      </div>
                      {showTitle && (
                        <Select value={eggData.title || ''} onValueChange={(value) => updateProperty('title', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TITLES.map((title) => {
                              const rarity = getRarityInfo(title, 'title');
                              return (
                                <SelectItem key={title} value={title}>
                                  <div className="flex items-center gap-2">
                                    <span>{title}</span>
                                    <Badge variant={getRarityBadgeVariant(rarity.rarity)} className="text-xs ml-auto">
                                      {rarity.rarity}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Baby Customization */}
                {babyData && (
                  <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                        <Baby className="h-5 w-5" />
                        Baby Traits & Visual Effects
                      </CardTitle>
                      <CardDescription className="text-gray-600 dark:text-gray-300">
                        Customize the baby Blobbi's appearance and traits
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Eye Color */}
                      <div className="space-y-2">
                        <Label>Eye Color</Label>
                        <Select value={babyData.eyeColor} onValueChange={(value) => updateBabyProperty('eyeColor', value)}>
                          <SelectTrigger>
                            <SelectValue>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-4 h-4 rounded-full border"
                                  style={{ backgroundColor: babyData.eyeColor }}
                                />
                                {babyData.eyeColor}
                              </div>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {EYE_COLORS.map((color) => (
                              <SelectItem key={color} value={color}>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-4 h-4 rounded-full border"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span>{color}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Mood */}
                      <div className="space-y-2">
                        <Label>Mood</Label>
                        <Select value={babyData.mood} onValueChange={(value) => updateBabyProperty('mood', value)}>
                          <SelectTrigger>
                            <SelectValue className="capitalize" />
                          </SelectTrigger>
                          <SelectContent>
                            {MOODS.map((mood) => (
                              <SelectItem key={mood} value={mood}>
                                <span className="capitalize">{mood}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      {/* Visual Effects */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-sm">Visual Effects</h4>
                        
                        {/* Manifestation Toggle */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="manifestation-toggle" className="flex items-center gap-2">
                              Manifestation
                              <Badge variant="outline" className="text-xs">25% spawn chance</Badge>
                            </Label>
                            <Switch
                              id="manifestation-toggle"
                              checked={showManifestation}
                              onCheckedChange={(checked) => toggleBabyOptionalProperty('manifestation', checked)}
                            />
                          </div>
                          {showManifestation && (
                            <Select value={babyData.manifestation || ''} onValueChange={(value) => updateBabyProperty('manifestation', value)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MANIFESTATIONS.map((manifestation) => {
                                  const rarity = getVisualEffectRarity(manifestation);
                                  return (
                                    <SelectItem key={manifestation} value={manifestation}>
                                      <div className="flex items-center gap-2">
                                        <span className="capitalize">{manifestation.replace('_', ' ')}</span>
                                        <Badge 
                                          variant={getRarityBadgeVariant(rarity)} 
                                          className="text-xs ml-auto"
                                        >
                                          {rarity}
                                        </Badge>
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        {/* Pattern/Visual Effect Toggle */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="visual-effect-toggle" className="flex items-center gap-2">
                              Pattern
                              <Badge variant="outline" className="text-xs">30% spawn chance</Badge>
                            </Label>
                            <Switch
                              id="visual-effect-toggle"
                              checked={showVisualEffect}
                              onCheckedChange={(checked) => toggleBabyOptionalProperty('visualEffect', checked)}
                            />
                          </div>
                          {showVisualEffect && (
                            <Select value={babyData.visualEffect || ''} onValueChange={(value) => updateBabyProperty('visualEffect', value)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {BABY_PATTERNS.map((pattern) => {
                                  const rarity = getVisualEffectRarity(pattern);
                                  return (
                                    <SelectItem key={pattern} value={pattern}>
                                      <div className="flex items-center gap-2">
                                        <span className="capitalize">{pattern.replace('_', ' ')}</span>
                                        <Badge 
                                          variant={getRarityBadgeVariant(rarity)} 
                                          className="text-xs ml-auto"
                                        >
                                          {rarity}
                                        </Badge>
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        {/* Blessing Toggle */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="blessing-toggle" className="flex items-center gap-2">
                              Blessing
                              <Badge variant="outline" className="text-xs">10% spawn chance</Badge>
                            </Label>
                            <Switch
                              id="blessing-toggle"
                              checked={showBlessing}
                              onCheckedChange={(checked) => toggleBabyOptionalProperty('blessing', checked)}
                            />
                          </div>
                          {showBlessing && (
                            <Select value={babyData.blessing || ''} onValueChange={(value) => updateBabyProperty('blessing', value)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {BLESSINGS.map((blessing) => {
                                  const rarity = getVisualEffectRarity(blessing);
                                  return (
                                    <SelectItem key={blessing} value={blessing}>
                                      <div className="flex items-center gap-2">
                                        <span className="capitalize">{blessing.replace('_', ' ')}</span>
                                        <Badge 
                                          variant={getRarityBadgeVariant(rarity)} 
                                          className="text-xs ml-auto"
                                        >
                                          {rarity}
                                        </Badge>
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Specification Info */}
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                  <CardHeader>
                    <CardTitle className="text-sm text-gray-900 dark:text-gray-100">Specification Compliance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <p>✅ Follows exact blobbi-hatch-31124.md specification</p>
                      <p>✅ All visual effects and manifestations implemented</p>
                      <p>✅ Rarity system with weighted probabilities</p>
                      <p>✅ Baby stage with full tag-based visual traits</p>
                      <p>✅ SVG-based effects maintaining core Blobbi shape</p>
                      <p>✅ Ready for Nostr Kind 31124 event publishing</p>
                      <p>⚠️ This is a visual demo only - no events are published</p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}