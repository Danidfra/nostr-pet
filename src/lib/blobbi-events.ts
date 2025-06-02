import { NostrEvent } from '@nostrify/nostrify';
import { 
  Blobbi, 
  BlobbiStateEvent, 
  BlobbiInteractionEvent, 
  BlobbiRecordEvent, 
  BlobbiBreedingEvent,
  BlobbonautProfileEvent,
  BlobbonautProfile,
  BlobbonautStorageItem,
  BlobbiRecordType,
  BlobbiInteractionType,
  BlobbiInteractionData,
  BlobbiRecordData,
  BlobbiStats,
  BlobbiLifeStage,
  BlobbiMood
} from '@/types/blobbi';

// Event kinds according to the specification
export const BLOBBI_EVENT_KINDS = {
  STATE: 31124,      // Addressable - current state
  INTERACTION: 14919, // Regular - individual interactions
  BREEDING: 14920,   // Regular - breeding events
  RECORD: 14921,     // Regular - immutable records
  BLOBBANAUT_PROFILE: 31125, // Addressable - Blobbanaut (owner) profile
} as const;

// Validation schemas for required and optional tags
const REQUIRED_STATE_TAGS = ['d', 'stage', 'breeding_ready', 'generation', 'hunger', 'happiness', 'health', 'hygiene', 'energy', 'experience', 'care_streak'];
const REQUIRED_INTERACTION_TAGS = ['blobbi_id', 'action', 'action_category', 'stat_change'];
const REQUIRED_RECORD_TAGS = ['blobbi_id', 'record_type'];
const REQUIRED_BREEDING_TAGS = ['parent_a', 'parent_b', 'owner_a', 'owner_b', 'breed_time', 'success'];
const REQUIRED_BLOBBANAUT_TAGS = ['d']; // Only 'd' tag is required for Blobbanaut Profile

// Helper function to validate required tags
function validateRequiredTags(tags: string[][], requiredTags: string[]): boolean {
  const tagNames = tags.map(tag => tag[0]).filter(Boolean);
  return requiredTags.every(required => tagNames.includes(required));
}

// Helper function to get tag value
function getTagValue(tags: string[][], tagName: string): string | undefined {
  const tag = tags.find(tag => tag[0] === tagName);
  return tag && tag[1] ? tag[1] : undefined;
}

// Helper function to get all tag values for a tag name (for multi-value tags)
function getTagValues(tags: string[][], tagName: string): string[] {
  return tags.filter(tag => tag[0] === tagName).map(tag => tag[1]).filter(Boolean);
}

// Create Kind 31124: Shell Integrity Penalty Event
export function createShellIntegrityPenaltyEvent(
  blobbi: Blobbi,
  carePointsDeducted: number
): Omit<BlobbiStateEvent, 'id' | 'pubkey' | 'created_at' | 'sig'> {
  const tags: Array<[string, string]> = [
    ['d', blobbi.id],
    ['penalty', 'shell_integrity_breach'],
    ['value', (blobbi.shellIntegrity ?? 100).toString()],
    ['care_points_deducted', carePointsDeducted.toString()],
  ];

  return {
    kind: BLOBBI_EVENT_KINDS.STATE,
    content: `${blobbi.name}'s shell integrity is critically low (${blobbi.shellIntegrity ?? 100}%). Care points deducted: ${carePointsDeducted}`,
    tags,
  };
}

