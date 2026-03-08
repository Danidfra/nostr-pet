/**
 * Blobbi SVG Resolver
 *
 * This module provides utilities for resolving Blobbi SVGs from local assets
 * instead of fetching from GitHub URLs.
 */

import { Blobbi } from '@/types/blobbi';
import { getBabyBaseSvg, getBabySleepingSvg } from '@/blobbi/baby-blobbi';

// Adult stage SVG imports - dynamically resolve all forms
const ADULT_FORMS = [
  'bloomi', 'breezy', 'cacti', 'catti', 'cloudi', 'crysti', 
  'droppi', 'flammi', 'froggi', 'leafy', 'mushie', 'owli', 
  'pandi', 'rocky', 'rosey', 'starri'
];

// Cache for dynamically imported adult SVGs
const adultSvgCache = new Map<string, string>();

/**
 * Resolve Blobbi SVG content from local assets
 */
export async function resolveBlobbiSvg(blobbi: Blobbi, isSleeping: boolean = false): Promise<string> {
  try {
    if (blobbi.lifeStage === 'baby') {
      // Return baby SVG directly (already imported)
      return isSleeping ? getBabySleepingSvg() : getBabyBaseSvg();
    }
    
    if (blobbi.lifeStage === 'adult' && blobbi.evolutionForm) {
      // Return adult SVG based on evolution form
      return await getAdultSvg(blobbi.evolutionForm, isSleeping);
    }
    
    // Fallback to baby base
    return getBabyBaseSvg();
  } catch (error) {
    console.error('Error resolving Blobbi SVG:', error);
    // Return fallback SVG
    return getFallbackSvg();
  }
}

// Baby SVG getters are now imported from the baby-blobbi module

/**
 * Get adult SVG content by form
 */
async function getAdultSvg(form: string, isSleeping: boolean = false): Promise<string> {
  const normalizedForm = form.toLowerCase();
  const suffix = isSleeping ? '-sleeping' : '-base';
  const cacheKey = `${normalizedForm}${suffix}`;
  
  // Check cache first
  if (adultSvgCache.has(cacheKey)) {
    return adultSvgCache.get(cacheKey)!;
  }
  
  try {
    // Dynamically import SVG
    const svgImport = import.meta.glob(
      '/src/assets/adult-stage/**/*.svg',
      { query: '?raw', import: 'default', eager: true }
    );
    
    // Find matching SVG
    const targetPattern = `${normalizedForm}${suffix}.svg`;
    let svgContent: string | null = null;

    for (const [path, content] of Object.entries(svgImport)) {
      if (path.includes(targetPattern) && typeof content === 'string') {
        svgContent = content;
        break;
      }
    }

    if (svgContent) {
      adultSvgCache.set(cacheKey, svgContent);
      return svgContent;
    }
    
    // If specific form not found, try fallback to baby
    console.warn(`Adult SVG not found for form: ${normalizedForm}${suffix}, falling back to baby`);
    return isSleeping ? getBabySleepingSvg() : getBabyBaseSvg();
  } catch (error) {
    console.error(`Error loading adult SVG for ${normalizedForm}${suffix}:`, error);
    return isSleeping ? getBabySleepingSvg() : getBabyBaseSvg();
  }
}

/**
 * Get fallback SVG content
 */
function getFallbackSvg(): string {
  return `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="40" fill="#7C3AED"/>
      <circle cx="35" cy="40" r="5" fill="#000"/>
      <circle cx="65" cy="40" r="5" fill="#000"/>
      <path d="M 30 60 Q 50 70 70 60" stroke="#000" stroke-width="3" fill="none"/>
    </svg>
  `;
}

/**
 * Preload SVGs for a Blobbi to ensure quick switching
 */
export async function preloadBlobbiSvgs(blobbi: Blobbi): Promise<void> {
  try {
    if (blobbi.lifeStage === 'baby') {
      // Baby SVGs are preloaded eagerly in the baby-blobbi module
      // No action needed
    } else if (blobbi.lifeStage === 'adult' && blobbi.evolutionForm) {
      // Preload both awake and sleeping adult SVGs
      await Promise.all([
        getAdultSvg(blobbi.evolutionForm, false),
        getAdultSvg(blobbi.evolutionForm, true)
      ]);
    }
  } catch (error) {
    console.warn('Error preloading Blobbi SVGs:', error);
  }
}

/**
 * Check if an SVG exists for a given form
 */
export function hasAdultSvg(form: string): boolean {
  return ADULT_FORMS.includes(form.toLowerCase());
}

/**
 * Get all available adult forms
 */
export function getAvailableAdultForms(): string[] {
  return [...ADULT_FORMS];
}