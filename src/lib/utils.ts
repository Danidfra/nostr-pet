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

/**
 * Enhanced scrolling function with support for alignment, offset, and safe-area insets
 */
export function scrollToElementWithAlignment(
  element: HTMLElement,
  options: {
    align?: "start" | "center" | "end" | "nearest";
    offset?: number;
    behavior?: ScrollBehavior;
  } = {}
): void {
  const {
    align = "center",
    offset = 0,
    behavior = "smooth"
  } = options;

  // Get the element's bounding rectangle
  const rect = element.getBoundingClientRect();

  // Calculate the target scroll position
  let targetScrollTop: number;

  // Get safe area inset top if available (for mobile devices with notches)
  const safeAreaInsetTop = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)') || '0'
  );

  // Get viewport height
  const viewportHeight = window.innerHeight;

  switch (align) {
    case "start":
      // Position element at the top of viewport, accounting for safe area and offset
      targetScrollTop = window.pageYOffset + rect.top - safeAreaInsetTop - offset;
      break;
    case "end":
      // Position element at the bottom of viewport
      targetScrollTop = window.pageYOffset + rect.bottom - viewportHeight + offset;
      break;
    case "nearest":
      // Determine if element is closer to top or bottom of viewport
      const distanceFromTop = rect.top;
      const distanceFromBottom = viewportHeight - rect.bottom;
      targetScrollTop = distanceFromTop <= distanceFromBottom
        ? window.pageYOffset + rect.top - safeAreaInsetTop - offset
        : window.pageYOffset + rect.bottom - viewportHeight + offset;
      break;
    case "center":
    default:
      // Position element at the center of viewport
      targetScrollTop = window.pageYOffset + rect.top - (viewportHeight - rect.height) / 2 - offset;
      break;
  }

  // Use scrollTo for more precise control over the scroll position
  window.scrollTo({
    top: targetScrollTop,
    behavior
  });
}