// Create Kind 31124: Blobbi Current State Event
export function createBlobbiStateEvent(blobbi: Blobbi): Omit<BlobbiStateEvent, 'id' | 'pubkey' | 'created_at' | 'sig'> {
  const tags: Array<[string, string]> = [
    ['d', blobbi.id],
    ['stage', blobbi.lifeStage],
    ['breeding_ready', blobbi.breedingReady.toString()],
    ['generation', blobbi.generation.toString()],
    ['hunger', Math.round(blobbi.stats.hunger).toString()],
    ['happiness', Math.round(blobbi.stats.happiness).toString()],
    ['health', Math.round(blobbi.stats.health).toString()],
    ['hygiene', Math.round(blobbi.stats.hygiene).toString()],
    ['energy', Math.round(blobbi.stats.energy).toString()],
    ['experience', blobbi.experience.toString()],
    ['care_streak', blobbi.careStreak.toString()],
  ];

  // Add optional appearance tags
  if (blobbi.baseColor) tags.push(['base_color', blobbi.baseColor]);
  if (blobbi.secondaryColor) tags.push(['secondary_color', blobbi.secondaryColor]);
  if (blobbi.pattern) tags.push(['pattern', blobbi.pattern]);
  if (blobbi.eyeColor) tags.push(['eye_color', blobbi.eyeColor]);
  if (blobbi.specialMark) tags.push(['special_mark', blobbi.specialMark]);

  // Add personality tags
  if (blobbi.personality) {
    blobbi.personality.forEach(trait => tags.push(['personality', trait]));
  }
  if (blobbi.traits) {
    blobbi.traits.forEach(trait => tags.push(['trait', trait]));
  }
  if (blobbi.mood) tags.push(['mood', blobbi.mood]);
  if (blobbi.favoriteFood) tags.push(['favorite_food', blobbi.favoriteFood]);
  if (blobbi.voiceType) tags.push(['voice_type', blobbi.voiceType]);
  if (blobbi.size) tags.push(['size', blobbi.size]);
  if (blobbi.title) tags.push(['title', blobbi.title]);
  if (blobbi.skill) tags.push(['skill', blobbi.skill]);

  // Add egg-specific tags
  if (blobbi.lifeStage === 'egg') {
    if (blobbi.incubationTime) tags.push(['incubation_time', blobbi.incubationTime.toString()]);
    if (blobbi.incubationProgress) tags.push(['incubation_progress', blobbi.incubationProgress.toString()]);
    if (blobbi.eggTemperature !== undefined) tags.push(['egg_temperature', blobbi.eggTemperature.toString()]);
    if (blobbi.eggStatus) tags.push(['egg_status', blobbi.eggStatus]);
    if (blobbi.shellIntegrity) tags.push(['shell_integrity', blobbi.shellIntegrity.toString()]);
  }

  // Add behavior tags
  if (blobbi.isSleeping) tags.push(['is_sleeping', blobbi.isSleeping.toString()]);
  if (blobbi.isDirty) tags.push(['is_dirty', blobbi.isDirty.toString()]);
  if (blobbi.hasBuff) tags.push(['has_buff', blobbi.hasBuff]);
  if (blobbi.hasDebuff) tags.push(['has_debuff', blobbi.hasDebuff]);
  if (blobbi.lastInteraction) tags.push(['last_interaction', blobbi.lastInteraction.toString()]);

  // Add last care tracking fields - Unix timestamps in seconds (same format as Nostr's created_at)
  // These fields track when specific actions were last performed and are used for cooldowns and evolution
  // Only include these tags if the actions have actually been performed (not just initialized during adoption)
  if (blobbi.lastMeal) tags.push(['last_meal', blobbi.lastMeal.toString()]);
  if (blobbi.lastClean) tags.push(['last_clean', blobbi.lastClean.toString()]);
  if (blobbi.lastWarm) tags.push(['last_warm', blobbi.lastWarm.toString()]);
  if (blobbi.lastTalk) tags.push(['last_talk', blobbi.lastTalk.toString()]);
  if (blobbi.lastCheck) tags.push(['last_check', blobbi.lastCheck.toString()]);
  if (blobbi.lastSing) tags.push(['last_sing', blobbi.lastSing.toString()]);
  if (blobbi.lastMedicine) tags.push(['last_medicine', blobbi.lastMedicine.toString()]);

  // Add social tags
  if (blobbi.adoptedBy) tags.push(['adopted_by', blobbi.adoptedBy]);
  if (blobbi.adoptedFrom) tags.push(['adopted_from', blobbi.adoptedFrom]);
  if (blobbi.currentLocation) tags.push(['current_location', blobbi.currentLocation]);
  if (blobbi.inParty) tags.push(['in_party', blobbi.inParty.toString()]);
  if (blobbi.visibleToOthers !== undefined) tags.push(['visible_to_others', blobbi.visibleToOthers.toString()]);

  return {
    kind: BLOBBI_EVENT_KINDS.STATE,
    content: `${blobbi.name} is a ${blobbi.lifeStage} Blobbi.`,
    tags,
  };
}

// Create Kind 14919: Blobbi Interaction Event
export function createBlobbiInteractionEvent(
  blobbiId: string, 
  interactionData: BlobbiInteractionData
): Omit<BlobbiInteractionEvent, 'id' | 'pubkey' | 'created_at' | 'sig'> {
  const tags: Array<[string, string]> = [
    ['blobbi_id', blobbiId],
    ['action', interactionData.action],
    ['action_category', interactionData.actionCategory],
    ['stat_change', `${interactionData.statChange[0]}:${interactionData.statChange[1]}`],
  ];

  // Add multiple stat changes if provided (for items with multiple effects)
  if (interactionData.statChanges && interactionData.statChanges.length > 1) {
    // Skip the first one since it's already added as the primary stat_change
    interactionData.statChanges.slice(1).forEach(([stat, value]) => {
      tags.push(['stat_change', `${stat}:${value}`]);
    });
  }

  // Add optional interaction tags
  if (interactionData.itemUsed) tags.push(['item_used', interactionData.itemUsed]);
  if (interactionData.itemQuality) tags.push(['item_quality', interactionData.itemQuality]);
  if (interactionData.timeOfDay) tags.push(['time_of_day', interactionData.timeOfDay]);
  if (interactionData.blobbiMoodBefore) tags.push(['blobbi_mood_before', interactionData.blobbiMoodBefore]);
  if (interactionData.blobbiMoodAfter) tags.push(['blobbi_mood_after', interactionData.blobbiMoodAfter]);
  if (interactionData.animationPlayed) tags.push(['animation_played', interactionData.animationPlayed]);
  if (interactionData.soundPlayed) tags.push(['sound_played', interactionData.soundPlayed]);
  if (interactionData.bonusApplied) tags.push(['bonus_applied', interactionData.bonusApplied]);
  if (interactionData.experienceGained) tags.push(['experience_gained', interactionData.experienceGained.toString()]);
  if (interactionData.careStreak) tags.push(['care_streak', interactionData.careStreak.toString()]);
  if (interactionData.carePoints) tags.push(['care_points', interactionData.carePoints.toString()]);
  if (interactionData.achievementProgress) tags.push(['achievement_progress', `${interactionData.achievementProgress[0]}:${interactionData.achievementProgress[1]}`]);
  if (interactionData.achievementUnlocked) tags.push(['achievement_unlocked', interactionData.achievementUnlocked]);
  if (interactionData.specialEvent) tags.push(['special_event', interactionData.specialEvent]);
  if (interactionData.memoryCreated) tags.push(['memory_created', interactionData.memoryCreated]);

  // Add action-specific tags
  if (interactionData.gameType) tags.push(['game_type', interactionData.gameType]);
  if (interactionData.toyUsed) tags.push(['toy_used', interactionData.toyUsed]);
  if (interactionData.playDuration) tags.push(['play_duration', interactionData.playDuration.toString()]);
  if (interactionData.location) tags.push(['location', interactionData.location]);
  if (interactionData.playPartner) tags.push(['play_partner', interactionData.playPartner]);
  if (interactionData.skillImproved) tags.push(['skill_improved', `${interactionData.skillImproved[0]}:${interactionData.skillImproved[1]}`]);
  if (interactionData.bondIncreased) tags.push(['bond_increased', `${interactionData.bondIncreased[0]}:${interactionData.bondIncreased[1]}`]);
  if (interactionData.newMoveLearn) tags.push(['new_move_learned', interactionData.newMoveLearn]);
  if (interactionData.cleaningType) tags.push(['cleaning_type', interactionData.cleaningType]);
  if (interactionData.waterTemperature) tags.push(['water_temperature', interactionData.waterTemperature]);
  if (interactionData.soapUsed) tags.push(['soap_used', interactionData.soapUsed]);
  if (interactionData.groomingTool) tags.push(['grooming_tool', interactionData.groomingTool]);
  if (interactionData.specialEffect) tags.push(['special_effect', interactionData.specialEffect]);
  if (interactionData.scentApplied) tags.push(['scent_applied', interactionData.scentApplied]);
  if (interactionData.moodBoost) tags.push(['mood_boost', interactionData.moodBoost]);
  if (interactionData.restType) tags.push(['rest_type', interactionData.restType]);
  if (interactionData.bedType) tags.push(['bed_type', interactionData.bedType]);
  if (interactionData.lullabyPlayed) tags.push(['lullaby_played', interactionData.lullabyPlayed]);
  if (interactionData.sleepDuration) tags.push(['sleep_duration', interactionData.sleepDuration.toString()]);
  if (interactionData.dreamType) tags.push(['dream_type', interactionData.dreamType]);
  if (interactionData.growthBonus) tags.push(['growth_bonus', interactionData.growthBonus]);
  if (interactionData.dreamMemory) tags.push(['dream_memory', interactionData.dreamMemory]);
  if (interactionData.socialRole) tags.push(['social_role', `${interactionData.socialRole[0]}:${interactionData.socialRole[1]}`]);
  if (interactionData.interactionQuality) tags.push(['interaction_quality', interactionData.interactionQuality]);
  if (interactionData.emotionTriggered) tags.push(['emotion_triggered', interactionData.emotionTriggered]);
  if (interactionData.sharedMemory) tags.push(['shared_memory', interactionData.sharedMemory]);
  if (interactionData.interactionContext) tags.push(['interaction_context', interactionData.interactionContext]);

  return {
    kind: BLOBBI_EVENT_KINDS.INTERACTION,
    content: `Blobbi ${interactionData.action} interaction`,
    tags,
  };
}

