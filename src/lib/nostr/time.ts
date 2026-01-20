/**
 * Time conversion utilities for Nostr events
 * 
 * CONVENTION:
 * - Nostr events use SECONDS (Unix timestamps)
 * - JavaScript Date/UI uses MILLISECONDS
 */

const MILLISECONDS_THRESHOLD = 1e12; // ~Sep 2001 in seconds, ~Sep 2001 in ms is way beyond this

/**
 * Converts a timestamp to seconds (Nostr standard).
 * Auto-detects if value is in milliseconds and converts.
 * 
 * @param value - Timestamp in seconds or milliseconds, or undefined
 * @returns Timestamp in seconds, or current time in seconds if undefined
 */
export function toSecondsTimestamp(value?: number): number {
  if (value === undefined) {
    return Math.floor(Date.now() / 1000);
  }
  
  // If value looks like milliseconds (> threshold), convert to seconds
  if (value > MILLISECONDS_THRESHOLD) {
    if (import.meta.env.DEV) {
      console.warn(
        `[Timestamp] Converting milliseconds (${value}) to seconds (${Math.floor(value / 1000)}). ` +
        `Consider storing timestamps in seconds internally.`
      );
    }
    return Math.floor(value / 1000);
  }
  
  // Already in seconds
  return Math.floor(value);
}

/**
 * Converts seconds (Nostr standard) to milliseconds (JavaScript Date standard).
 * 
 * @param seconds - Timestamp in seconds
 * @returns Timestamp in milliseconds
 */
export function toMillisecondsTimestamp(seconds: number): number {
  return seconds * 1000;
}

/**
 * Gets current time in seconds (Nostr standard).
 * 
 * @returns Current Unix timestamp in seconds
 */
export function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Parses a timestamp from a tag value that may be:
 * - Numeric seconds (new format): "1700000000"
 * - ISO string (legacy format): "2023-11-14T22:13:20.000Z"
 * 
 * Returns MILLISECONDS for UI compatibility.
 * 
 * @param value - Tag value (numeric seconds or ISO string)
 * @returns Timestamp in MILLISECONDS, or undefined if invalid
 */
export function parseTimestampTag(value: string | undefined): number | undefined {
  if (!value) return undefined;
  
  // Check if value is purely numeric (new format: seconds)
  if (/^\d+$/.test(value)) {
    const numericValue = parseInt(value, 10);
    if (!isNaN(numericValue)) {
      // Valid numeric seconds, convert to milliseconds
      return toMillisecondsTimestamp(numericValue);
    }
  }
  
  // Fallback: try parsing as ISO string (legacy format)
  try {
    const parsed = new Date(value).getTime();
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  } catch {
    // Ignore parse errors
  }
  
  return undefined;
}
