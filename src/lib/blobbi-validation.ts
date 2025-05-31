import { NostrEvent } from '@nostrify/nostrify';
import { 
  Blobbi, 
  BlobbiRecordData, 
  BlobbiInteractionData,
  BlobbiLifeStage,
  BlobbiRecordType,
} from '@/types/blobbi';
import { 
  BLOBBI_EVENT_KINDS,
  validateBlobbiEvent,
  validateBlobbiId,
  parseBlobbiFromStateEvent,
  parseInteractionFromEvent,
  parseRecordFromEvent,
} from '@/lib/blobbi-events';

// Comprehensive validation results
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// Validate a complete Blobbi lifecycle event chain
export function validateBlobbiLifecycle(events: NostrEvent[]): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: [],
  };

  if (events.length === 0) {
    result.isValid = false;
    result.errors.push('No events provided for validation');
    return result;
  }

  // Group events by kind
  const stateEvents = events.filter(e => e.kind === BLOBBI_EVENT_KINDS.STATE);
  const interactionEvents = events.filter(e => e.kind === BLOBBI_EVENT_KINDS.INTERACTION);
  const recordEvents = events.filter(e => e.kind === BLOBBI_EVENT_KINDS.RECORD);
  const breedingEvents = events.filter(e => e.kind === BLOBBI_EVENT_KINDS.BREEDING);

  // Validate individual events
  for (const event of events) {
    if (!validateBlobbiEvent(event)) {
      result.errors.push(`Invalid event structure: ${event.id}`);
      result.isValid = false;
    }
  }

  // Validate lifecycle progression
  const lifecycleValidation = validateLifecycleProgression(stateEvents, recordEvents);
  result.errors.push(...lifecycleValidation.errors);
  result.warnings.push(...lifecycleValidation.warnings);
  result.suggestions.push(...lifecycleValidation.suggestions);
  
  if (lifecycleValidation.errors.length > 0) {
    result.isValid = false;
  }

  // Validate interaction consistency
  const interactionValidation = validateInteractionConsistency(interactionEvents, stateEvents);
  result.errors.push(...interactionValidation.errors);
  result.warnings.push(...interactionValidation.warnings);
  result.suggestions.push(...interactionValidation.suggestions);

  // Validate record completeness
  const recordValidation = validateRecordCompleteness(recordEvents);
  result.warnings.push(...recordValidation.warnings);
  result.suggestions.push(...recordValidation.suggestions);

  return result;
}

// Validate lifecycle progression makes sense
function validateLifecycleProgression(
  stateEvents: NostrEvent[], 
  recordEvents: NostrEvent[]
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: [],
  };

  if (stateEvents.length === 0) {
    result.errors.push('No state events found');
    return result;
  }

  // Sort events by timestamp
  const sortedStates = stateEvents.sort((a, b) => a.created_at - b.created_at);
  const sortedRecords = recordEvents.sort((a, b) => a.created_at - b.created_at);

  // Parse Blobbi states
  const blobbiStates = sortedStates.map(event => ({
    event,
    blobbi: parseBlobbiFromStateEvent(event),
    timestamp: event.created_at,
  })).filter(({ blobbi }) => blobbi !== null);

  if (blobbiStates.length === 0) {
    result.errors.push('No valid Blobbi states found');
    return result;
  }

  // Check for birth record
  const birthRecord = sortedRecords.find(event => {
    const record = parseRecordFromEvent(event);
    return record?.recordType === 'birth';
  });

  if (!birthRecord) {
    result.warnings.push('No birth record found - Blobbi lifecycle may be incomplete');
  }

  // Validate stage progression
  let previousStage: BlobbiLifeStage | null = null;
  for (const { blobbi, timestamp } of blobbiStates) {
    if (!blobbi) continue;

    if (previousStage) {
      const validTransitions: Record<BlobbiLifeStage, BlobbiLifeStage[]> = {
        egg: ['baby'],
        baby: ['adult'],
        adult: [], // Adults don't evolve further
      };

      if (blobbi.lifeStage !== previousStage && 
          !validTransitions[previousStage]?.includes(blobbi.lifeStage)) {
        result.errors.push(
          `Invalid stage transition from ${previousStage} to ${blobbi.lifeStage} at ${new Date(timestamp * 1000).toISOString()}`
        );
      }
    }

    previousStage = blobbi.lifeStage;
  }

  // Check for evolution records matching stage changes
  const evolutionRecords = sortedRecords.filter(event => {
    const record = parseRecordFromEvent(event);
    return record?.recordType === 'evolution' || record?.recordType === 'hatched';
  });

  const stageChanges = blobbiStates.filter((state, index) => {
    if (index === 0) return false;
    return state.blobbi?.lifeStage !== blobbiStates[index - 1].blobbi?.lifeStage;
  });

  if (stageChanges.length > evolutionRecords.length) {
    result.warnings.push(
      `Found ${stageChanges.length} stage changes but only ${evolutionRecords.length} evolution records`
    );
  }

  return result;
}