// Create Kind 14921: Blobbi Record Event
export function createBlobbiRecordEvent(
  blobbiId: string,
  recordData: BlobbiRecordData,
  content?: string
): Omit<BlobbiRecordEvent, 'id' | 'pubkey' | 'created_at' | 'sig'> {
  const tags: Array<[string, string]> = [
    ['blobbi_id', blobbiId],
    ['record_type', recordData.recordType],
  ];

  // Add conditional tags based on record type
  switch (recordData.recordType) {
    case 'birth':
      if (recordData.generation) tags.push(['generation', recordData.generation.toString()]);
      if (recordData.origin) tags.push(['origin', recordData.origin]);
      if (recordData.birthLocation) tags.push(['birth_location', recordData.birthLocation]);
      if (recordData.weatherAtBirth) tags.push(['weather_at_birth', recordData.weatherAtBirth]);
      if (recordData.shellColor) tags.push(['shell_color', recordData.shellColor]);
      if (recordData.shellPattern) tags.push(['shell_pattern', recordData.shellPattern]);
      if (recordData.initialTrait) {
        recordData.initialTrait.forEach(trait => tags.push(['initial_trait', trait]));
      }
      if (recordData.rarity) tags.push(['rarity', recordData.rarity]);
      if (recordData.parent1) tags.push(['parent_1', recordData.parent1]);
      if (recordData.parent2) tags.push(['parent_2', recordData.parent2]);
      if (recordData.lineageDepth) tags.push(['lineage_depth', recordData.lineageDepth.toString()]);
      if (recordData.geneticMarker) tags.push(['genetic_marker', recordData.geneticMarker]);
      if (recordData.birthSeason) tags.push(['birth_season', recordData.birthSeason]);
      if (recordData.birthMoonPhase) tags.push(['birth_moon_phase', recordData.birthMoonPhase]);
      if (recordData.creator) tags.push(['creator', recordData.creator]);
      if (recordData.designUrl) tags.push(['design_url', recordData.designUrl]);
      if (recordData.adoptionFee) tags.push(['adoption_fee', recordData.adoptionFee.toString()]);
      if (recordData.legacyTrait) {
        recordData.legacyTrait.forEach(trait => tags.push(['legacy_trait', trait]));
      }
      if (recordData.passiveTrait) {
        recordData.passiveTrait.forEach(trait => tags.push(['passive_trait', trait]));
      }
      break;

    case 'hatched':
      if (recordData.hatchedAt) tags.push(['hatched_at', new Date(recordData.hatchedAt).toISOString()]);
      if (recordData.hatchedBy) tags.push(['hatched_by', recordData.hatchedBy]);
      if (recordData.eggType) tags.push(['egg_type', recordData.eggType]);
      if (recordData.incubationTime) tags.push(['incubation_time', recordData.incubationTime]);
      break;

    case 'adoption':
      if (recordData.adoptedBy) tags.push(['adopted_by', recordData.adoptedBy]);
      if (recordData.adoptedOn) tags.push(['adopted_on', new Date(recordData.adoptedOn).toISOString()]);
      if (recordData.adoptionMethod) tags.push(['adoption_method', recordData.adoptionMethod]);
      if (recordData.title) tags.push(['title', recordData.title]);
      if (recordData.titleReason) tags.push(['title_reason', recordData.titleReason]);
      break;

    case 'evolution':
      if (recordData.evolutionStage) tags.push(['evolution_stage', recordData.evolutionStage]);
      if (recordData.evolutionReason) tags.push(['evolution_reason', recordData.evolutionReason]);
      if (recordData.evolvedFrom) tags.push(['evolved_from', recordData.evolvedFrom]);
      break;

    case 'memory':
      if (recordData.memoryTitle) tags.push(['memory_title', recordData.memoryTitle]);
      if (recordData.memoryDescription) tags.push(['memory_description', recordData.memoryDescription]);
      if (recordData.memoryDate) tags.push(['memory_date', recordData.memoryDate]);
      if (recordData.discoveredTrait) tags.push(['discovered_trait', recordData.discoveredTrait]);
      if (recordData.achievement) tags.push(['achievement', recordData.achievement]);
      if (recordData.milestone) tags.push(['milestone', recordData.milestone]);
      break;
  }

  return {
    kind: BLOBBI_EVENT_KINDS.RECORD,
    content: content || `Blobbi ${recordData.recordType} record`,
    tags,
  };
}

