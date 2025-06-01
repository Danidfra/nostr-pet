import { 
  Blobbi, 
  BlobbiEvolutionProgress, 
  BlobbiCareSession, 
  BlobbiCareAction,
  BlobbiEvolutionForm,
  BlobbiLifeStage
} from '@/types/blobbi';

// Constants for evolution mechanics
const EVOLUTION_REQUIREMENTS = {
  REQUIRED_CARE_DAYS: 4,              // 4 full days of care required
  MIN_ACTIONS_PER_DAY: 3,             // Minimum care actions per day to count
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours - max time between actions to maintain session
  CARE_WINDOW: 36 * 60 * 60 * 1000,  // 36 hours - grace period for daily care
};

// Initialize evolution progress for a new Blobbi
export function initializeEvolutionProgress(): BlobbiEvolutionProgress {
  return {
    totalCareDays: 0,
    currentStreak: 0,
    lastCareDate: 0,
    careSessions: [],
    isEligibleForEvolution: false,
    nextEvolutionCheck: Date.now() + EVOLUTION_REQUIREMENTS.SESSION_TIMEOUT,
  };
}

// Check if an action counts as a care action
export function isCareAction(action: string): action is BlobbiCareAction {
  return ['feed', 'play', 'clean', 'medicine'].includes(action);
}

// Update evolution progress when a care action is performed
export function updateEvolutionProgress(
  blobbi: Blobbi,
  action: string,
  currentTime: number = Date.now()
): BlobbiEvolutionProgress {
  // If already evolved, no need to track progress
  if (blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi') {
    return blobbi.evolutionProgress;
  }

  // Only track care actions
  if (!isCareAction(action)) {
    return blobbi.evolutionProgress;
  }

  const progress = { ...blobbi.evolutionProgress };
  const timeSinceLastCare = currentTime - progress.lastCareDate;

  // Get or create current session
  let currentSession = progress.careSessions[progress.careSessions.length - 1];
  
  // Check if we need to start a new session
  if (!currentSession || timeSinceLastCare > EVOLUTION_REQUIREMENTS.SESSION_TIMEOUT) {
    // End previous session if it exists
    if (currentSession && !currentSession.endTime) {
      currentSession.endTime = progress.lastCareDate;
    }
    
    // Start new session
    currentSession = {
      startTime: currentTime,
      actions: 0,
    };
    progress.careSessions.push(currentSession);
    
    // Reset streak if too much time has passed
    if (timeSinceLastCare > EVOLUTION_REQUIREMENTS.CARE_WINDOW) {
      progress.currentStreak = 0;
    }
  }

  // Update current session
  currentSession.actions++;
  progress.lastCareDate = currentTime;

  // Update care sessions array
  progress.careSessions = [...progress.careSessions.slice(0, -1), currentSession];

  // Calculate care days and streak
  const { totalDays, consecutiveDays } = calculateCareDays(progress.careSessions, currentTime);
  progress.totalCareDays = totalDays;
  progress.currentStreak = consecutiveDays;

  // Check evolution eligibility
  progress.isEligibleForEvolution = 
    progress.totalCareDays >= EVOLUTION_REQUIREMENTS.REQUIRED_CARE_DAYS &&
    progress.currentStreak >= EVOLUTION_REQUIREMENTS.REQUIRED_CARE_DAYS;

  // Set next evolution check
  progress.nextEvolutionCheck = currentTime + EVOLUTION_REQUIREMENTS.SESSION_TIMEOUT;

  return progress;
}

