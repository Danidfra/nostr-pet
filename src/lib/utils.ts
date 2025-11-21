import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { BlobbiAction } from "@/types/blobbi"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the display label for a Blobbi action
 */
export function getActionDisplayName(action: BlobbiAction): string {
  const actionLabels: Record<BlobbiAction, string> = {
    feed: 'Feed',
    play: 'Play',
    clean: 'Clean',
    rest: 'Rest',
    warm: 'Warm',
    check: 'Check',
    sing: 'Sing',
    talk: 'Talk',
    medicine: 'Medicine',
    cruzar: 'Breed',
  };

  return actionLabels[action] || action;
}

