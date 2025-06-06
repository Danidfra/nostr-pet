import { NostrEvent } from '@nostrify/nostrify';
import { Blobbi } from '@/types/blobbi';

/**
 * Parse visual tags from a Nostr event and apply them to a Blobbi object
 */
export function parseBlobbiVisualTags(event: NostrEvent, blobbi: Partial<Blobbi>): Partial<Blobbi> {
  const updatedBlobbi = { ...blobbi };
  
  // Parse tags from the event
  for (const tag of event.tags) {
    const [tagName, value, description] = tag;
    
    switch (tagName) {
      // Core appearance tags
      case 'base_color':
        updatedBlobbi.baseColor = value;
        break;
      case 'secondary_color':
        updatedBlobbi.secondaryColor = value;
        break;
      case 'pattern':
        updatedBlobbi.pattern = value;
        break;
      case 'eye_color':
        updatedBlobbi.eyeColor = value;
        break;
      case 'special_mark':
        updatedBlobbi.specialMark = value;
        break;
      
      // Visual effect tags
      case 'manifestation':
        updatedBlobbi.manifestation = value;
        break;
      case 'visual_effect':
        updatedBlobbi.visualEffect = value;
        break;
      case 'blessing':
        updatedBlobbi.blessing = value;
        break;
      
      // Personality and traits
      case 'personality':
        if (!updatedBlobbi.personality) updatedBlobbi.personality = [];
        updatedBlobbi.personality.push(value);
        break;
      case 'trait':
      case 'discovered_trait':
      case 'passive_trait':
        if (!updatedBlobbi.traits) updatedBlobbi.traits = [];
        updatedBlobbi.traits.push(value);
        break;
      case 'mood':
        updatedBlobbi.mood = value as Blobbi['mood'];
        break;
      case 'favorite_food':
        updatedBlobbi.favoriteFood = value;
        break;
      case 'voice_type':
        updatedBlobbi.voiceType = value;
        break;
      case 'size':
        updatedBlobbi.size = value;
        break;
      case 'title':
        updatedBlobbi.title = value;
        break;
      case 'skill':
        updatedBlobbi.skill = value;
        break;
      
      // Core identity
      case 'name':
        updatedBlobbi.name = value;
        break;
      case 'stage':
        updatedBlobbi.lifeStage = value as Blobbi['lifeStage'];
        break;
      case 'generation':
        updatedBlobbi.generation = parseInt(value) || 1;
        break;
      case 'breeding_ready':
        updatedBlobbi.breedingReady = value === 'true';
        break;
      
      // Stats
      case 'hunger':
        if (!updatedBlobbi.stats) {
          updatedBlobbi.stats = {
            hunger: 0,
            happiness: 0,
            energy: 0,
            hygiene: 0,
            health: 0,
          };
        }
        updatedBlobbi.stats.hunger = parseInt(value) || 0;
        break;
      case 'happiness':
        if (!updatedBlobbi.stats) {
          updatedBlobbi.stats = {
            hunger: 0,
            happiness: 0,
            energy: 0,
            hygiene: 0,
            health: 0,
          };
        }
        updatedBlobbi.stats.happiness = parseInt(value) || 0;
        break;
      case 'health':
        if (!updatedBlobbi.stats) {
          updatedBlobbi.stats = {
            hunger: 0,
            happiness: 0,
            energy: 0,
            hygiene: 0,
            health: 0,
          };
        }
        updatedBlobbi.stats.health = parseInt(value) || 0;
        break;
      case 'hygiene':
        if (!updatedBlobbi.stats) {
          updatedBlobbi.stats = {
            hunger: 0,
            happiness: 0,
            energy: 0,
            hygiene: 0,
            health: 0,
          };
        }
        updatedBlobbi.stats.hygiene = parseInt(value) || 0;
        break;
      case 'energy':
        if (!updatedBlobbi.stats) {
          updatedBlobbi.stats = {
            hunger: 0,
            happiness: 0,
            energy: 0,
            hygiene: 0,
            health: 0,
          };
        }
        updatedBlobbi.stats.energy = parseInt(value) || 0;
        break;
      case 'experience':
        updatedBlobbi.experience = parseInt(value) || 0;
        break;
      case 'care_streak':
        updatedBlobbi.careStreak = parseInt(value) || 0;
        break;
      
      // Behavior
      case 'is_sleeping':
        updatedBlobbi.isSleeping = value === 'true';
        if (updatedBlobbi.isSleeping) {
          updatedBlobbi.state = 'sleeping';
        }
        break;
      case 'has_buff':
        updatedBlobbi.hasBuff = value;
        break;
      
      // Timestamps
      case 'birth_time':
        updatedBlobbi.birthTime = parseInt(value) * 1000; // Convert to milliseconds
        break;
      case 'last_interaction':
        updatedBlobbi.lastInteraction = parseInt(value);
        break;
      case 'last_meal':
        updatedBlobbi.lastMeal = parseInt(value);
        break;
      case 'last_clean':
        updatedBlobbi.lastClean = parseInt(value);
        break;
      case 'last_warm':
        updatedBlobbi.lastWarm = parseInt(value);
        break;
      case 'last_talk':
        updatedBlobbi.lastTalk = parseInt(value);
        break;
      case 'last_check':
        updatedBlobbi.lastCheck = parseInt(value);
        break;
      case 'last_sing':
        updatedBlobbi.lastSing = parseInt(value);
        break;
      case 'last_medicine':
        updatedBlobbi.lastMedicine = parseInt(value);
        break;
    }
  }
  
  return updatedBlobbi;
}