// Create Kind 14920: Blobbi Breeding Event
export function createBlobbiBreedingEvent(
  parentA: string,
  parentB: string,
  ownerA: string,
  ownerB: string,
  success: boolean,
  offspringId?: string,
  additionalData?: Record<string, string>
): Omit<BlobbiBreedingEvent, 'id' | 'pubkey' | 'created_at' | 'sig'> {
  const tags: Array<[string, string]> = [
    ['parent_a', parentA],
    ['parent_b', parentB],
    ['owner_a', ownerA],
    ['owner_b', ownerB],
    ['breed_time', new Date().toISOString()],
    ['success', success.toString()],
  ];

  if (offspringId) tags.push(['offspring_id', offspringId]);
  
  // Add additional breeding data
  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      tags.push([key, value]);
    });
  }

  return {
    kind: BLOBBI_EVENT_KINDS.BREEDING,
    content: success ? 'New life is forming ✨' : 'Breeding attempt was unsuccessful',
    tags,
  };
}

// Create Kind 31125: Blobbanaut Profile Event
export function createBlobbonautProfileEvent(
  profile: BlobbonautProfile
): Omit<BlobbonautProfileEvent, 'id' | 'pubkey' | 'created_at' | 'sig'> {
  const tags: Array<[string, string]> = [
    ['d', profile.id],
  ];

  // Add optional tags
  if (profile.coins !== undefined) tags.push(['coins', profile.coins.toString()]);
  if (profile.pettingLevel !== undefined) tags.push(['pettingLevel', profile.pettingLevel.toString()]);
  if (profile.lifetimeBlobbis !== undefined) tags.push(['lifetimeBlobbis', profile.lifetimeBlobbis.toString()]);
  if (profile.favoriteBlobbi) tags.push(['favoriteBlobbi', profile.favoriteBlobbi]);
  if (profile.starterBlobbi) tags.push(['starterBlobbi', profile.starterBlobbi]);
  if (profile.style) tags.push(['style', profile.style]);
  if (profile.background) tags.push(['background', profile.background]);
  if (profile.title) tags.push(['title', profile.title]);

  // Add owned Blobbis (multiple 'has' tags)
  profile.ownedBlobbis.forEach(blobbiId => {
    tags.push(['has', blobbiId]);
  });

  // Add achievements (multiple 'achievements' tags)
  profile.achievements.forEach(achievement => {
    tags.push(['achievements', achievement]);
  });

  // Add storage items (multiple 'storage' tags in format "item_id:quantity")
  profile.storage.forEach(storageItem => {
    tags.push(['storage', `${storageItem.itemId}:${storageItem.quantity}`]);
  });

  return {
    kind: BLOBBI_EVENT_KINDS.BLOBBANAUT_PROFILE,
    content: '', // Content must be empty according to spec
    tags,
  };
}