// Calculate total care days and current streak
function calculateCareDays(
  sessions: BlobbiCareSession[],
  currentTime: number
): { totalDays: number; consecutiveDays: number } {
  if (sessions.length === 0) {
    return { totalDays: 0, consecutiveDays: 0 };
  }

  // Group sessions by calendar day
  const careDayMap = new Map<string, number>();
  const dayKeys: string[] = [];

  sessions.forEach(session => {
    const startDate = new Date(session.startTime);
    const endTime = session.endTime || currentTime;
    const endDate = new Date(endTime);

    // Add all days this session spans
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayKey = currentDate.toISOString().split('T')[0];
      const existingActions = careDayMap.get(dayKey) || 0;
      
      // Count actions for this day (simplified: all actions count for the start day)
      if (currentDate.toDateString() === startDate.toDateString()) {
        careDayMap.set(dayKey, existingActions + session.actions);
        if (!dayKeys.includes(dayKey)) {
          dayKeys.push(dayKey);
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });

  // Count days with sufficient care
  const qualifyingDays = Array.from(careDayMap.entries())
    .filter(([_, actions]) => actions >= EVOLUTION_REQUIREMENTS.MIN_ACTIONS_PER_DAY)
    .map(([day, _]) => day)
    .sort();

  const totalDays = qualifyingDays.length;

  // Calculate consecutive days (counting backwards from today)
  let consecutiveDays = 0;
  const today = new Date(currentTime);
  
  for (let i = 0; i < EVOLUTION_REQUIREMENTS.REQUIRED_CARE_DAYS + 1; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dayKey = checkDate.toISOString().split('T')[0];
    
    if (qualifyingDays.includes(dayKey)) {
      consecutiveDays++;
    } else if (i > 0) {
      // Allow today to not have care yet, but break streak if any previous day is missing
      break;
    }
  }

  return { totalDays, consecutiveDays };
}

// Get a deterministic evolution form based on care patterns and user input
export function determineEvolutionForm(
  blobbi: Blobbi,
  userSeed?: string
): BlobbiEvolutionForm {
  // Use a combination of factors for deterministic but varied evolution
  const factors = [
    blobbi.ownerPubkey,
    blobbi.name,
    blobbi.birthTime.toString(),
    userSeed || '',
    // Care pattern factors
    blobbi.evolutionProgress.totalCareDays.toString(),
    blobbi.experience.toString(),
    // Stats at evolution time
    Object.values(blobbi.stats).join(','),
  ].join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < factors.length; i++) {
    const char = factors.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Map to evolution forms
  const forms: BlobbiEvolutionForm[] = ['pengui', 'owli', 'catti', 'froggi'];
  const index = Math.abs(hash) % forms.length;
  
  return forms[index];
}

// Check if evolution should be triggered
export function shouldTriggerEvolution(blobbi: Blobbi): boolean {
  // Already evolved
  if (blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi') {
    return false;
  }

  // Check if eligible
  return blobbi.evolutionProgress.isEligibleForEvolution;
}

// Get evolution readiness message
export function getEvolutionReadinessMessage(progress: BlobbiEvolutionProgress): string {
  if (progress.isEligibleForEvolution) {
    return "Your Blobbi is ready to evolve! Keep caring for it to trigger evolution.";
  }

  const daysRemaining = EVOLUTION_REQUIREMENTS.REQUIRED_CARE_DAYS - progress.currentStreak;
  
  if (progress.currentStreak === 0) {
    return `Care for your Blobbi for ${EVOLUTION_REQUIREMENTS.REQUIRED_CARE_DAYS} consecutive days to unlock evolution.`;
  }

  if (daysRemaining === 1) {
    return "Just one more day of care until your Blobbi can evolve!";
  }

  return `${daysRemaining} more days of consistent care needed for evolution. Current streak: ${progress.currentStreak} days.`;
}

// Get care streak status
export function getCareStreakStatus(progress: BlobbiEvolutionProgress): {
  streak: number;
  isActive: boolean;
  message: string;
} {
  const hoursSinceLastCare = (Date.now() - progress.lastCareDate) / (1000 * 60 * 60);
  const isActive = hoursSinceLastCare < 24;

  let message: string;
  if (progress.currentStreak === 0) {
    message = "Start caring for your Blobbi to begin a care streak!";
  } else if (isActive) {
    message = `${progress.currentStreak} day streak! Keep it up!`;
  } else if (hoursSinceLastCare < 36) {
    message = `Care for your Blobbi soon to maintain your ${progress.currentStreak} day streak!`;
  } else {
    message = "Your care streak has ended. Start a new one!";
  }

  return {
    streak: progress.currentStreak,
    isActive,
    message,
  };
}

// Handle evolution process with proper record creation
export function processEvolution(
  blobbi: Blobbi,
  newStage: BlobbiLifeStage,
  evolutionReason?: string,
  currentTime: number = Date.now()
): {
  updatedBlobbi: Blobbi;
  evolutionRecord: import('@/types/blobbi').BlobbiRecordData;
} {
  // Determine evolution form if evolving to adult
  let evolutionForm: BlobbiEvolutionForm | undefined;
  if (newStage === 'adult' && blobbi.lifeStage !== 'adult') {
    evolutionForm = determineEvolutionForm(blobbi);
  }

  // Create updated Blobbi
  const updatedBlobbi: Blobbi = {
    ...blobbi,
    lifeStage: newStage,
    evolutionForm: evolutionForm || blobbi.evolutionForm,
    evolutionTime: currentTime,
    lastInteraction: Math.floor(currentTime / 1000),
    // Reset some stats for new stage
    stats: {
      ...blobbi.stats,
      happiness: Math.min(100, blobbi.stats.happiness + 20), // Evolution happiness boost
      energy: Math.min(100, blobbi.stats.energy + 15),
    },
    // Update breeding readiness for adults
    breedingReady: newStage === 'adult',
    // Clear egg-specific fields if no longer an egg
    ...(newStage !== 'egg' && {
      incubationTime: undefined,
      incubationProgress: undefined,
      eggTemperature: undefined,
      eggStatus: undefined,
      shellIntegrity: undefined,
    }),
  };

  // Create evolution record
  const evolutionRecord: import('@/types/blobbi').BlobbiRecordData = {
    recordType: newStage === 'child' ? 'hatched' : 'evolution',
    ...(newStage === 'child' && {
      hatchedAt: currentTime,
      hatchedBy: blobbi.ownerPubkey,
      eggType: 'standard',
      incubationTime: blobbi.incubationTime ? `${blobbi.incubationTime}s` : undefined,
    }),
    ...(newStage === 'adult' && {
      evolutionStage: evolutionForm || 'adult',
      evolutionReason: evolutionReason || 'Care requirements met',
      evolvedFrom: blobbi.id,
    }),
  };

  return {
    updatedBlobbi,
    evolutionRecord,
  };
}

// Check if egg is ready to hatch
export function checkEggHatchingReadiness(blobbi: Blobbi): {
  isReady: boolean;
  requirements: {
    daysRequired: number;
    daysPassed: number;
    carePointsRequired: number;
    carePointsEarned: number;
    healthRequirement: number;
    currentHealth: number;
    distinctCareDaysRequired: number;
    distinctCareDays: number;
  };
  message: string;
} {
  if (blobbi.lifeStage !== 'egg') {
    return {
      isReady: false,
      requirements: {
        daysRequired: 0,
        daysPassed: 0,
        carePointsRequired: 0,
        carePointsEarned: 0,
        healthRequirement: 0,
        currentHealth: 0,
        distinctCareDaysRequired: 0,
        distinctCareDays: 0,
      },
      message: 'Not an egg',
    };
  }

  const daysPassed = Math.floor((Date.now() - blobbi.birthTime) / (1000 * 60 * 60 * 24));
  const carePointsEarned = blobbi.experience; // Using experience as care points
  const distinctCareDays = blobbi.evolutionProgress.totalCareDays;

  const requirements = {
    daysRequired: 7, // Updated to 7 days as per specification
    daysPassed,
    carePointsRequired: 40, // Minimum care score of 40 as per specification
    carePointsEarned,
    healthRequirement: 50, // Keep existing health requirement
    currentHealth: blobbi.stats.health,
    distinctCareDaysRequired: 4, // Keep existing care days requirement
    distinctCareDays,
  };

  const isReady = 
    daysPassed >= requirements.daysRequired &&
    carePointsEarned >= requirements.carePointsRequired &&
    blobbi.stats.health >= requirements.healthRequirement &&
    distinctCareDays >= requirements.distinctCareDaysRequired;

  let message: string;
  if (isReady) {
    message = 'Your egg is ready to hatch! 🥚✨';
  } else {
    const missing: string[] = [];
    if (daysPassed < requirements.daysRequired) {
      missing.push(`${requirements.daysRequired - daysPassed} more days`);
    }
    if (carePointsEarned < requirements.carePointsRequired) {
      missing.push(`${requirements.carePointsRequired - carePointsEarned} more care points`);
    }
    if (blobbi.stats.health < requirements.healthRequirement) {
      missing.push(`health above ${requirements.healthRequirement}%`);
    }
    if (distinctCareDays < requirements.distinctCareDaysRequired) {
      missing.push(`${requirements.distinctCareDaysRequired - distinctCareDays} more care days`);
    }
    message = `Needs: ${missing.join(', ')}`;
  }

  return {
    isReady,
    requirements,
    message,
  };
}

// Check if child is ready to evolve to adult
export function checkChildEvolutionReadiness(blobbi: Blobbi): {
  isReady: boolean;
  requirements: {
    ageRequired: number;
    currentAge: number;
    careScoreRequired: number;
    currentCareScore: number;
    interactionsRequired: number;
    currentInteractions: number;
    happinessRequired: number;
    currentHappiness: number;
    healthRequired: number;
    currentHealth: number;
  };
  message: string;
} {
  if (blobbi.lifeStage !== 'child') {
    return {
      isReady: false,
      requirements: {
        ageRequired: 0,
        currentAge: 0,
        careScoreRequired: 0,
        currentCareScore: 0,
        interactionsRequired: 0,
        currentInteractions: 0,
        happinessRequired: 0,
        currentHappiness: 0,
        healthRequired: 0,
        currentHealth: 0,
      },
      message: 'Not a child',
    };
  }

  const ageInDays = Math.floor((Date.now() - blobbi.birthTime) / (1000 * 60 * 60 * 24));
  const currentCareScore = blobbi.experience;
  const currentInteractions = blobbi.evolutionProgress.careSessions.reduce((total, session) => total + session.actions, 0);

  const requirements = {
    ageRequired: 10, // Updated to 10 days as per specification
    currentAge: ageInDays,
    careScoreRequired: 150, // Minimum care score of 150 as per specification
    currentCareScore,
    interactionsRequired: 50, // At least 50 interaction events as per specification
    currentInteractions,
    happinessRequired: 70, // Happiness level ≥ 70% as per specification
    currentHappiness: blobbi.stats.happiness,
    healthRequired: 80, // Health level ≥ 80% as per specification
    currentHealth: blobbi.stats.health,
  };

  const isReady = 
    ageInDays >= requirements.ageRequired &&
    currentCareScore >= requirements.careScoreRequired &&
    currentInteractions >= requirements.interactionsRequired &&
    blobbi.stats.happiness >= requirements.happinessRequired &&
    blobbi.stats.health >= requirements.healthRequired;

  let message: string;
  if (isReady) {
    message = 'Your child Blobbi is ready to evolve to adult! 🌟';
  } else {
    const missing: string[] = [];
    if (ageInDays < requirements.ageRequired) {
      missing.push(`${requirements.ageRequired - ageInDays} more days`);
    }
    if (currentCareScore < requirements.careScoreRequired) {
      missing.push(`${requirements.careScoreRequired - currentCareScore} more care points`);
    }
    if (currentInteractions < requirements.interactionsRequired) {
      missing.push(`${requirements.interactionsRequired - currentInteractions} more interactions`);
    }
    if (blobbi.stats.happiness < requirements.happinessRequired) {
      missing.push(`happiness above ${requirements.happinessRequired}%`);
    }
    if (blobbi.stats.health < requirements.healthRequired) {
      missing.push(`health above ${requirements.healthRequired}%`);
    }
    message = `Needs: ${missing.join(', ')}`;
  }

  return {
    isReady,
    requirements,
    message,
  };
}