/**
 * Generate visual tags for a Blobbi to be included in a Nostr event
 */
export function generateBlobbiVisualTags(blobbi: Blobbi): Array<[string, string, string?]> {
  const tags: Array<[string, string, string?]> = [];
  
  // Core identity
  tags.push(['d', blobbi.id]);
  tags.push(['stage', blobbi.lifeStage]);
  tags.push(['name', blobbi.name]);
  tags.push(['generation', blobbi.generation.toString()]);
  tags.push(['breeding_ready', blobbi.breedingReady.toString()]);
  
  // Stats
  tags.push(['hunger', blobbi.stats.hunger.toString()]);
  tags.push(['happiness', blobbi.stats.happiness.toString()]);
  tags.push(['health', blobbi.stats.health.toString()]);
  tags.push(['hygiene', blobbi.stats.hygiene.toString()]);
  tags.push(['energy', blobbi.stats.energy.toString()]);
  tags.push(['experience', blobbi.experience.toString()]);
  tags.push(['care_streak', blobbi.careStreak.toString()]);
  
  // Appearance
  if (blobbi.baseColor) {
    tags.push(['base_color', blobbi.baseColor]);
  }
  if (blobbi.secondaryColor) {
    tags.push(['secondary_color', blobbi.secondaryColor]);
  }
  if (blobbi.pattern) {
    tags.push(['pattern', blobbi.pattern]);
  }
  if (blobbi.eyeColor) {
    tags.push(['eye_color', blobbi.eyeColor]);
  }
  if (blobbi.specialMark) {
    tags.push(['special_mark', blobbi.specialMark]);
  }
  if (blobbi.manifestation) {
    tags.push(['manifestation', blobbi.manifestation]);
  }
  if (blobbi.visualEffect) {
    tags.push(['visual_effect', blobbi.visualEffect]);
  }
  if (blobbi.blessing) {
    tags.push(['blessing', blobbi.blessing]);
  }
  
  // Personality
  if (blobbi.personality) {
    blobbi.personality.forEach(p => tags.push(['personality', p]));
  }
  if (blobbi.traits) {
    blobbi.traits.forEach(t => tags.push(['trait', t]));
  }
  if (blobbi.mood) {
    tags.push(['mood', blobbi.mood]);
  }
  if (blobbi.favoriteFood) {
    tags.push(['favorite_food', blobbi.favoriteFood]);
  }
  if (blobbi.voiceType) {
    tags.push(['voice_type', blobbi.voiceType]);
  }
  if (blobbi.size) {
    tags.push(['size', blobbi.size]);
  }
  if (blobbi.title) {
    tags.push(['title', blobbi.title]);
  }
  if (blobbi.skill) {
    tags.push(['skill', blobbi.skill]);
  }
  
  // Behavior
  tags.push(['is_sleeping', blobbi.isSleeping?.toString() || 'false']);
  if (blobbi.hasBuff) {
    tags.push(['has_buff', blobbi.hasBuff]);
  }
  
  // Timestamps
  tags.push(['birth_time', Math.floor(blobbi.birthTime / 1000).toString()]);
  tags.push(['last_interaction', blobbi.lastInteraction.toString()]);
  if (blobbi.lastMeal) {
    tags.push(['last_meal', blobbi.lastMeal.toString()]);
  }
  if (blobbi.lastClean) {
    tags.push(['last_clean', blobbi.lastClean.toString()]);
  }
  if (blobbi.lastWarm) {
    tags.push(['last_warm', blobbi.lastWarm.toString()]);
  }
  if (blobbi.lastTalk) {
    tags.push(['last_talk', blobbi.lastTalk.toString()]);
  }
  if (blobbi.lastCheck) {
    tags.push(['last_check', blobbi.lastCheck.toString()]);
  }
  if (blobbi.lastSing) {
    tags.push(['last_sing', blobbi.lastSing.toString()]);
  }
  if (blobbi.lastMedicine) {
    tags.push(['last_medicine', blobbi.lastMedicine.toString()]);
  }
  
  return tags;
}