// Parse Blobbi from Kind 31124 state event
export function parseBlobbiFromStateEvent(event: NostrEvent): Blobbi | null {
  try {
    if (event.kind !== BLOBBI_EVENT_KINDS.STATE) return null;
    
    const tags = event.tags;
    if (!validateRequiredTags(tags, REQUIRED_STATE_TAGS)) return null;

    const id = getTagValue(tags, 'd');
    const stage = getTagValue(tags, 'stage') as BlobbiLifeStage;
    const breedingReady = getTagValue(tags, 'breeding_ready') === 'true';
    const generation = parseInt(getTagValue(tags, 'generation') || '1');
    
    const stats: BlobbiStats = {
      hunger: parseInt(getTagValue(tags, 'hunger') || '100'),
      happiness: parseInt(getTagValue(tags, 'happiness') || '100'),
      health: parseInt(getTagValue(tags, 'health') || '100'),
      hygiene: parseInt(getTagValue(tags, 'hygiene') || '100'),
      energy: parseInt(getTagValue(tags, 'energy') || '100'),
    };

    const experience = parseInt(getTagValue(tags, 'experience') || '0');
    const careStreak = parseInt(getTagValue(tags, 'care_streak') || '0');

    if (!id || !stage) return null;

    const blobbi: Blobbi = {
      id,
      ownerPubkey: event.pubkey,
      name: extractBlobbiName(id), // Extract name from ID using helper
      birthTime: event.created_at * 1000,
      lastInteraction: getTagValue(tags, 'last_interaction') ? parseInt(getTagValue(tags, 'last_interaction')!) : event.created_at,
      lifeStage: stage,
      state: getTagValue(tags, 'is_sleeping') === 'true' ? 'sleeping' : 'active',
      stats,
      customization: {
        color: getTagValue(tags, 'base_color') || '#7C3AED',
        pattern: getTagValue(tags, 'pattern'),
        accessories: [],
      },
      experience,
      coins: 0, // Not stored in state event
      inventory: [], // Not stored in state event
      generation,
      breedingReady,
      careStreak,
      evolutionProgress: {
        totalCareDays: 0,
        currentStreak: careStreak,
        lastCareDate: 0,
        careSessions: [],
        isEligibleForEvolution: false,
        nextEvolutionCheck: Date.now(),
      },
      // Optional appearance fields
      baseColor: getTagValue(tags, 'base_color'),
      secondaryColor: getTagValue(tags, 'secondary_color'),
      pattern: getTagValue(tags, 'pattern'),
      eyeColor: getTagValue(tags, 'eye_color'),
      specialMark: getTagValue(tags, 'special_mark'),
      // Personality fields
      personality: getTagValues(tags, 'personality'),
      traits: getTagValues(tags, 'trait'),
      mood: getTagValue(tags, 'mood') as BlobbiMood,
      favoriteFood: getTagValue(tags, 'favorite_food'),
      voiceType: getTagValue(tags, 'voice_type'),
      size: getTagValue(tags, 'size'),
      title: getTagValue(tags, 'title'),
      skill: getTagValue(tags, 'skill'),
      // Egg-specific fields
      incubationTime: getTagValue(tags, 'incubation_time') ? parseInt(getTagValue(tags, 'incubation_time')!) : undefined,
      incubationProgress: getTagValue(tags, 'incubation_progress') ? parseInt(getTagValue(tags, 'incubation_progress')!) : undefined,
      eggTemperature: getTagValue(tags, 'egg_temperature') ? parseInt(getTagValue(tags, 'egg_temperature')!) : undefined,
      eggStatus: getTagValue(tags, 'egg_status'),
      shellIntegrity: getTagValue(tags, 'shell_integrity') ? parseInt(getTagValue(tags, 'shell_integrity')!) : undefined,
      // Behavior fields
      isSleeping: getTagValue(tags, 'is_sleeping') === 'true',
      isDirty: getTagValue(tags, 'is_dirty') === 'true',
      hasBuff: getTagValue(tags, 'has_buff'),
      hasDebuff: getTagValue(tags, 'has_debuff'),
      // Last care tracking fields - Unix timestamps in seconds (same format as Nostr's created_at)
      // These fields track when specific actions were last performed and are used for cooldowns and evolution
      lastMeal: getTagValue(tags, 'last_meal') ? parseInt(getTagValue(tags, 'last_meal')!) : undefined,
      lastClean: getTagValue(tags, 'last_clean') ? parseInt(getTagValue(tags, 'last_clean')!) : undefined,
      lastWarm: getTagValue(tags, 'last_warm') ? parseInt(getTagValue(tags, 'last_warm')!) : undefined,
      lastTalk: getTagValue(tags, 'last_talk') ? parseInt(getTagValue(tags, 'last_talk')!) : undefined,
      lastCheck: getTagValue(tags, 'last_check') ? parseInt(getTagValue(tags, 'last_check')!) : undefined,
      lastSing: getTagValue(tags, 'last_sing') ? parseInt(getTagValue(tags, 'last_sing')!) : undefined,
      lastMedicine: getTagValue(tags, 'last_medicine') ? parseInt(getTagValue(tags, 'last_medicine')!) : undefined,
      // Social fields
      adoptedBy: getTagValue(tags, 'adopted_by'),
      adoptedFrom: getTagValue(tags, 'adopted_from'),
      currentLocation: getTagValue(tags, 'current_location'),
      inParty: getTagValue(tags, 'in_party') === 'true',
      visibleToOthers: getTagValue(tags, 'visible_to_others') !== 'false', // Default to true
    };

    return blobbi;
  } catch (error) {
    console.error('Error parsing Blobbi from state event:', error);
    return null;
  }
}

