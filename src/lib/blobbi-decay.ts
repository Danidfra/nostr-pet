import { Blobbi, BlobbiStats } from '@/types/blobbi';
import { clampStat } from '@/lib/blobbi-events';

// Decay rates per hour according to specification
const EGG_DECAY_RATES = {
  egg_temperature: -3,
  hygiene: -2,
  happiness: -3,
  // shell_integrity has complex decay based on other stats
} as const;

const POST_HATCH_DECAY_RATES = {
  hunger: -5.0,
  happiness: -3.0,
  energy: -6.0, // when awake, +4.0 when sleeping
  hygiene: -4.0,
  health: -1.0, // baseline, can increase with poor care
} as const;

// Shell integrity decay thresholds and rates
const SHELL_INTEGRITY_DECAY = {
  egg_temperature: {
    threshold1: 70,
    decay1: -2,
    threshold2: 40,
    decay2: -4,
  },
  hygiene: {
    threshold1: 50,
    decay1: -1.5,
    threshold2: 20,
    decay2: -3,
  },
  happiness: {
    threshold1: 70,
    decay1: -1,
    threshold2: 40,
    decay2: -2,
  },
} as const;

// Health decay modifiers for post-hatch stage
const HEALTH_DECAY_MODIFIERS = {
  hunger: { threshold: 30, modifier: 1.5 },
  hygiene: { threshold: 20, modifier: 1.0 },
  energy: { threshold: 20, modifier: 1.0 },
  happiness: { threshold: 30, modifier: 1.0 },
} as const;

// Regeneration conditions
const REGENERATION_CONDITIONS = {
  shell_integrity: {
    all_stats_required: 100,
    pause_threshold: 90,
    stop_threshold: 30,
    rate: 1,
  },
  health: {
    all_stats_threshold: 80,
    rate: 2,
  },
};

/**
 * Calculate hourly decay for egg stage
 */
export function calculateEggDecay(blobbi: Blobbi, hoursPassed: number): Partial<Blobbi> {
  if (blobbi.lifeStage !== 'egg') {
    throw new Error('calculateEggDecay can only be called for eggs');
  }

  const currentTemp = blobbi.eggTemperature ?? 100;
  const currentHygiene = blobbi.stats.hygiene;
  const currentHappiness = blobbi.stats.happiness;
  const currentShellIntegrity = blobbi.shellIntegrity ?? 100;

  // Apply basic decay
  const newTemp = clampStat(currentTemp + (EGG_DECAY_RATES.egg_temperature * hoursPassed));
  const newHygiene = clampStat(currentHygiene + (EGG_DECAY_RATES.hygiene * hoursPassed));
  const newHappiness = clampStat(currentHappiness + (EGG_DECAY_RATES.happiness * hoursPassed));

  // Calculate shell integrity decay based on other stats
  let shellDecayRate = 0;

  // Temperature-based decay
  if (newTemp < SHELL_INTEGRITY_DECAY.egg_temperature.threshold2) {
    shellDecayRate += SHELL_INTEGRITY_DECAY.egg_temperature.decay2;
  } else if (newTemp < SHELL_INTEGRITY_DECAY.egg_temperature.threshold1) {
    shellDecayRate += SHELL_INTEGRITY_DECAY.egg_temperature.decay1;
  }

  // Hygiene-based decay
  if (newHygiene < SHELL_INTEGRITY_DECAY.hygiene.threshold2) {
    shellDecayRate += SHELL_INTEGRITY_DECAY.hygiene.decay2;
  } else if (newHygiene < SHELL_INTEGRITY_DECAY.hygiene.threshold1) {
    shellDecayRate += SHELL_INTEGRITY_DECAY.hygiene.decay1;
  }

  // Happiness-based decay
  if (newHappiness < SHELL_INTEGRITY_DECAY.happiness.threshold2) {
    shellDecayRate += SHELL_INTEGRITY_DECAY.happiness.decay2;
  } else if (newHappiness < SHELL_INTEGRITY_DECAY.happiness.threshold1) {
    shellDecayRate += SHELL_INTEGRITY_DECAY.happiness.decay1;
  }

  // Check for regeneration conditions
  let shellIntegrityChange = shellDecayRate * hoursPassed;
  
  if (newTemp === 100 && newHygiene === 100 && newHappiness === 100) {
    // Perfect care: regenerate at +1/hour
    shellIntegrityChange = REGENERATION_CONDITIONS.shell_integrity.rate * hoursPassed;
  } else if (newTemp >= REGENERATION_CONDITIONS.shell_integrity.pause_threshold && 
             newHygiene >= REGENERATION_CONDITIONS.shell_integrity.pause_threshold && 
             newHappiness >= REGENERATION_CONDITIONS.shell_integrity.pause_threshold) {
    // Good care: pause decay
    shellIntegrityChange = 0;
  } else if (newTemp < REGENERATION_CONDITIONS.shell_integrity.stop_threshold ||
             newHygiene < REGENERATION_CONDITIONS.shell_integrity.stop_threshold ||
             newHappiness < REGENERATION_CONDITIONS.shell_integrity.stop_threshold) {
    // Poor care: apply full decay
    // shellIntegrityChange already calculated above
  }

  const newShellIntegrity = clampStat(currentShellIntegrity + shellIntegrityChange);

  return {
    eggTemperature: newTemp,
    stats: {
      ...blobbi.stats,
      hygiene: newHygiene,
      happiness: newHappiness,
    },
    shellIntegrity: newShellIntegrity,
  };
}

