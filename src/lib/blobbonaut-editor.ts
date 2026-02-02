import { NostrEvent } from '@nostrify/nostrify';
import { BlobbonautProfile, BlobbonautStorageItem } from '@/types/blobbi';

// ============================================================================
// TYPES FOR BLOBBONAUT PROFILE EDITOR (kind 31125)
// ============================================================================

export interface BlobbonautPatch {
  name?: string;
  onboarding_done?: boolean;
  coins?: number;
  pettingLevel?: number;
  lifetimeBlobbis?: number;
  mission_daily_checkin_claimed_at?: number;
  has?: string[]; // Set of owned Blobbi IDs
  storage?: BlobbonautStorageItem[]; // Array of storage items
}

export interface MergedBlobbonaut {
  id: string;
  name: string;
  onboarding_done: boolean;
  coins: number;
  pettingLevel: number;
  lifetimeBlobbis: number;
  mission_daily_checkin_claimed_at?: number;
  has: string[];
  storage: BlobbonautStorageItem[];
  // Preserve other tags that we might not edit
  rawTags: string[][];
}

// ============================================================================
// PARSING FUNCTIONS
// ============================================================================

/**
 * Parse a kind 31125 event into a MergedBlobbonaut object
 */
export function parseBlobbonautFromEvent(event: NostrEvent): MergedBlobbonaut | null {
  if (event.kind !== 31125) return null;

  const tags = event.tags;
  const getTag = (name: string): string | undefined => {
    const tag = tags.find(t => t[0] === name);
    return tag?.[1];
  };

  const getMultiTags = (name: string): string[] => {
    return tags.filter(t => t[0] === name).map(t => t[1]).filter(Boolean);
  };

  const id = getTag('d');
  if (!id) return null;

  const name = getTag('name') || '';
  const onboarding_done = getTag('onboarding_done') === 'true';
  const coins = parseInt(getTag('coins') || '0');
  const pettingLevel = parseInt(getTag('pettingLevel') || '0');
  const lifetimeBlobbis = parseInt(getTag('lifetimeBlobbis') || '0');
  const mission_daily_checkin_claimed_at = getTag('mission_daily_checkin_claimed_at') 
    ? parseInt(getTag('mission_daily_checkin_claimed_at')!) 
    : undefined;

  // Parse "has" tags
  const has = getMultiTags('has');

  // Parse "storage" tags (format: "item:qty")
  const storage: BlobbonautStorageItem[] = getMultiTags('storage').map(s => {
    const [itemId, qtyStr] = s.split(':');
    return {
      itemId: itemId || '',
      quantity: parseInt(qtyStr || '0'),
    };
  }).filter(item => item.itemId && item.quantity > 0);

  return {
    id,
    name,
    onboarding_done,
    coins,
    pettingLevel,
    lifetimeBlobbis,
    mission_daily_checkin_claimed_at,
    has,
    storage,
    rawTags: tags,
  };
}

// ============================================================================
// TAG GENERATION FOR KIND 31125
// ============================================================================

/**
 * Generate updated tags for kind 31125 from merged Blobbonaut data.
 * 
 * CRITICAL SAFETY:
 * - Starts from ALL original tags
 * - Updates single-value tags by replacing first match
 * - Removes and re-adds multi-value tags (has, storage)
 * - Preserves unknown tags
 * - Never loses required identity tags (d, b)
 */
export function generateUpdatedTags31125(
  originalEvent: NostrEvent,
  merged: MergedBlobbonaut
): string[][] {
  // Start with all original tags
  let tags: string[][] = [...originalEvent.tags];

  // Helper to update or add a single-value tag
  const setTag = (tagName: string, value: string | number | boolean | undefined) => {
    if (value === undefined || value === null || value === '') return;

    const strValue = String(value);
    const existingIndex = tags.findIndex(t => t[0] === tagName);

    if (existingIndex >= 0) {
      tags[existingIndex] = [tagName, strValue];
    } else {
      tags.push([tagName, strValue]);
    }
  };

  // Helper to remove all tags with a given name
  const removeTags = (tagName: string) => {
    tags = tags.filter(t => t[0] !== tagName);
  };

  // Update single-value tags
  setTag('d', merged.id);
  setTag('name', merged.name);
  setTag('onboarding_done', merged.onboarding_done ? 'true' : 'false');
  setTag('coins', merged.coins);
  setTag('pettingLevel', merged.pettingLevel);
  setTag('lifetimeBlobbis', merged.lifetimeBlobbis);
  
  if (merged.mission_daily_checkin_claimed_at !== undefined) {
    setTag('mission_daily_checkin_claimed_at', merged.mission_daily_checkin_claimed_at);
  }

  // Update multi-value tags: "has"
  removeTags('has');
  merged.has.forEach(blobbiId => {
    if (blobbiId && blobbiId.trim()) {
      tags.push(['has', blobbiId.trim()]);
    }
  });

  // Update multi-value tags: "storage"
  removeTags('storage');
  merged.storage.forEach(item => {
    if (item.itemId && item.quantity > 0) {
      tags.push(['storage', `${item.itemId}:${item.quantity}`]);
    }
  });

  // Ensure "b" tag exists (ecosystem marker)
  const hasBTag = tags.some(t => t[0] === 'b');
  if (!hasBTag) {
    tags.push(['b', 'blobbi:ecosystem:v1']);
  }

  return tags;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate a storage entry string (must be "item:qty" format)
 */
export function validateStorageEntry(entry: string): { valid: boolean; error?: string } {
  if (!entry || !entry.includes(':')) {
    return { valid: false, error: 'Storage entry must include ":" separator' };
  }

  const [itemId, qtyStr] = entry.split(':');
  
  if (!itemId || !itemId.trim()) {
    return { valid: false, error: 'Item ID cannot be empty' };
  }

  const qty = parseInt(qtyStr);
  if (isNaN(qty) || qty < 0) {
    return { valid: false, error: 'Quantity must be a non-negative integer' };
  }

  return { valid: true };
}

/**
 * Parse a storage entry string into a BlobbonautStorageItem
 */
export function parseStorageEntry(entry: string): BlobbonautStorageItem | null {
  const validation = validateStorageEntry(entry);
  if (!validation.valid) return null;

  const [itemId, qtyStr] = entry.split(':');
  return {
    itemId: itemId.trim(),
    quantity: parseInt(qtyStr),
  };
}
