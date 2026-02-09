// Utility function to wait for an element to become visible
export const waitForVisible = (selector: string, opts: { timeout?: number } = {}): Promise<void> => {
  const { timeout = 2000 } = opts;

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkElement = () => {
      const element = document.querySelector(selector);
      if (element) {
        const rect = element.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(element);
        
        // Check if element is actually visible
        const isVisible =
          rect.width > 0 &&
          rect.height > 0 &&
          computedStyle.display !== 'none' &&
          computedStyle.visibility !== 'hidden' &&
          parseFloat(computedStyle.opacity) > 0.01;

        if (isVisible) {
          resolve();
          return;
        }
      }

      // Check timeout
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Element ${selector} not visible within ${timeout}ms`));
        return;
      }

      // Continue checking
      requestAnimationFrame(checkElement);
    };

    // Start checking
    checkElement();
  });
};

/**
 * Utility function to wait for an element to become hidden/removed.
 * 
 * Useful for waiting for modals to close before advancing tour steps.
 * Checks if element is removed from DOM or hidden via display/visibility/opacity.
 * 
 * @param selector - CSS selector for the element
 * @param opts - Options including timeout (default: 3000ms)
 * @returns Promise that resolves when element is hidden or removed
 */
export const waitForHidden = (selector: string, opts: { timeout?: number } = {}): Promise<void> => {
  const { timeout = 3000 } = opts;

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkElement = () => {
      const element = document.querySelector(selector);
      
      // If element doesn't exist in DOM, it's hidden
      if (!element) {
        resolve();
        return;
      }

      // Check if element is hidden via CSS
      const rect = element.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(element);
      
      const isHidden =
        rect.width === 0 ||
        rect.height === 0 ||
        computedStyle.display === 'none' ||
        computedStyle.visibility === 'hidden' ||
        parseFloat(computedStyle.opacity) < 0.01 ||
        (element as HTMLElement).offsetParent === null; // Not rendered (display:none or hidden ancestor)

      if (isHidden) {
        resolve();
        return;
      }

      // Check timeout
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Element ${selector} still visible after ${timeout}ms`));
        return;
      }

      // Continue checking
      requestAnimationFrame(checkElement);
    };

    // Start checking
    checkElement();
  });
};

/**
 * Wait for layout to stabilize after DOM changes.
 * This helps prevent incorrect positioning when tabs/layouts change.
 * Waits for at least two animation frames to ensure layout has settled.
 */
export const waitForLayoutStability = (): Promise<void> => {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
};

// Utility function to sleep
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

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
    case "start": {
      // Position element at the top of viewport, accounting for safe area and offset
      targetScrollTop = window.pageYOffset + rect.top - safeAreaInsetTop - offset;
      break;
    }
    case "end": {
      // Position element at the bottom of viewport
      targetScrollTop = window.pageYOffset + rect.bottom - viewportHeight + offset;
      break;
    }
    case "nearest": {
      // Determine if element is closer to top or bottom of viewport
      const distanceFromTop = rect.top;
      const distanceFromBottom = viewportHeight - rect.bottom;
      targetScrollTop = distanceFromTop <= distanceFromBottom
        ? window.pageYOffset + rect.top - safeAreaInsetTop - offset
        : window.pageYOffset + rect.bottom - viewportHeight + offset;
      break;
    }
    case "center":
    default: {
      // Position element at the center of viewport
      targetScrollTop = window.pageYOffset + rect.top - (viewportHeight - rect.height) / 2 - offset;
      break;
    }
  }

  // Use scrollTo for more precise control over the scroll position
  window.scrollTo({
    top: targetScrollTop,
    behavior
  });
}

/**
 * Enhanced scrolling function for tour steps
 */
export const scrollTourTarget = async (
  selector: string,
  options: {
    align?: "start" | "center" | "end" | "nearest";
    offset?: number;
    behavior?: ScrollBehavior;
  } = {}
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector) as HTMLElement;
    if (!element) {
      reject(new Error(`Element ${selector} not found`));
      return;
    }

    // Scroll the element with enhanced alignment and offset
    scrollToElementWithAlignment(element, options);

    // Wait a bit for the scroll to complete before resolving
    setTimeout(resolve, 300);
  });
};

/**
 * Utility function to get scroll configuration
 */
export function getScrollConfig(
  step: { scrollAlign?: "start" | "center" | "end" | "nearest"; scrollOffset?: number; mobile?: { scrollAlign?: "start" | "center" | "end" | "nearest"; scrollOffset?: number } },
  isMobile: boolean
) {
  // Determine scroll alignment with defaults
  let align: "start" | "center" | "end" | "nearest" = isMobile ? "start" : "center";
  let offset = 0;

  // Check for mobile-specific overrides
  if (isMobile && step.mobile) {
    align = step.mobile.scrollAlign ?? align;
    offset = step.mobile.scrollOffset ?? offset;
  }

  // Apply step-level overrides (takes precedence over defaults)
  align = step.scrollAlign ?? align;
  offset = step.scrollOffset ?? offset;

  return { align, offset };
}

/**
 * Apply auto-scroll with configuration and layout stabilization.
 * Waits for layout to stabilize before scrolling to prevent positioning issues.
 */
export async function applyAutoScroll(
  selector: string,
  step: { scrollAlign?: "start" | "center" | "end" | "nearest"; scrollOffset?: number; mobile?: { scrollAlign?: "start" | "center" | "end" | "nearest"; scrollOffset?: number } },
  isMobile: boolean,
  options: { behavior?: ScrollBehavior; skipLayoutWait?: boolean } = {}
): Promise<void> {
  try {
    // Wait for layout to stabilize unless explicitly skipped
    if (!options.skipLayoutWait) {
      await waitForLayoutStability();
    }
    
    const { align, offset } = getScrollConfig(step, isMobile);
    await scrollTourTarget(selector, {
      align,
      offset,
      behavior: options.behavior || 'smooth'
    });
  } catch (error) {
    console.error('Error applying auto-scroll:', error);
    // Fallback to basic scrolling
    const targetElement = document.querySelector(selector) as HTMLElement;
    if (targetElement) {
      targetElement.scrollIntoView({
        behavior: options.behavior || 'smooth',
        block: 'center',
        inline: 'center'
      });
    }
  }
}