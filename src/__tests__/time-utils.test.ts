import { describe, it, expect } from 'vitest';
import { toSecondsTimestamp, toMillisecondsTimestamp, nowInSeconds, parseTimestampTag } from '@/lib/nostr/time';
import { calculateStatDegradation } from '@/lib/blobbi-events';

describe('Time Utilities', () => {
  describe('toSecondsTimestamp', () => {
    it('should return current time in seconds when value is undefined', () => {
      const result = toSecondsTimestamp();
      const expected = Math.floor(Date.now() / 1000);
      
      // Allow 1 second tolerance for test execution time
      expect(Math.abs(result - expected)).toBeLessThanOrEqual(1);
    });

    it('should keep seconds as seconds', () => {
      const seconds = 1700000000; // ~Nov 2023 in seconds
      expect(toSecondsTimestamp(seconds)).toBe(seconds);
    });

    it('should convert milliseconds to seconds', () => {
      const milliseconds = 1700000000000; // ~Nov 2023 in milliseconds
      const expectedSeconds = 1700000000;
      expect(toSecondsTimestamp(milliseconds)).toBe(expectedSeconds);
    });

    it('should handle edge case around threshold', () => {
      const justBelowThreshold = 1e12 - 1; // Just below threshold (seconds)
      const justAboveThreshold = 1e12 + 1; // Just above threshold (milliseconds)
      
      expect(toSecondsTimestamp(justBelowThreshold)).toBe(Math.floor(justBelowThreshold));
      expect(toSecondsTimestamp(justAboveThreshold)).toBe(Math.floor(justAboveThreshold / 1000));
    });

    it('should floor fractional values', () => {
      const fractional = 1700000000.789;
      expect(toSecondsTimestamp(fractional)).toBe(1700000000);
    });
  });

  describe('toMillisecondsTimestamp', () => {
    it('should convert seconds to milliseconds', () => {
      const seconds = 1700000000;
      const expectedMs = 1700000000000;
      expect(toMillisecondsTimestamp(seconds)).toBe(expectedMs);
    });

    it('should handle zero', () => {
      expect(toMillisecondsTimestamp(0)).toBe(0);
    });
  });

  describe('nowInSeconds', () => {
    it('should return current time in seconds', () => {
      const result = nowInSeconds();
      const expected = Math.floor(Date.now() / 1000);
      
      // Allow 1 second tolerance
      expect(Math.abs(result - expected)).toBeLessThanOrEqual(1);
    });
  });

  describe('parse->create roundtrip stability', () => {
    it('should keep seconds stable in roundtrip', () => {
      const originalSeconds = 1700000000;
      
      // Simulate: seconds -> tag -> parse -> create -> tag
      const afterToSeconds = toSecondsTimestamp(originalSeconds);
      const afterToMs = toMillisecondsTimestamp(afterToSeconds);
      const afterBackToSeconds = toSecondsTimestamp(afterToMs);
      
      expect(afterToSeconds).toBe(originalSeconds);
      expect(afterBackToSeconds).toBe(originalSeconds);
    });

    it('should not double-divide milliseconds', () => {
      const milliseconds = 1700000000000;
      
      // First conversion: ms -> seconds
      const seconds = toSecondsTimestamp(milliseconds);
      expect(seconds).toBe(1700000000);
      
      // Second conversion: should recognize it's already seconds
      const shouldBeSame = toSecondsTimestamp(seconds);
      expect(shouldBeSame).toBe(seconds);
      expect(shouldBeSame).not.toBe(Math.floor(seconds / 1000)); // Would be wrong
    });
    
    it('should preserve seconds in tag write->parse->write cycle', () => {
      const originalSeconds = 1700000000;
      
      // Simulate: model (seconds) -> tag (string seconds) -> parse (seconds) -> tag (string seconds)
      const tagValue = toSecondsTimestamp(originalSeconds).toString();
      expect(tagValue).toBe('1700000000');
      
      const parsedSeconds = parseInt(tagValue, 10);
      expect(parsedSeconds).toBe(originalSeconds);
      
      const tagValue2 = toSecondsTimestamp(parsedSeconds).toString();
      expect(tagValue2).toBe(tagValue);
    });
  });

  describe('parseTimestampTag', () => {
    it('should parse numeric seconds format', () => {
      const result = parseTimestampTag('1700000000');
      expect(result).toBe(1700000000000); // Returns milliseconds
    });

    it('should parse ISO string format (legacy)', () => {
      const isoString = '2023-11-14T22:13:20.000Z';
      const result = parseTimestampTag(isoString);
      const expected = new Date(isoString).getTime();
      expect(result).toBe(expected);
    });

    it('should return undefined for invalid input', () => {
      expect(parseTimestampTag(undefined)).toBeUndefined();
      expect(parseTimestampTag('')).toBeUndefined();
      expect(parseTimestampTag('invalid')).toBeUndefined();
    });
  });

  describe('calculateStatDegradation', () => {
    it('should return positive loss amounts (to be subtracted)', () => {
      const oneHourAgo = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago in seconds
      const degradation = calculateStatDegradation(oneHourAgo, Date.now());
      
      // All degradation values should be positive (amounts to subtract)
      expect(degradation.hunger).toBeGreaterThan(0);
      expect(degradation.happiness).toBeGreaterThan(0);
      expect(degradation.hygiene).toBeGreaterThan(0);
      expect(degradation.energy).toBeGreaterThan(0);
    });

    it('should return 0 degradation for current time', () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const degradation = calculateStatDegradation(nowSeconds, Date.now());
      
      expect(degradation.hunger).toBe(0);
      expect(degradation.happiness).toBe(0);
      expect(degradation.hygiene).toBe(0);
      expect(degradation.energy).toBe(0);
    });

    it('should accept seconds for lastInteraction', () => {
      const seconds = 1700000000; // Nov 2023
      const currentMs = 1700003600000; // 1 hour later
      const degradation = calculateStatDegradation(seconds, currentMs);
      
      // Should calculate based on 1 hour difference
      expect(degradation.hunger).toBeCloseTo(5, 1); // 5 per hour
      expect(degradation.happiness).toBeCloseTo(3, 1); // 3 per hour
    });
  });
});
