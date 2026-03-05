/**
 * Utility for merging Tailwind CSS classes
 * Uses clsx for conditional class names and tailwind-merge to handle conflicts
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