// Parse interaction data from Kind 14919 event
export function parseInteractionFromEvent(event: NostrEvent): BlobbiInteractionData | null {
  try {
    if (event.kind !== BLOBBI_EVENT_KINDS.INTERACTION) return null;
    
    const tags = event.tags;
    if (!validateRequiredTags(tags, REQUIRED_INTERACTION_TAGS)) return null;

    const action = getTagValue(tags, 'action') as BlobbiInteractionType;
    const actionCategory = getTagValue(tags, 'action_category');
    const statChangeTag = tags.find(([name]) => name === 'stat_change');
    
    if (!action || !actionCategory || !statChangeTag) return null;

    const statChangeParts = statChangeTag[1].split(':');
    if (statChangeParts.length !== 2) return null;
    
    const statChange: [string, string] = [statChangeParts[0], statChangeParts[1]];

    const interactionData: BlobbiInteractionData = {
      action,
      actionCategory,
      statChange,
      // Parse all optional fields
      itemUsed: getTagValue(tags, 'item_used'),
      itemQuality: getTagValue(tags, 'item_quality'),
      timeOfDay: getTagValue(tags, 'time_of_day'),
      blobbiMoodBefore: getTagValue(tags, 'blobbi_mood_before'),
      blobbiMoodAfter: getTagValue(tags, 'blobbi_mood_after'),
      animationPlayed: getTagValue(tags, 'animation_played'),
      soundPlayed: getTagValue(tags, 'sound_played'),
      bonusApplied: getTagValue(tags, 'bonus_applied'),
      experienceGained: getTagValue(tags, 'experience_gained') ? parseInt(getTagValue(tags, 'experience_gained')!) : undefined,
      careStreak: getTagValue(tags, 'care_streak') ? parseInt(getTagValue(tags, 'care_streak')!) : undefined,
      carePoints: getTagValue(tags, 'care_points') ? parseInt(getTagValue(tags, 'care_points')!) : undefined,
      achievementUnlocked: getTagValue(tags, 'achievement_unlocked'),
      specialEvent: getTagValue(tags, 'special_event'),
      memoryCreated: getTagValue(tags, 'memory_created'),
      // Action-specific fields
      gameType: getTagValue(tags, 'game_type'),
      toyUsed: getTagValue(tags, 'toy_used'),
      playDuration: getTagValue(tags, 'play_duration') ? parseInt(getTagValue(tags, 'play_duration')!) : undefined,
      location: getTagValue(tags, 'location'),
      playPartner: getTagValue(tags, 'play_partner'),
      newMoveLearn: getTagValue(tags, 'new_move_learned'),
      cleaningType: getTagValue(tags, 'cleaning_type'),
      waterTemperature: getTagValue(tags, 'water_temperature'),
      soapUsed: getTagValue(tags, 'soap_used'),
      groomingTool: getTagValue(tags, 'grooming_tool'),
      specialEffect: getTagValue(tags, 'special_effect'),
      scentApplied: getTagValue(tags, 'scent_applied'),
      moodBoost: getTagValue(tags, 'mood_boost'),
      restType: getTagValue(tags, 'rest_type'),
      bedType: getTagValue(tags, 'bed_type'),
      lullabyPlayed: getTagValue(tags, 'lullaby_played'),
      sleepDuration: getTagValue(tags, 'sleep_duration') ? parseInt(getTagValue(tags, 'sleep_duration')!) : undefined,
      dreamType: getTagValue(tags, 'dream_type'),
      growthBonus: getTagValue(tags, 'growth_bonus'),
      dreamMemory: getTagValue(tags, 'dream_memory'),
      interactionQuality: getTagValue(tags, 'interaction_quality'),
      emotionTriggered: getTagValue(tags, 'emotion_triggered'),
      sharedMemory: getTagValue(tags, 'shared_memory'),
      interactionContext: getTagValue(tags, 'interaction_context'),
    };

    // Parse complex tags
    const achievementProgressTag = tags.find(([name]) => name === 'achievement_progress');
    if (achievementProgressTag) {
      const parts = achievementProgressTag[1].split(':');
      if (parts.length === 2) {
        interactionData.achievementProgress = [parts[0], parts[1]];
      }
    }

    const skillImprovedTag = tags.find(([name]) => name === 'skill_improved');
    if (skillImprovedTag) {
      const parts = skillImprovedTag[1].split(':');
      if (parts.length === 2) {
        interactionData.skillImproved = [parts[0], parts[1]];
      }
    }

    const bondIncreasedTag = tags.find(([name]) => name === 'bond_increased');
    if (bondIncreasedTag) {
      const parts = bondIncreasedTag[1].split(':');
      if (parts.length === 2) {
        interactionData.bondIncreased = [parts[0], parts[1]];
      }
    }

    const socialRoleTag = tags.find(([name]) => name === 'social_role');
    if (socialRoleTag) {
      const parts = socialRoleTag[1].split(':');
      if (parts.length === 2) {
        interactionData.socialRole = [parts[0], parts[1]];
      }
    }

    return interactionData;
  } catch (error) {
    console.error('Error parsing interaction from event:', error);
    return null;
  }
}

// Parse record data from Kind 14921 event
export function parseRecordFromEvent(event: NostrEvent): BlobbiRecordData | null {
  try {
    if (event.kind !== BLOBBI_EVENT_KINDS.RECORD) return null;
    
    const tags = event.tags;
    if (!validateRequiredTags(tags, REQUIRED_RECORD_TAGS)) return null;

    const recordType = getTagValue(tags, 'record_type') as BlobbiRecordType;
    if (!recordType) return null;

    const recordData: BlobbiRecordData = {
      recordType,
      generation: getTagValue(tags, 'generation') ? parseInt(getTagValue(tags, 'generation')!) : undefined,
    };

    // Parse fields based on record type
    switch (recordType) {
      case 'birth': {
        recordData.origin = getTagValue(tags, 'origin');
        recordData.birthLocation = getTagValue(tags, 'birth_location');
        recordData.weatherAtBirth = getTagValue(tags, 'weather_at_birth');
        recordData.shellColor = getTagValue(tags, 'shell_color');
        recordData.shellPattern = getTagValue(tags, 'shell_pattern');
        recordData.initialTrait = getTagValues(tags, 'initial_trait');
        recordData.rarity = getTagValue(tags, 'rarity');
        recordData.parent1 = getTagValue(tags, 'parent_1');
        recordData.parent2 = getTagValue(tags, 'parent_2');
        recordData.lineageDepth = getTagValue(tags, 'lineage_depth') ? parseInt(getTagValue(tags, 'lineage_depth')!) : undefined;
        recordData.geneticMarker = getTagValue(tags, 'genetic_marker');
        recordData.birthSeason = getTagValue(tags, 'birth_season');
        recordData.birthMoonPhase = getTagValue(tags, 'birth_moon_phase');
        recordData.creator = getTagValue(tags, 'creator');
        recordData.designUrl = getTagValue(tags, 'design_url');
        recordData.adoptionFee = getTagValue(tags, 'adoption_fee') ? parseInt(getTagValue(tags, 'adoption_fee')!) : undefined;
        recordData.legacyTrait = getTagValues(tags, 'legacy_trait');
        recordData.passiveTrait = getTagValues(tags, 'passive_trait');
        break;
      }

      case 'hatched': {
        recordData.hatchedAt = getTagValue(tags, 'hatched_at') ? new Date(getTagValue(tags, 'hatched_at')!).getTime() : undefined;
        recordData.hatchedBy = getTagValue(tags, 'hatched_by');
        recordData.eggType = getTagValue(tags, 'egg_type');
        recordData.incubationTime = getTagValue(tags, 'incubation_time');
        break;
      }

      case 'adoption': {
        recordData.adoptedBy = getTagValue(tags, 'adopted_by');
        recordData.adoptedOn = getTagValue(tags, 'adopted_on') ? new Date(getTagValue(tags, 'adopted_on')!).getTime() : undefined;
        recordData.adoptionMethod = getTagValue(tags, 'adoption_method');
        recordData.title = getTagValue(tags, 'title');
        recordData.titleReason = getTagValue(tags, 'title_reason');
        break;
      }

      case 'evolution': {
        recordData.evolutionStage = getTagValue(tags, 'evolution_stage');
        recordData.evolutionReason = getTagValue(tags, 'evolution_reason');
        recordData.evolvedFrom = getTagValue(tags, 'evolved_from');
        break;
      }

      case 'memory': {
        recordData.memoryTitle = getTagValue(tags, 'memory_title');
        recordData.memoryDescription = getTagValue(tags, 'memory_description');
        recordData.memoryDate = getTagValue(tags, 'memory_date');
        recordData.discoveredTrait = getTagValue(tags, 'discovered_trait');
        recordData.achievement = getTagValue(tags, 'achievement');
        recordData.milestone = getTagValue(tags, 'milestone');
        break;
      }
    }

    return recordData;
  } catch (error) {
    console.error('Error parsing record from event:', error);
    return null;
  }
}