// Validate interaction consistency with state changes
function validateInteractionConsistency(
  interactionEvents: NostrEvent[],
  stateEvents: NostrEvent[]
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: [],
  };

  if (interactionEvents.length === 0) {
    result.suggestions.push('No interactions found - consider adding care interactions');
    return result;
  }

  // Parse interactions
  const interactions = interactionEvents.map(event => ({
    event,
    interaction: parseInteractionFromEvent(event),
    timestamp: event.created_at,
  })).filter(({ interaction }) => interaction !== null);

  // Check for reasonable interaction frequency
  if (interactions.length > 0) {
    const timeSpan = Math.max(...interactions.map(i => i.timestamp)) - 
                   Math.min(...interactions.map(i => i.timestamp));
    const avgInteractionsPerDay = interactions.length / (timeSpan / (24 * 60 * 60));

    if (avgInteractionsPerDay > 50) {
      result.warnings.push('Very high interaction frequency detected - may indicate spam');
    } else if (avgInteractionsPerDay < 0.1) {
      result.suggestions.push('Low interaction frequency - Blobbi may need more care');
    }
  }

  // Validate stat changes are reasonable
  for (const { interaction, timestamp } of interactions) {
    if (!interaction) continue;

    const [stat, change] = interaction.statChange;
    const changeValue = parseInt(change);

    if (Math.abs(changeValue) > 50) {
      result.warnings.push(
        `Large stat change detected: ${stat} ${change} at ${new Date(timestamp * 1000).toISOString()}`
      );
    }

    // Check for impossible stat combinations
    if (interaction.action === 'feed' && stat !== 'hunger' && stat !== 'happiness') {
      result.warnings.push(
        `Unusual stat change for feeding: ${stat} at ${new Date(timestamp * 1000).toISOString()}`
      );
    }
  }

  return result;
}

// Validate record completeness
function validateRecordCompleteness(recordEvents: NostrEvent[]): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: [],
  };

  const records = recordEvents.map(event => ({
    event,
    record: parseRecordFromEvent(event),
  })).filter(({ record }) => record !== null);

  const recordTypes = records.map(({ record }) => record?.recordType).filter(Boolean);
  const uniqueRecordTypes = [...new Set(recordTypes)];

  // Check for essential records
  const essentialRecords: BlobbiRecordType[] = ['birth'];
  for (const essential of essentialRecords) {
    if (!uniqueRecordTypes.includes(essential)) {
      result.warnings.push(`Missing essential record type: ${essential}`);
    }
  }

  // Suggest additional records
  if (!uniqueRecordTypes.includes('memory')) {
    result.suggestions.push('Consider adding memory records for special moments');
  }

  if (records.length < 3) {
    result.suggestions.push('Consider adding more lifecycle records for a richer history');
  }

  return result;
}