/**
 * Calculate hourly decay for post-hatch stage
 */
export function calculatePostHatchDecay(blobbi: Blobbi, hoursPassed: number): Partial<Blobbi> {
  if (blobbi.lifeStage === 'egg') {
    throw new Error('calculatePostHatchDecay cannot be called for eggs');
  }

  const currentStats = blobbi.stats;
  const isSleeping = blobbi.isSleeping ?? false;

  // Apply basic decay
  const newHunger = clampStat(currentStats.hunger + (POST_HATCH_DECAY_RATES.hunger * hoursPassed));
  const newHappiness = clampStat(currentStats.happiness + (POST_HATCH_DECAY_RATES.happiness * hoursPassed));
  const newHygiene = clampStat(currentStats.hygiene + (POST_HATCH_DECAY_RATES.hygiene * hoursPassed));
  
  // Energy decay/regeneration based on sleep state
  const energyRate = isSleeping ? 4.0 : POST_HATCH_DECAY_RATES.energy;
  const newEnergy = clampStat(currentStats.energy + (energyRate * hoursPassed));

  // Calculate health decay with modifiers
  let healthDecayRate: number = POST_HATCH_DECAY_RATES.health;

  // Add modifiers based on other stats
  if (newHunger < HEALTH_DECAY_MODIFIERS.hunger.threshold) {
    healthDecayRate -= HEALTH_DECAY_MODIFIERS.hunger.modifier;
  }
  if (newHygiene < HEALTH_DECAY_MODIFIERS.hygiene.threshold) {
    healthDecayRate -= HEALTH_DECAY_MODIFIERS.hygiene.modifier;
  }
  if (newEnergy < HEALTH_DECAY_MODIFIERS.energy.threshold) {
    healthDecayRate -= HEALTH_DECAY_MODIFIERS.energy.modifier;
  }
  if (newHappiness < HEALTH_DECAY_MODIFIERS.happiness.threshold) {
    healthDecayRate -= HEALTH_DECAY_MODIFIERS.happiness.modifier;
  }

  // Check for health regeneration
  if (newHunger >= REGENERATION_CONDITIONS.health.all_stats_threshold &&
      newHygiene >= REGENERATION_CONDITIONS.health.all_stats_threshold &&
      newEnergy >= REGENERATION_CONDITIONS.health.all_stats_threshold &&
      newHappiness >= REGENERATION_CONDITIONS.health.all_stats_threshold) {
    healthDecayRate = REGENERATION_CONDITIONS.health.rate; // Positive rate for regeneration
  }

  const newHealth = clampStat(currentStats.health + (healthDecayRate * hoursPassed));

  return {
    stats: {
      hunger: newHunger,
      happiness: newHappiness,
      energy: newEnergy,
      hygiene: newHygiene,
      health: newHealth,
    },
  };
}

/**
 * Apply decay to a Blobbi based on time passed since last interaction
 */
export function applyDecay(blobbi: Blobbi, currentTime: number = Date.now()): Blobbi {
  if (blobbi.state === 'hibernating') {
    return blobbi; // No decay when hibernating
  }

  const hoursPassed = (currentTime / 1000 - blobbi.lastInteraction) / (60 * 60);
  
  if (hoursPassed < 0.1) {
    return blobbi; // Less than 6 minutes, no decay
  }

  let updates: Partial<Blobbi>;

  if (blobbi.lifeStage === 'egg') {
    updates = calculateEggDecay(blobbi, hoursPassed);
  } else {
    updates = calculatePostHatchDecay(blobbi, hoursPassed);
  }

  return {
    ...blobbi,
    ...updates,
    lastInteraction: Math.floor(currentTime / 1000),
  };
}

/**
 * Check if shell integrity is critically low and needs penalty event
 */
export function shouldEmitShellIntegrityPenalty(blobbi: Blobbi): boolean {
  return blobbi.lifeStage === 'egg' && 
         (blobbi.shellIntegrity ?? 100) < 50;
}

/**
 * Calculate care points deduction for shell integrity penalty
 */
