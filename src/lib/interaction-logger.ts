/**
 * Interaction Logger System
 * 
 * Provides comprehensive console logging for all Blobbi interactions
 * to verify cooldown system functionality and track user actions.
 */

import { BlobbiAction, BlobbiLifeStage } from '@/types/blobbi';

export interface InteractionLogData {
  actionName: BlobbiAction;
  blobbiId: string;
  currentStage: BlobbiLifeStage;
  timestamp: number;
  interactionType: 'triggered' | 'blocked_cooldown' | 'blocked_unavailable' | 'blocked_error';
  cooldownRemaining?: number;
  errorMessage?: string;
  statChanges?: Record<string, number>;
  experienceGained?: number;
  itemUsed?: string;
  previousStats?: Record<string, number>;
  newStats?: Record<string, number>;
}

/**
 * Formats timestamp for readable console output
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const baseFormat = date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  
  // Add milliseconds manually for better compatibility
  const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
  return `${baseFormat}.${milliseconds}`;
}

/**
 * Formats cooldown time for console output
 */
function formatCooldownTime(milliseconds: number): string {
  if (milliseconds <= 0) return '0s';
  
  const seconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  
  return `${seconds}s`;
}

/**
 * Creates a styled console group for interaction logging
 */
function createLogGroup(data: InteractionLogData): void {
  const { actionName, blobbiId, currentStage, timestamp, interactionType } = data;
  
  // Choose colors and symbols based on interaction type
  const styles = {
    triggered: {
      color: '#22c55e', // green
      symbol: '✅',
      bgColor: '#dcfce7',
      textColor: '#166534'
    },
    blocked_cooldown: {
      color: '#f59e0b', // amber
      symbol: '⏱️',
      bgColor: '#fef3c7',
      textColor: '#92400e'
    },
    blocked_unavailable: {
      color: '#6b7280', // gray
      symbol: '🚫',
      bgColor: '#f3f4f6',
      textColor: '#374151'
    },
    blocked_error: {
      color: '#ef4444', // red
      symbol: '❌',
      bgColor: '#fee2e2',
      textColor: '#991b1b'
    }
  };

  const style = styles[interactionType];
  const formattedTime = formatTimestamp(timestamp);
  
  // Create main log group
  console.groupCollapsed(
    `%c${style.symbol} BLOBBI INTERACTION %c${actionName.toUpperCase()}%c ${interactionType.toUpperCase()}`,
    `color: ${style.color}; font-weight: bold; font-size: 12px;`,
    `background: ${style.bgColor}; color: ${style.textColor}; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin: 0 4px;`,
    `color: ${style.color}; font-weight: bold;`
  );
}

/**
 * Logs detailed interaction information
 */
function logInteractionDetails(data: InteractionLogData): void {
  const { 
    actionName, 
    blobbiId, 
    currentStage, 
    timestamp, 
    interactionType,
    cooldownRemaining,
    errorMessage,
    statChanges,
    experienceGained,
    itemUsed,
    previousStats,
    newStats
  } = data;

  // Basic information
  console.log(`🎯 Action: ${actionName}`);
  console.log(`🔮 Blobbi ID: ${blobbiId}`);
  console.log(`📊 Current Stage: ${currentStage}`);
  console.log(`⏰ Timestamp: ${formatTimestamp(timestamp)}`);
  console.log(`📝 Type: ${interactionType}`);

  // Cooldown information
  if (cooldownRemaining !== undefined) {
    if (cooldownRemaining > 0) {
      console.log(`⏳ Cooldown Remaining: ${formatCooldownTime(cooldownRemaining)}`);
    } else {
      console.log(`✅ No Cooldown Active`);
    }
  }

  // Error information
  if (errorMessage) {
    console.log(`❌ Error: ${errorMessage}`);
  }

  // Item usage
  if (itemUsed) {
    console.log(`🎒 Item Used: ${itemUsed}`);
  }

  // Experience gained
  if (experienceGained) {
    console.log(`⭐ Experience Gained: +${experienceGained} XP`);
  }

  // Stat changes
  if (statChanges && Object.keys(statChanges).length > 0) {
    console.log(`📈 Stat Changes:`);
    for (const [stat, change] of Object.entries(statChanges)) {
      const sign = change >= 0 ? '+' : '';
      console.log(`   ${stat}: ${sign}${change}`);
    }
  }

  // Before/after stats comparison
  if (previousStats && newStats) {
    console.log(`📊 Stats Comparison:`);
    console.table({
      'Previous': previousStats,
      'New': newStats,
      'Change': Object.keys(previousStats).reduce((changes, stat) => {
        changes[stat] = (newStats[stat] || 0) - (previousStats[stat] || 0);
        return changes;
      }, {} as Record<string, number>)
    });
  }
}