// Test event creation and parsing
export async function testEventRoundTrip(blobbi: Blobbi): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: [],
  };

  try {
    // Test state event
    const { createBlobbiStateEvent } = await import('@/lib/blobbi-events');
    const stateEventData = createBlobbiStateEvent(blobbi);
    
    // Create mock event
    const mockStateEvent: NostrEvent = {
      id: 'test-id',
      pubkey: blobbi.ownerPubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: stateEventData.kind,
      tags: stateEventData.tags,
      content: stateEventData.content,
      sig: 'test-sig',
    };

    // Test parsing
    const parsedBlobbi = parseBlobbiFromStateEvent(mockStateEvent);
    if (!parsedBlobbi) {
      result.errors.push('Failed to parse created state event');
      result.isValid = false;
    } else {
      // Compare key fields
      if (parsedBlobbi.id !== blobbi.id) {
        result.errors.push(`ID mismatch: ${parsedBlobbi.id} !== ${blobbi.id}`);
      }
      if (parsedBlobbi.lifeStage !== blobbi.lifeStage) {
        result.errors.push(`Stage mismatch: ${parsedBlobbi.lifeStage} !== ${blobbi.lifeStage}`);
      }
    }

    // Test validation
    if (!validateBlobbiEvent(mockStateEvent)) {
      result.errors.push('Created event failed validation');
      result.isValid = false;
    }

  } catch (error) {
    result.errors.push(`Error during round-trip test: ${error}`);
    result.isValid = false;
  }

  return result;
}

// Generate test data for validation
export function generateTestBlobbiEvents(blobbiId: string, ownerPubkey: string): NostrEvent[] {
  const events: NostrEvent[] = [];
  const baseTime = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60; // 7 days ago

  // Birth record
  events.push({
    id: `birth-${blobbiId}`,
    pubkey: ownerPubkey,
    created_at: baseTime,
    kind: BLOBBI_EVENT_KINDS.RECORD,
    tags: [
      ['blobbi_id', blobbiId],
      ['record_type', 'birth'],
      ['generation', '1'],
      ['origin', 'wild'],
      ['rarity', 'common'],
    ],
    content: 'A new Blobbi was born!',
    sig: 'test-sig',
  });

  // Initial state (egg)
  events.push({
    id: `state-egg-${blobbiId}`,
    pubkey: ownerPubkey,
    created_at: baseTime + 60,
    kind: BLOBBI_EVENT_KINDS.STATE,
    tags: [
      ['d', blobbiId],
      ['stage', 'egg'],
      ['breeding_ready', 'false'],
      ['generation', '1'],
      ['hunger', '0'],
      ['happiness', '0'],
      ['health', '100'],
      ['hygiene', '0'],
      ['energy', '0'],
      ['experience', '0'],
      ['care_streak', '0'],
    ],
    content: 'Blobbi is in egg stage',
    sig: 'test-sig',
  });

  // Some care interactions
  for (let i = 0; i < 5; i++) {
    events.push({
      id: `interaction-${i}-${blobbiId}`,
      pubkey: ownerPubkey,
      created_at: baseTime + 3600 * (i + 1),
      kind: BLOBBI_EVENT_KINDS.INTERACTION,
      tags: [
        ['blobbi_id', blobbiId],
        ['action', 'warming'],
        ['action_category', 'care'],
        ['stat_change', 'health:+5'],
        ['care_points', '2'],
      ],
      content: 'Warming the egg',
      sig: 'test-sig',
    });
  }

  return events;
}

// Performance testing for event processing
export function benchmarkEventProcessing(events: NostrEvent[]): {
  validationTime: number;
  parsingTime: number;
  totalEvents: number;
  validEvents: number;
} {
  const start = performance.now();
  
  let validEvents = 0;
  for (const event of events) {
    if (validateBlobbiEvent(event)) {
      validEvents++;
    }
  }
  
  const validationTime = performance.now() - start;
  const parseStart = performance.now();
  
  for (const event of events) {
    switch (event.kind) {
      case BLOBBI_EVENT_KINDS.STATE:
        parseBlobbiFromStateEvent(event);
        break;
      case BLOBBI_EVENT_KINDS.INTERACTION:
        parseInteractionFromEvent(event);
        break;
      case BLOBBI_EVENT_KINDS.RECORD:
        parseRecordFromEvent(event);
        break;
    }
  }
  
  const parsingTime = performance.now() - parseStart;
  
  return {
    validationTime,
    parsingTime,
    totalEvents: events.length,
    validEvents,
  };
}