/**
 * Get visual effect rarity based on the effect type
 */
export function getVisualEffectRarity(effectType: string): 'common' | 'uncommon' | 'rare' | 'legendary' {
  // Manifestation rarities
  const manifestationRarities: Record<string, string> = {
    // Common
    'dot_center': 'common',
    'oval_spots': 'common',
    'side_bands': 'common',
    'dot_speckle': 'common',
    'light_dash': 'common',
    'freckle_patch': 'common',
    'sparkle_trail': 'common',
    'light_smoke': 'common',
    'dusty_aura': 'common',
    
    // Uncommon
    'ring_mark': 'uncommon',
    'blush_sides': 'uncommon',
    'tiger_stripe': 'uncommon',
    'glow_ring': 'uncommon',
    'wavy_spots': 'uncommon',
    'mist_drift': 'uncommon',
    
    // Rare
    'rune_top': 'rare',
    'shimmer_band': 'rare',
    'spirit_knot': 'rare',
    'crescent_moon': 'rare',
    'tiny_star': 'rare',
    'wave_stroke': 'rare',
    'glow_blue': 'rare',
    'glimmer_gold': 'rare',
    'mist_wisp': 'rare',
    
    // Legendary
    'sigil_eye': 'legendary',
    'glow_crack_pattern': 'legendary',
    'ethereal_rune': 'legendary',
    'leaf_stamp': 'legendary',
    'divine_circle': 'legendary',
    'ancestral_knot': 'legendary',
    'angel_halo': 'legendary',
    'aurora_waves': 'legendary',
    'radiant_line': 'legendary',
  };
  
  // Pattern rarities
  const patternRarities: Record<string, string> = {
    // Common
    'stripes': 'common',
    'dots': 'common',
    'gradient': 'common',
    'soft_wave': 'common',
    
    // Uncommon
    'spiral_twist': 'uncommon',
    'galaxy_dust': 'uncommon',
    'crackled_lines': 'uncommon',
    
    // Rare
    'nebula_bloom': 'rare',
    'sacred_geometry': 'rare',
    'shifting_rings': 'rare',
  };
  
  // Blessing rarities
  const blessingRarities: Record<string, string> = {
    // Common
    'telepathic': 'common',
    'keen_sense': 'common',
    'light_heal': 'common',
    
    // Rare
    'night_vision': 'rare',
    'inner_peace': 'rare',
    'sun_gifted': 'rare',
    
    // Legendary
    'eternal_grace': 'legendary',
    'blessing_of_light': 'legendary',
    'soul_touch': 'legendary',
  };
  
  return (manifestationRarities[effectType] || 
          patternRarities[effectType] || 
          blessingRarities[effectType] || 
          'common') as 'common' | 'uncommon' | 'rare' | 'legendary';
}