// Parse Blobbanaut Profile from Kind 31125 event
export function parseBlobbonautProfileFromEvent(event: NostrEvent): BlobbonautProfile | null {
  try {
    if (event.kind !== BLOBBI_EVENT_KINDS.BLOBBANAUT_PROFILE) return null;
    
    const tags = event.tags;
    if (!validateRequiredTags(tags, REQUIRED_BLOBBANAUT_TAGS)) return null;

    const id = getTagValue(tags, 'd');
    if (!id) return null;

    // Parse storage items from storage tags
    const storageTagValues = getTagValues(tags, 'storage');
    const storage: BlobbonautStorageItem[] = storageTagValues
      .map(storageValue => {
        const parts = storageValue.split(':');
        if (parts.length === 2) {
          const itemId = parts[0];
          const quantity = parseInt(parts[1]);
          if (!isNaN(quantity) && quantity > 0) {
            return { itemId, quantity };
          }
        }
        return null;
      })
      .filter((item): item is BlobbonautStorageItem => item !== null);

    const profile: BlobbonautProfile = {
      id,
      ownerPubkey: event.pubkey,
      coins: parseInt(getTagValue(tags, 'coins') || '0'),
      ownedBlobbis: getTagValues(tags, 'has'),
      pettingLevel: parseInt(getTagValue(tags, 'pettingLevel') || '0'),
      lifetimeBlobbis: parseInt(getTagValue(tags, 'lifetimeBlobbis') || '0'),
      achievements: getTagValues(tags, 'achievements'),
      storage,
      favoriteBlobbi: getTagValue(tags, 'favoriteBlobbi'),
      starterBlobbi: getTagValue(tags, 'starterBlobbi'),
      style: getTagValue(tags, 'style'),
      background: getTagValue(tags, 'background'),
      title: getTagValue(tags, 'title'),
    };

    return profile;
  } catch (error) {
    console.error('Error parsing Blobbanaut Profile from event:', error);
    return null;
  }
}

// Enhanced validation for specific record types
function validateRecordTypeSpecificTags(tags: string[][], recordType: string): boolean {
  const tagNames = tags.map(tag => tag[0]).filter(Boolean);
  
  switch (recordType) {
    case 'birth':
      // Birth records should have generation
      return tagNames.includes('generation');
    case 'hatched':
      // Hatched records should have hatched_at or hatched_by
      return tagNames.includes('hatched_at') || tagNames.includes('hatched_by');
    case 'evolution':
      // Evolution records should have evolution_stage
      return tagNames.includes('evolution_stage');
    case 'memory':
      // Memory records should have memory_title or achievement or milestone
      return tagNames.includes('memory_title') || tagNames.includes('achievement') || tagNames.includes('milestone');
    case 'adoption':
      // Adoption records should have adopted_by or title
      return tagNames.includes('adopted_by') || tagNames.includes('title');
    default:
      return true; // Unknown record types are allowed
  }
}

// Validate stat change format
function validateStatChange(statChangeTag: string): boolean {
  const parts = statChangeTag.split(':');
  if (parts.length !== 2) return false;
  
  const [stat, change] = parts;
  const validStats = ['hunger', 'happiness', 'health', 'hygiene', 'energy', 'egg_temperature'];
  const changeNum = parseInt(change);
  
  return validStats.includes(stat) && !isNaN(changeNum) && Math.abs(changeNum) <= 100;
}

// Validate timestamp format
function validateTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) && date.getTime() > 0;
}

