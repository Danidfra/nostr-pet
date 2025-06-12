import { describe, it, expect } from 'vitest';

// Helper function to calculate passive recovery (extracted from the hook for testing)
function calculatePassiveRecovery(sleepStartTime: number, currentTime: number = Date.now()): number {
  const timeDiff = currentTime - sleepStartTime;
  
  // Handle negative time differences (future sleep start time)
  if (timeDiff < 0) return 0;
  
  const thirtyMinutesMs = 30 * 60 * 1000; // 30 minutes in milliseconds
  
  // Calculate how many 30-minute blocks have passed
  const blocksCompleted = Math.floor(timeDiff / thirtyMinutesMs);
  
  // Each block gives +10 energy
  return Math.max(0, blocksCompleted * 10);
}

// Helper function to apply energy recovery with cap
function applyEnergyRecovery(currentEnergy: number, recoveryAmount: number): number {
  return Math.min(100, currentEnergy + recoveryAmount);
}

describe('Sleep System Logic', () => {
  describe('calculatePassiveRecovery', () => {
    it('should return 0 for sleep time less than 30 minutes', () => {
      const sleepStart = Date.now() - (25 * 60 * 1000); // 25 minutes ago
      const recovery = calculatePassiveRecovery(sleepStart);
      expect(recovery).toBe(0);
    });

    it('should return 10 for sleep time of exactly 30 minutes', () => {
      const sleepStart = Date.now() - (30 * 60 * 1000); // 30 minutes ago
      const recovery = calculatePassiveRecovery(sleepStart);
      expect(recovery).toBe(10);
    });

    it('should return 20 for sleep time of 1 hour', () => {
      const sleepStart = Date.now() - (60 * 60 * 1000); // 1 hour ago
      const recovery = calculatePassiveRecovery(sleepStart);
      expect(recovery).toBe(20);
    });

    it('should return 80 for sleep time of 4 hours (updated spec)', () => {
      const sleepStart = Date.now() - (4 * 60 * 60 * 1000); // 4 hours ago
      const recovery = calculatePassiveRecovery(sleepStart);
      expect(recovery).toBe(80);
    });

    it('should handle partial blocks correctly', () => {
      const sleepStart = Date.now() - (95 * 60 * 1000); // 95 minutes ago (3 blocks + 5 minutes)
      const recovery = calculatePassiveRecovery(sleepStart);
      expect(recovery).toBe(30); // 3 complete blocks = 30 energy
    });

    it('should work with custom current time', () => {
      const sleepStart = 1000000; // Some timestamp
      const currentTime = sleepStart + (2 * 60 * 60 * 1000); // 2 hours later
      const recovery = calculatePassiveRecovery(sleepStart, currentTime);
      expect(recovery).toBe(40); // 4 blocks of 30 minutes = 40 energy
    });
  });

  describe('applyEnergyRecovery', () => {
    it('should add recovery amount to current energy', () => {
      const result = applyEnergyRecovery(50, 10);
      expect(result).toBe(60);
    });

    it('should cap energy at 100', () => {
      const result = applyEnergyRecovery(95, 10);
      expect(result).toBe(100);
    });

    it('should handle zero recovery', () => {
      const result = applyEnergyRecovery(75, 0);
      expect(result).toBe(75);
    });

    it('should handle large recovery amounts', () => {
      const result = applyEnergyRecovery(20, 100);
      expect(result).toBe(100);
    });
  });

  describe('Sleep System Integration', () => {
    it('should calculate correct recovery for the updated spec', () => {
      // Updated spec: 4 hours of sleep should give +80 energy
      const sleepStart = Date.now() - (4 * 60 * 60 * 1000);
      const recovery = calculatePassiveRecovery(sleepStart);
      const finalEnergy = applyEnergyRecovery(30, recovery); // Starting with 30 energy
      
      expect(recovery).toBe(80);
      expect(finalEnergy).toBe(100); // Capped at 100
    });

    it('should handle overnight sleep (8 hours)', () => {
      const sleepStart = Date.now() - (8 * 60 * 60 * 1000); // 8 hours ago
      const recovery = calculatePassiveRecovery(sleepStart);
      const finalEnergy = applyEnergyRecovery(20, recovery); // Starting with 20 energy
      
      expect(recovery).toBe(160); // 16 blocks * 10 = 160 energy
      expect(finalEnergy).toBe(100); // Capped at 100
    });

    it('should handle very long sleep periods', () => {
      const sleepStart = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      const recovery = calculatePassiveRecovery(sleepStart);
      const finalEnergy = applyEnergyRecovery(0, recovery);
      
      expect(recovery).toBe(480); // 48 blocks * 10 = 480 energy
      expect(finalEnergy).toBe(100); // Still capped at 100
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative time differences gracefully', () => {
      const sleepStart = Date.now() + (30 * 60 * 1000); // 30 minutes in the future
      const recovery = calculatePassiveRecovery(sleepStart);
      expect(recovery).toBe(0);
    });

    it('should handle zero time difference', () => {
      const sleepStart = Date.now();
      const recovery = calculatePassiveRecovery(sleepStart);
      expect(recovery).toBe(0);
    });

    it('should handle very small time differences', () => {
      const sleepStart = Date.now() - 1000; // 1 second ago
      const recovery = calculatePassiveRecovery(sleepStart);
      expect(recovery).toBe(0);
    });
  });
});