export function calculateShellIntegrityPenalty(hoursBelowThreshold: number): number {
  return hoursBelowThreshold * 5; // 5 care points per hour below 50
}

/**
 * Get decay summary for display purposes
 */
export function getDecaySummary(blobbi: Blobbi, hoursPassed: number): {
  stage: string;
  decayRates: Record<string, number>;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  if (blobbi.lifeStage === 'egg') {
    const temp = blobbi.eggTemperature ?? 100;
    const hygiene = blobbi.stats.hygiene;
    const happiness = blobbi.stats.happiness;
    const shellIntegrity = blobbi.shellIntegrity ?? 100;

    if (temp < 40) warnings.push('Temperature critically low!');
    if (hygiene < 20) warnings.push('Shell very dirty!');
    if (happiness < 40) warnings.push('Egg feeling neglected!');
    if (shellIntegrity < 50) warnings.push('Shell integrity critical!');

    return {
      stage: 'egg',
      decayRates: {
        warmth: EGG_DECAY_RATES.egg_temperature,
        cleanliness: EGG_DECAY_RATES.hygiene,
        happiness: EGG_DECAY_RATES.happiness,
        health: -1, // Variable rate, showing baseline
      },
      warnings,
    };
  } else {
    const stats = blobbi.stats;
    
    if (stats.hunger < 30) warnings.push('Very hungry!');
    if (stats.hygiene < 20) warnings.push('Needs bath!');
    if (stats.energy < 20) warnings.push('Exhausted!');
    if (stats.happiness < 30) warnings.push('Feeling sad!');
    if (stats.health < 30) warnings.push('Feeling sick!');

    return {
      stage: 'post-hatch',
      decayRates: {
        hunger: POST_HATCH_DECAY_RATES.hunger,
        happiness: POST_HATCH_DECAY_RATES.happiness,
        energy: blobbi.isSleeping ? 4.0 : POST_HATCH_DECAY_RATES.energy,
        hygiene: POST_HATCH_DECAY_RATES.hygiene,
        health: POST_HATCH_DECAY_RATES.health,
      },
      warnings,
    };
  }
}

/**
 * Calculate time until next critical threshold
 */
export function getTimeToNextCritical(blobbi: Blobbi): {
  stat: string;
  currentValue: number;
  threshold: number;
  hoursUntilCritical: number;
} | null {
  if (blobbi.lifeStage === 'egg') {
    const temp = blobbi.eggTemperature ?? 100;
    const hygiene = blobbi.stats.hygiene;
    const happiness = blobbi.stats.happiness;

    const candidates = [
      { stat: 'warmth', value: temp, threshold: 40, rate: EGG_DECAY_RATES.egg_temperature },
      { stat: 'cleanliness', value: hygiene, threshold: 20, rate: EGG_DECAY_RATES.hygiene },
      { stat: 'happiness', value: happiness, threshold: 40, rate: EGG_DECAY_RATES.happiness },
    ];

    const nextCritical = candidates
      .filter(c => c.value > c.threshold && c.rate < 0)
      .map(c => ({
        ...c,
        hoursUntilCritical: (c.value - c.threshold) / Math.abs(c.rate),
      }))
      .sort((a, b) => a.hoursUntilCritical - b.hoursUntilCritical)[0];

    if (nextCritical) {
      return {
        stat: nextCritical.stat,
        currentValue: nextCritical.value,
        threshold: nextCritical.threshold,
        hoursUntilCritical: nextCritical.hoursUntilCritical,
      };
    }
  } else {
    const stats = blobbi.stats;
    const candidates = [
      { stat: 'hunger', value: stats.hunger, threshold: 30, rate: POST_HATCH_DECAY_RATES.hunger },
      { stat: 'hygiene', value: stats.hygiene, threshold: 20, rate: POST_HATCH_DECAY_RATES.hygiene },
      { stat: 'happiness', value: stats.happiness, threshold: 30, rate: POST_HATCH_DECAY_RATES.happiness },
      { stat: 'energy', value: stats.energy, threshold: 20, rate: blobbi.isSleeping ? -4.0 : POST_HATCH_DECAY_RATES.energy },
      { stat: 'health', value: stats.health, threshold: 30, rate: POST_HATCH_DECAY_RATES.health },
    ];

    const nextCritical = candidates
      .filter(c => c.value > c.threshold && c.rate < 0)
      .map(c => ({
        ...c,
        hoursUntilCritical: (c.value - c.threshold) / Math.abs(c.rate),
      }))
      .sort((a, b) => a.hoursUntilCritical - b.hoursUntilCritical)[0];

    if (nextCritical) {
      return {
        stat: nextCritical.stat,
        currentValue: nextCritical.value,
        threshold: nextCritical.threshold,
        hoursUntilCritical: nextCritical.hoursUntilCritical,
      };
    }
  }

  return null;
}