/**
 * Generate random visual effects for a new Blobbi based on spawn chances
 */
export function generateRandomVisualEffects(): Partial<Blobbi> {
  const effects: Partial<Blobbi> = {};
  
  // Manifestation (25% chance)
  if (Math.random() < 0.25) {
    const manifestations = [
      // Common (50%)
      'dot_center', 'oval_spots', 'side_bands', 'dot_speckle', 'light_dash', 
      'freckle_patch', 'sparkle_trail', 'light_smoke', 'dusty_aura',
      // Uncommon (30%)
      'ring_mark', 'blush_sides', 'tiger_stripe', 'glow_ring', 'wavy_spots', 'mist_drift',
      // Rare (15%)
      'rune_top', 'shimmer_band', 'spirit_knot', 'crescent_moon', 'tiny_star', 
      'wave_stroke', 'glow_blue', 'glimmer_gold', 'mist_wisp',
      // Legendary (5%)
      'sigil_eye', 'glow_crack_pattern', 'ethereal_rune', 'leaf_stamp', 'divine_circle', 
      'ancestral_knot', 'angel_halo', 'aurora_waves', 'radiant_line'
    ];
    
    const rand = Math.random();
    let manifestation: string;
    
    if (rand < 0.5) {
      // Common (50%)
      manifestation = manifestations.slice(0, 9)[Math.floor(Math.random() * 9)];
    } else if (rand < 0.8) {
      // Uncommon (30%)
      manifestation = manifestations.slice(9, 15)[Math.floor(Math.random() * 6)];
    } else if (rand < 0.95) {
      // Rare (15%)
      manifestation = manifestations.slice(15, 24)[Math.floor(Math.random() * 9)];
    } else {
      // Legendary (5%)
      manifestation = manifestations.slice(24)[Math.floor(Math.random() * 9)];
    }
    
    effects.manifestation = manifestation;
  }
  
  // Pattern (30% chance)
  if (Math.random() < 0.3) {
    const patterns = [
      // Common (50%)
      'stripes', 'dots', 'gradient', 'soft_wave',
      // Uncommon (35%)
      'spiral_twist', 'galaxy_dust', 'crackled_lines',
      // Rare (15%)
      'nebula_bloom', 'sacred_geometry', 'shifting_rings'
    ];
    
    const rand = Math.random();
    let pattern: string;
    
    if (rand < 0.5) {
      // Common (50%)
      pattern = patterns.slice(0, 4)[Math.floor(Math.random() * 4)];
    } else if (rand < 0.85) {
      // Uncommon (35%)
      pattern = patterns.slice(4, 7)[Math.floor(Math.random() * 3)];
    } else {
      // Rare (15%)
      pattern = patterns.slice(7)[Math.floor(Math.random() * 3)];
    }
    
    effects.pattern = pattern;
  }
  
  // Blessing (10% chance)
  if (Math.random() < 0.1) {
    const blessings = [
      // Common (65%)
      'telepathic', 'keen_sense', 'light_heal',
      // Rare (20%)
      'night_vision', 'inner_peace', 'sun_gifted',
      // Legendary (15%)
      'eternal_grace', 'blessing_of_light', 'soul_touch'
    ];
    
    const rand = Math.random();
    let blessing: string;
    
    if (rand < 0.65) {
      // Common (65%)
      blessing = blessings.slice(0, 3)[Math.floor(Math.random() * 3)];
    } else if (rand < 0.85) {
      // Rare (20%)
      blessing = blessings.slice(3, 6)[Math.floor(Math.random() * 3)];
    } else {
      // Legendary (15%)
      blessing = blessings.slice(6)[Math.floor(Math.random() * 3)];
    }
    
    effects.blessing = blessing;
  }
  
  return effects;
}