// Validate event structure with enhanced checks
export function validateBlobbiEvent(event: NostrEvent): boolean {
  try {
    // Basic kind validation
    if (!Object.values(BLOBBI_EVENT_KINDS).includes(event.kind as typeof BLOBBI_EVENT_KINDS[keyof typeof BLOBBI_EVENT_KINDS])) {
      return false;
    }

    // Validate required tags
    switch (event.kind) {
      case BLOBBI_EVENT_KINDS.STATE: {
        if (!validateRequiredTags(event.tags, REQUIRED_STATE_TAGS)) return false;
        
        // Validate stat values are within range
        const statTags = ['hunger', 'happiness', 'health', 'hygiene', 'energy'];
        for (const statTag of statTags) {
          const value = getTagValue(event.tags, statTag);
          if (value) {
            const numValue = parseInt(value);
            if (isNaN(numValue) || numValue < 0 || numValue > 100) return false;
          }
        }
        
        // Validate stage is valid
        const stage = getTagValue(event.tags, 'stage');
        if (stage && !['egg', 'child', 'adult'].includes(stage)) return false;
        
        break;
      }
        
      case BLOBBI_EVENT_KINDS.INTERACTION: {
        if (!validateRequiredTags(event.tags, REQUIRED_INTERACTION_TAGS)) return false;
        
        // Validate stat change format
        const statChangeTag = event.tags.find(([name]) => name === 'stat_change');
        if (statChangeTag && !validateStatChange(statChangeTag[1])) return false;
        
        // Validate action type
        const action = getTagValue(event.tags, 'action');
        const validActions = ['feed', 'play', 'clean', 'rest', 'warm', 'check', 'sing', 'talk', 'medicine', 'cruzar'];
        if (action && !validActions.includes(action)) return false;
        
        break;
      }
        
      case BLOBBI_EVENT_KINDS.RECORD: {
        if (!validateRequiredTags(event.tags, REQUIRED_RECORD_TAGS)) return false;
        
        // Validate record type specific requirements
        const recordType = getTagValue(event.tags, 'record_type');
        if (recordType && !validateRecordTypeSpecificTags(event.tags, recordType)) return false;
        
        // Validate timestamp fields
        const timestampFields = ['hatched_at', 'adopted_on'];
        for (const field of timestampFields) {
          const timestamp = getTagValue(event.tags, field);
          if (timestamp && !validateTimestamp(timestamp)) return false;
        }
        
        break;
      }
        
      case BLOBBI_EVENT_KINDS.BREEDING: {
        if (!validateRequiredTags(event.tags, REQUIRED_BREEDING_TAGS)) return false;
        
        // Validate breed_time timestamp
        const breedTime = getTagValue(event.tags, 'breed_time');
        if (breedTime && !validateTimestamp(breedTime)) return false;
        
        // Validate success is boolean
        const success = getTagValue(event.tags, 'success');
        if (success && !['true', 'false'].includes(success)) return false;
        
        break;
      }
        
      case BLOBBI_EVENT_KINDS.BLOBBANAUT_PROFILE: {
        if (!validateRequiredTags(event.tags, REQUIRED_BLOBBANAUT_TAGS)) return false;
        
        // Validate content is empty
        if (event.content !== '') return false;
        
        // Validate numeric fields if present
        const numericFields = ['coins', 'pettingLevel', 'lifetimeBlobbis'];
        for (const field of numericFields) {
          const value = getTagValue(event.tags, field);
          if (value) {
            const numValue = parseInt(value);
            if (isNaN(numValue) || numValue < 0) return false;
          }
        }
        
        break;
      }
        
      default:
        return false;
    }

    // Validate event timestamp is reasonable (not too far in future, not before 2020)
    const minTimestamp = new Date('2020-01-01').getTime() / 1000;
    const maxTimestamp = (Date.now() + 5 * 60 * 1000) / 1000; // 5 minutes in future
    
    if (event.created_at < minTimestamp || event.created_at > maxTimestamp) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// Helper function to validate Blobbi ID format
export function validateBlobbiId(blobbiId: string): boolean {
  // Must start with "blobbi-" followed by at least one valid character
  return /^blobbi-[a-z0-9_-]+$/.test(blobbiId) && blobbiId.length > 7 && blobbiId.length <= 57;
}

// Helper function to create Blobbi ID from name
export function createBlobbiId(blobbiName: string): string {
  if (!isValidBlobbiName(blobbiName)) {
    throw new Error('Invalid Blobbi name: must contain at least one alphanumeric character');
  }
  const cleanName = normalizeBlobbiName(blobbiName);
  return `blobbi-${cleanName}`;
}

// Helper function to extract Blobbi name from ID
export function extractBlobbiName(blobbiId: string): string {
  if (!validateBlobbiId(blobbiId)) {
    throw new Error('Invalid blobbiId format');
  }
  return blobbiId.replace('blobbi-', '');
}

// Helper function to normalize a name for use in blobbiId
export function normalizeBlobbiName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

// Helper function to check if a name would create a valid blobbiId
export function isValidBlobbiName(name: string): boolean {
  const normalized = normalizeBlobbiName(name);
  return normalized.length > 0 && normalized.length <= 50; // Reasonable length limit
}

// Helper function to clamp stat values
export function clampStat(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// Helper function to extract action timestamps from Blobbi object
// Maps last_<action> fields to their corresponding action names
export function extractActionTimestamps(blobbi: Blobbi): Record<string, number> {
  const actionTimestamps: Record<string, number> = {};
  
  // Map last_<action> fields to action names
  if (blobbi.lastMeal) actionTimestamps.feed = blobbi.lastMeal * 1000; // Convert to milliseconds
  if (blobbi.lastClean) actionTimestamps.clean = blobbi.lastClean * 1000;
  if (blobbi.lastWarm) actionTimestamps.warm = blobbi.lastWarm * 1000;
  if (blobbi.lastTalk) actionTimestamps.talk = blobbi.lastTalk * 1000;
  if (blobbi.lastCheck) actionTimestamps.check = blobbi.lastCheck * 1000;
  if (blobbi.lastSing) actionTimestamps.sing = blobbi.lastSing * 1000;
  if (blobbi.lastMedicine) actionTimestamps.medicine = blobbi.lastMedicine * 1000;
  
  // Note: rest, play, and cruzar don't have corresponding last_* fields in the Blobbi type
  // but they still update lastInteraction which is handled separately
  
  return actionTimestamps;
}

// Helper function to calculate stat degradation over time
// Note: This function is deprecated in favor of the comprehensive decay system in blobbi-decay.ts
// It's kept for backward compatibility but should use applyDecay() for new implementations
export function calculateStatDegradation(
  lastInteraction: number, 
  currentTime: number = Date.now()
): Partial<BlobbiStats> {
  const hoursPassed = (currentTime - lastInteraction) / (1000 * 60 * 60);
  
  // Degradation rates per hour (simplified version for compatibility)
  const degradationRates = {
    hunger: -5,
    happiness: -3,
    hygiene: -2,
    energy: -4, // Only during active periods
  };
  
  return {
    hunger: Math.max(0, degradationRates.hunger * hoursPassed),
    happiness: Math.max(0, degradationRates.happiness * hoursPassed),
    hygiene: Math.max(0, degradationRates.hygiene * hoursPassed),
    energy: Math.max(0, degradationRates.energy * hoursPassed),
  };
}