/**
 * EggGraphic Component
 *
 * This file re-exports from the blobbi-egg module for backwards compatibility.
 * The actual implementation is now in src/blobbi-egg/components/EggGraphic.tsx
 */

export { EggGraphic } from '@/blobbi-egg';

// Also export the EggVisualBlobbi type for consumers that need it
export type { EggVisualBlobbi } from '@/blobbi-egg';
