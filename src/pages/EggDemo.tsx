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
  'dot_center', 'oval_spots', 'dot_speckle',
  'freckle_patch', 'sparkle_trail', 'light_smoke', 'dusty_aura',
  'ring_mark', 'glow_ring', 'mist_drift',
  'rune_top', 'spirit_knot', 'crescent_moon', 'tiny_star',
  'glow_blue', 'sigil_eye', 'ethereal_rune', 'leaf_stamp', 'divine_circle',
  'angel_halo'
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

  // Custom BlobbiVisual component for EggDemo that positions background effects behind the Blobbi
  const EggDemoBlobbiVisual = ({ blobbi }: { blobbi: Blobbi }) => {
    const backgroundEffects = ['divine_circle', 'light_smoke', 'dusty_aura', 'ring_mark', 'glow_ring', 'mist_drift', 'spirit_knot', 'tiny_star', 'glow_blue', 'ethereal_rune'];
    const hasBackgroundEffect = backgroundEffects.includes(blobbi.manifestation || '');
    
    if (!hasBackgroundEffect) {
      // If no background effect, use standard BlobbiVisual
      return <BlobbiVisual blobbi={blobbi} />;
    }

    // If has background effect, render it behind the Blobbi and remove it from the Blobbi's manifestation
    const blobbiWithoutBackgroundEffect = {
      ...blobbi,
      manifestation: undefined // Remove background effect so it doesn't render in the normal position
    };

    const renderBackgroundEffect = (effectType: string) => {
      switch (effectType) {
        case 'divine_circle':
          return (
            <svg width="420" height="420" viewBox="0 0 420 420" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="divineGlowYellow" cx="50%" cy="50%" r="50%">
      <stop offset="40%" stop-color="rgba(255,215,0,0.8)" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="rgba(255,215,0,0)" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="circleLightYellow" cx="50%" cy="50%" r="50%">
      <stop offset="30%" stop-color="#fff8dc" stop-opacity="1"/>
      <stop offset="100%" stop-color="rgba(255,215,0,0)" stop-opacity="0"/>
    </radialGradient>

    <filter id="softGlowYellow" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="0" stdDeviation="9" flood-color="rgba(255,215,0,0.7)" flood-opacity="0.7" />
      <feDropShadow dx="0" dy="0" stdDeviation="18" flood-color="rgba(255,215,0,0.5)" flood-opacity="0.5" />
    </filter>
  </defs>

  <circle cx="210" cy="210" r="168" fill="url(#divineGlowYellow)" filter="url(#softGlowYellow)">
    <animate attributeName="opacity" values="0.6;1;0.6" dur="4s" repeatCount="indefinite" />
  </circle>

  <circle cx="210" cy="210" r="150" fill="none" stroke="url(#circleLightYellow)" stroke-width="12" filter="url(#softGlowYellow)">
    <animate attributeName="stroke-opacity" values="0.3;1;0.3" dur="4s" repeatCount="indefinite" />
  </circle>

  <circle cx="210" cy="210" r="120" fill="none" stroke="rgba(255,215,0,0.9)" stroke-width="4.5" stroke-dasharray="15 24" />
  <circle cx="210" cy="210" r="90" fill="none" stroke="rgba(255,215,0,0.7)" stroke-width="3.6" stroke-dasharray="6 12" />

  <g>
    <circle cx="210" cy="210" r="48" fill="none" stroke="rgba(255,215,0,0.8)" stroke-width="6">
      <animate attributeName="r" values="45;51;45" dur="2.5s" repeatCount="indefinite" />
    </circle>
    <circle cx="210" cy="210" r="33" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="3">
      <animate attributeName="opacity" values="0.3;1;0.3" dur="3s" repeatCount="indefinite" />
    </circle>
    <circle cx="210" cy="210" r="21" fill="none" stroke="rgba(255,215,0,0.4)" stroke-width="4.5">
      <animate attributeName="r" values="18;24;18" dur="2s" repeatCount="indefinite" />
    </circle>
  </g>

  <g stroke="rgba(255,215,0,0.8)" stroke-width="3" fill="rgba(255,215,0,0.7)">
    <circle cx="210" cy="36" r="6">
      <animate attributeName="opacity" values="0;1;0" dur="3s" repeatCount="indefinite" />
    </circle>
    <circle cx="336" cy="90" r="4.5">
      <animate attributeName="opacity" values="0;1;0" dur="3.5s" repeatCount="indefinite" />
    </circle>
    <circle cx="378" cy="210" r="6">
      <animate attributeName="opacity" values="0;1;0" dur="4s" repeatCount="indefinite" />
    </circle>
    <circle cx="312" cy="336" r="4.5">
      <animate attributeName="opacity" values="0;1;0" dur="3.3s" repeatCount="indefinite" />
    </circle>
    <circle cx="195" cy="381" r="6">
      <animate attributeName="opacity" values="0;1;0" dur="3.8s" repeatCount="indefinite" />
    </circle>
    <circle cx="84" cy="336" r="4.5">
      <animate attributeName="opacity" values="0;1;0" dur="3.1s" repeatCount="indefinite" />
    </circle>
    <circle cx="36" cy="210" r="6">
      <animate attributeName="opacity" values="0;1;0" dur="3.6s" repeatCount="indefinite" />
    </circle>
    <circle cx="84" cy="84" r="4.5">
      <animate attributeName="opacity" values="0;1;0" dur="3.2s" repeatCount="indefinite" />
    </circle>
  </g>
</svg>
          );

        case 'light_smoke':
          return (
            <svg width="100%" height="100%" viewBox="-50 0 300 300" className="absolute">
              <defs>
                <radialGradient id={`${blobbi.id}-smokeGradient`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#aaa" stopOpacity="0.85" />
                  <stop offset="70%" stopColor="#666" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#333" stopOpacity="0.25" />
                </radialGradient>
                <filter id={`${blobbi.id}-blurSmoke`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="8" />
                </filter>
              </defs>
              <g transform="translate(100, 100)">
                <ellipse cx="-20" cy="-40" rx="45" ry="27" fill={`url(#${blobbi.id}-smokeGradient)`} filter={`url(#${blobbi.id}-blurSmoke)`}>
                  <animateTransform attributeName="transform" attributeType="XML" type="scale" values="1;1.1;1" dur="3s" repeatCount="indefinite" additive="sum" />
                </ellipse>
                <ellipse cx="20" cy="-20" rx="42" ry="24" fill={`url(#${blobbi.id}-smokeGradient)`} filter={`url(#${blobbi.id}-blurSmoke)`}>
                  <animateTransform attributeName="transform" attributeType="XML" type="scale" values="1;1.1;1" dur="3s" repeatCount="indefinite" additive="sum" />
                </ellipse>
                <ellipse cx="0" cy="10" rx="37.5" ry="22.5" fill={`url(#${blobbi.id}-smokeGradient)`} filter={`url(#${blobbi.id}-blurSmoke)`}>
                  <animateTransform attributeName="transform" attributeType="XML" type="scale" values="1;1.1;1" dur="3s" repeatCount="indefinite" additive="sum" />
                </ellipse>
                <ellipse cx="-30" cy="-20" rx="30" ry="18" fill={`url(#${blobbi.id}-smokeGradient)`} filter={`url(#${blobbi.id}-blurSmoke)`}>
                  <animateTransform attributeName="transform" attributeType="XML" type="scale" values="1;1.1;1" dur="3s" repeatCount="indefinite" additive="sum" />
                </ellipse>
                <ellipse cx="-6" cy="-16" rx="39" ry="24" fill={`url(#${blobbi.id}-smokeGradient)`} filter={`url(#${blobbi.id}-blurSmoke)`}>
                  <animateTransform attributeName="transform" attributeType="XML" type="scale" values="1;1.1;1" dur="3s" repeatCount="indefinite" additive="sum" />
                </ellipse>
              </g>
            </svg>
          );

        case 'dusty_aura':
          return (
            <svg width="100%" height="100%" viewBox="-100 -100 300 300" className="absolute">
              <defs>
                <radialGradient id={`${blobbi.id}-auraGradient`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#d2b48c" stopOpacity="0.8" />
                  <stop offset="70%" stopColor="#a0522d" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#5c3317" stopOpacity="0" />
                </radialGradient>
                <filter id={`${blobbi.id}-blurAura`} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
                  <feGaussianBlur stdDeviation="7" />
                </filter>
              </defs>
              <g transform="translate(50, 50)">
                <circle cx="0" cy="0" r="60" fill={`url(#${blobbi.id}-auraGradient)`} filter={`url(#${blobbi.id}-blurAura)`}>
                  <animate attributeName="r" values="55;65;55" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="fillOpacity" values="0.6;0.85;0.6" dur="3s" repeatCount="indefinite" />
                </circle>
              </g>
            </svg>
          );

        case 'ring_mark':
          return (
            <svg width="100%" height="100%" viewBox="-10 -10 120 120" className="absolute">
              <g transform="translate(50, 50)">
                <circle cx="0" cy="0" r="67.5" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="3" />
              </g>
            </svg>
          );

        case 'glow_ring':
          return (
            <svg width="100%" height="100%" viewBox="-200 -200 1000 1000" className="absolute">
              <defs>
                <filter id={`${blobbi.id}-auraGlow`} x="-100%" y="-100%" width="300%" height="300%">
                  <feDropShadow dx="0" dy="0" stdDeviation="30" floodColor="#6A5ACD" floodOpacity="1">
                    <animate attributeName="floodOpacity" values="0.3;1;0.3" dur="3s" repeatCount="indefinite" />
                  </feDropShadow>
                  <feDropShadow dx="0" dy="0" stdDeviation="52.5" floodColor="#6A5ACD" floodOpacity="0.8">
                    <animate attributeName="floodOpacity" values="0.1;0.8;0.1" dur="3s" repeatCount="indefinite" />
                  </feDropShadow>
                  <feDropShadow dx="0" dy="0" stdDeviation="75" floodColor="#6A5ACD" floodOpacity="0.6">
                    <animate attributeName="floodOpacity" values="0.05;0.6;0.05" dur="3s" repeatCount="indefinite" />
                  </feDropShadow>
                </filter>
              </defs>
              <g transform="translate(300, 300)">
                <circle cx="0" cy="0" r="120" stroke="#6A5ACD" strokeWidth="15" fill="none" filter={`url(#${blobbi.id}-auraGlow)`} />
              </g>
            </svg>
          );

        case 'mist_drift':
          return (
            <svg width="100%" height="100%" viewBox="-70 -40 420 240" className="absolute">
              <defs>
                <filter id={`${blobbi.id}-glow`} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
                  <feDropShadow dx="0" dy="0" stdDeviation="9" floodColor="#bbb" floodOpacity="0.7"/>
                  <feDropShadow dx="0" dy="0" stdDeviation="18" floodColor="#bbb" floodOpacity="0.4"/>
                </filter>
                <radialGradient id={`${blobbi.id}-foggyFill`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ccc" stopOpacity="0.8"/>
                  <stop offset="70%" stopColor="#999" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#666" stopOpacity="0"/>
                </radialGradient>
              </defs>
              <g fill={`url(#${blobbi.id}-foggyFill)`} filter={`url(#${blobbi.id}-glow)`} transformOrigin="140 90" id={`${blobbi.id}-cloudFog`}>
                <circle cx="80" cy="90" r="60" />
                <circle cx="130" cy="70" r="67.5" />
                <circle cx="180" cy="90" r="60" />
                <circle cx="155" cy="105" r="75" />
                <circle cx="120" cy="105" r="57" />
                <circle cx="170" cy="85" r="52.5" />
                <circle cx="100" cy="80" r="45" />
              </g>
              <animateTransform href={`#${blobbi.id}-cloudFog`} attributeName="transform" attributeType="XML" type="scale" values="1;1.08;1" dur="7s" repeatCount="indefinite" />
            </svg>
          );

        case 'spirit_knot':
          return (
            <svg width="400" height="400" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#7B3FD6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <defs>
    <radialGradient id="gradPulse" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#7B3FD6" />
      <stop offset="100%" stop-color="#C6A9F7" />
    </radialGradient>
    <filter id="glowPulse" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="0" stdDeviation="1.4" flood-color="#B69CFF" flood-opacity="0.8" />
      <feDropShadow dx="0" dy="0" stdDeviation="2.8" flood-color="#7B3FD6" flood-opacity="0.6" />
    </filter>
  </defs>

  <g filter="url(#glowPulse)" fill="none" stroke="url(#gradPulse)">
    <path d="
      M32 8
      L24 20
      C22 22 22 26 24 28
      L32 36
      L40 28
      C42 26 42 22 40 20
      L32 8
      Z
      M32 56
      L40 44
      C42 42 42 38 40 36
      L32 28
      L24 36
      C22 38 22 42 24 44
      L32 56
      Z
    " stroke-width="2.2"/>
    <path transform="rotate(90 32 32)" d="
      M32 8
      L24 20
      C22 22 22 26 24 28
      L32 36
      L40 28
      C42 26 42 22 40 20
      L32 8
      Z
      M32 56
      L40 44
      C42 42 42 38 40 36
      L32 28
      L24 36
      C22 38 22 42 24 44
      L32 56
      Z
    " stroke-width="2.2"/>
  </g>
</svg>
          );

        case 'tiny_star':
          return (
            <svg width="450" height="450" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="aura" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="#FFD700" flood-opacity="0.8"/>
      <feDropShadow dx="0" dy="0" stdDeviation="20" flood-color="#FFD700" flood-opacity="0.4"/>
    </filter>
  </defs>

  <g filter="url(#aura)">
    <path
      d="M100,20 
         L117.6,69.1 
         L170,75.1 
         L130,112.5 
         L141.6,165 
         L100,137 
         L58.4,165 
         L70,112.5 
         L30,75.1 
         L82.4,69.1 
         Z"
      fill="#FFD700"
      stroke="#FFA500"
      stroke-width="3"
    >
      <animate attributeName="fill-opacity" values="1;0.6;1" dur="2s" repeatCount="indefinite" />
    </path>

    <animateTransform
      attributeName="transform"
      attributeType="XML"
      type="rotate"
      from="0 100 100"
      to="360 100 100"
      dur="6s"
      repeatCount="indefinite"
    />
  </g>
</svg>
          );

        case 'glow_blue':
          return (
            <svg width="600" height="600" viewBox="-40 -20 600 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="blueHalo" cx="50%" cy="50%" r="60%">
      <stop offset="40%" stop-color="#4a90e2" stop-opacity="0.7" />
      <stop offset="100%" stop-color="#4a90e2" stop-opacity="0" />
    </radialGradient>

    <mask id="waveMask">
      <rect width="400" height="400" fill="white" />
      <circle cx="200" cy="200" r="100" fill="black" />
      <circle cx="200" cy="200" r="130" fill="url(#blueHalo)">
        <animate attributeName="r" values="120;136;120" dur="5s" repeatCount="indefinite" />
        <animate attributeName="cx" values="200;220;200" dur="5s" repeatCount="indefinite" />
      </circle>
    </mask>

    <filter id="softBlur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="16" />
    </filter>

    <circle id="sparkle" r="6" fill="#aaddff" opacity="0">
      <animate attributeName="opacity" values="0;1;0" dur="1.8s" repeatCount="indefinite" />
      <animate attributeName="r" values="4;8;4" dur="1.8s" repeatCount="indefinite" />
    </circle>
  </defs>

  <g transform="translate(-60, -40) scale(1.6)">
    <circle cx="200" cy="200" r="140" fill="url(#blueHalo)" mask="url(#waveMask)" filter="url(#softBlur)">
      <animate attributeName="opacity" values="0.6;0.9;0.6" dur="6s" repeatCount="indefinite" />
    </circle>

    <use href="#sparkle" x="120" y="140" />
    <use href="#sparkle" x="280" y="180" />
    <use href="#sparkle" x="220" y="280" />
    <use href="#sparkle" x="160" y="240" />
  </g>
</svg>
          );

        case 'ethereal_rune':
          return (
            <svg width="400" height="400" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <g id="rune">
      <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(0,180,255,0.9)" stroke-width="8" />
      <path d="M24 48 L48 24 L72 48 L48 72 Z" fill="none" stroke="rgba(0,180,255,1)" stroke-width="8" />
      <path d="M48 24 L48 72" stroke="rgba(0,180,255,1)" stroke-width="8" />
      <path d="M24 48 L72 48" stroke="rgba(0,180,255,1)" stroke-width="8" />
    </g>
  </defs>

  <use href="#rune" x="0" y="0">
    <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" />
  </use>
</svg>
          );

        default:
          return null;
      }
    };

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Background Effect positioned behind the Blobbi */}
        <div className="absolute inset-0 flex items-center justify-center">
          {renderBackgroundEffect(blobbi.manifestation!)}
        </div>

        {/* Blobbi on top */}
        <div className="relative z-10">
          <BlobbiVisual blobbi={blobbiWithoutBackgroundEffect} />
        </div>
      </div>
    );
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
          <Card className="lg:sticky lg:top-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600 transition-all duration-500 max-w-4xl">
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
                      <div className="flex items-center justify-center transition-all duration-500 min-h-[380px] p-12 bg-gradient-to-br from-amber-50/60 to-orange-50/60 rounded-3xl border-2 border-amber-100/50">
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
                      <div className="w-full space-y-4">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">Egg Stats</h4>
                        <div className="grid grid-cols-2 gap-4 text-base">
                          <div className="flex justify-between">
                            <span>Happiness:</span>
                            <Badge 
                              variant="outline" 
                              className="text-sm px-3 py-1"
                            >
                              {eggData.happiness}/100
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Hygiene:</span>
                            <Badge 
                              variant="outline"
                              className="text-sm px-3 py-1"
                            >
                              {eggData.hygiene}/100
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Temperature:</span>
                            <Badge 
                              variant="outline"
                              className="text-sm px-3 py-1"
                            >
                              {eggData.egg_temperature}/100
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Shell Integrity:</span>
                            <Badge 
                              variant="outline"
                              className="text-sm px-3 py-1"
                            >
                              {eggData.shell_integrity}/100
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Incubation Progress */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Incubation Progress:</span>
                            <span>{eggData.incubation_progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full transition-all duration-300 h-3">
                            <div 
                              className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-300 h-3"
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
                      <div className="flex items-center justify-center transition-all duration-500 min-h-[400px] p-12 bg-gradient-to-br from-purple-50/60 to-pink-50/60 rounded-3xl border-2 border-purple-100/50">
                        <EggDemoBlobbiVisual
                          blobbi={createBabyBlobbi()!}
                        />
                      </div>
                      
                      {/* Baby Traits Display */}
                      <div className="w-full space-y-4">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">Baby Traits</h4>
                        <div className="space-y-3 text-base">
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
                          
                          {/* Visual Effects - HIDDEN FROM UI BUT DATA PRESERVED */}
                          {(babyData.manifestation) && (
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
                                {/* Pattern and Blessing badges removed from visual display */}
                                {/* {babyData.visualEffect && (
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
                                )} */}
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

                    {/* Pattern - HIDDEN FROM UI BUT DATA PRESERVED */}
                    {/* <div className="space-y-2">
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
                    </div> */}

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

                        {/* Pattern/Visual Effect Toggle - HIDDEN FROM UI BUT DATA PRESERVED */}
                        {/* <div className="space-y-2">
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
                        </div> */}

                        {/* Blessing Toggle - HIDDEN FROM UI BUT DATA PRESERVED */}
                        {/* <div className="space-y-2">
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
                        </div> */}
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