/**
 * Main logging function for all interactions
 */
export function logInteraction(data: InteractionLogData): void {
  // Always log to console regardless of environment
  createLogGroup(data);
  logInteractionDetails(data);
  
  // Add a separator for better readability
  console.log(`${'─'.repeat(50)}`);
  
  // End the group
  console.groupEnd();
  
  // Also log a simple one-liner for quick scanning
  const { actionName, blobbiId, currentStage, timestamp, interactionType, cooldownRemaining } = data;
  const timeStr = formatTimestamp(timestamp);
  const cooldownStr = cooldownRemaining ? ` (cooldown: ${formatCooldownTime(cooldownRemaining)})` : '';
  
  console.log(
    `🎮 ${timeStr} | ${actionName} | ${blobbiId} | ${currentStage} | ${interactionType}${cooldownStr}`
  );
}

/**
 * Logs when an interaction is triggered successfully
 */
export function logInteractionTriggered(
  actionName: BlobbiAction,
  blobbiId: string,
  currentStage: BlobbiLifeStage,
  options: {
    statChanges?: Record<string, number>;
    experienceGained?: number;
    itemUsed?: string;
    previousStats?: Record<string, number>;
    newStats?: Record<string, number>;
  } = {}
): void {
  logInteraction({
    actionName,
    blobbiId,
    currentStage,
    timestamp: Date.now(),
    interactionType: 'triggered',
    ...options
  });
}

/**
 * Logs when an interaction is blocked by cooldown
 */
export function logInteractionBlockedByCooldown(
  actionName: BlobbiAction,
  blobbiId: string,
  currentStage: BlobbiLifeStage,
  cooldownRemaining: number
): void {
  logInteraction({
    actionName,
    blobbiId,
    currentStage,
    timestamp: Date.now(),
    interactionType: 'blocked_cooldown',
    cooldownRemaining
  });
}

/**
 * Logs when an interaction is blocked because it's unavailable for the current stage
 */
export function logInteractionBlockedUnavailable(
  actionName: BlobbiAction,
  blobbiId: string,
  currentStage: BlobbiLifeStage
): void {
  logInteraction({
    actionName,
    blobbiId,
    currentStage,
    timestamp: Date.now(),
    interactionType: 'blocked_unavailable'
  });
}

/**
 * Logs when an interaction fails due to an error
 */
export function logInteractionError(
  actionName: BlobbiAction,
  blobbiId: string,
  currentStage: BlobbiLifeStage,
  errorMessage: string
): void {
  logInteraction({
    actionName,
    blobbiId,
    currentStage,
    timestamp: Date.now(),
    interactionType: 'blocked_error',
    errorMessage
  });
}

/**
 * Logs cooldown system initialization
 */
export function logCooldownSystemInit(blobbiId: string): void {
  console.group(`🔧 COOLDOWN SYSTEM INITIALIZED`);
  console.log(`🔮 Blobbi ID: ${blobbiId}`);
  console.log(`⏰ Timestamp: ${formatTimestamp(Date.now())}`);
  console.log(`📝 System: Ready to track interactions and cooldowns`);
  console.groupEnd();
}

/**
 * Logs cooldown system sync events
 */
export function logCooldownSync(blobbiId: string, syncedActions: string[], source: 'relay' | 'local'): void {
  console.group(`🔄 COOLDOWN SYNC`);
  console.log(`🔮 Blobbi ID: ${blobbiId}`);
  console.log(`⏰ Timestamp: ${formatTimestamp(Date.now())}`);
  console.log(`📡 Source: ${source}`);
  console.log(`🎯 Synced Actions: ${syncedActions.join(', ') || 'none'}`);
  console.groupEnd();
}

/**
 * Utility to enable/disable verbose logging
 */
export class InteractionLogger {
  private static verboseMode = true;
  
  static setVerbose(enabled: boolean): void {
    InteractionLogger.verboseMode = enabled;
    console.log(`🔧 Interaction logging ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }
  
  static isVerbose(): boolean {
    return InteractionLogger.verboseMode;
  }
}

// Export the logger instance for global access
export const interactionLogger = InteractionLogger;