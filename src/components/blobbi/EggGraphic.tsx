/**
 * EggGraphic Component
 *
 * This file re-exports from the egg module for backwards compatibility.
 * The actual implementation is now in src/egg/components/EggGraphic.tsx
 */

export { EggGraphic } from '@/egg';

// Also export the EggVisualBlobbi type for consumers that need it
export type { EggVisualBlobbi } from '@/egg';
