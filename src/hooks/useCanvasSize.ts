import { useEffect, useRef, useCallback, useState } from 'react';

interface CanvasSizeResult {
  isReady: boolean;
  forceRecalc: () => void;
  logicalWidth: number;
  logicalHeight: number;
}

/**
 * Hook for managing canvas size with proper DPR handling.
 * 
 * Responsibilities:
 * - Observes container size changes
 * - Computes CSS size, DPR, and bitmap size
 * - Applies canvas.width / height
 * - Applies ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
 * - Handles temporary zero-size gracefully with retry logic
 * - Exposes forceRecalc() for game restarts
 */
export function useCanvasSize(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  containerRef: React.RefObject<HTMLElement>
): CanvasSizeResult {
  const [isReady, setIsReady] = useState(false);
  const [logicalSize, setLogicalSize] = useState({ width: 0, height: 0 });
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const lastSizeRef = useRef({ width: 0, height: 0 });

  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) {
      setIsReady(false);
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    // Handle temporary zero-size (overlay transitions, etc.)
    if (rect.width === 0 || rect.height === 0) {
      // Don't mark as not ready if we already have a valid size
      // Just schedule a retry
      if (retryTimeoutRef.current !== null) {
        clearTimeout(retryTimeoutRef.current);
      }

      retryTimeoutRef.current = window.setTimeout(() => {
        requestAnimationFrame(() => {
          updateCanvasSize();
        });
      }, 16); // ~1 frame delay

      return;
    }

    // Calculate the CSS size (the container dictates this)
    const cssSize = Math.floor(Math.min(rect.width, rect.height));

    // Check if size actually changed
    if (
      lastSizeRef.current.width === cssSize &&
      lastSizeRef.current.height === cssSize &&
      isReady
    ) {
      // Size hasn't changed, no need to update
      return;
    }

    // Update last size
    lastSizeRef.current = { width: cssSize, height: cssSize };

    // Calculate bitmap size (physical pixels)
    const bitmapWidth = Math.floor(cssSize * dpr);
    const bitmapHeight = Math.floor(cssSize * dpr);

    // Update canvas bitmap size
    canvas.width = bitmapWidth;
    canvas.height = bitmapHeight;

    // Get context and reset transform
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsReady(false);
      return;
    }

    // CRITICAL: Reset transform to identity first, then apply DPR scale
    // This prevents transform accumulation
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to identity
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Apply DPR scale

    // Update logical size for render calculations
    setLogicalSize({ width: cssSize, height: cssSize });

    // Mark as ready
    setIsReady(true);
  }, [canvasRef, containerRef, isReady]);

  const forceRecalc = useCallback(() => {
    // Reset ready state and force recalculation
    setIsReady(false);
    lastSizeRef.current = { width: 0, height: 0 };

    // Use double rAF to ensure layout has fully settled
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        updateCanvasSize();
      });
    });
  }, [updateCanvasSize]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial size calculation
    updateCanvasSize();

    // Set up ResizeObserver
    resizeObserverRef.current = new ResizeObserver(() => {
      updateCanvasSize();
    });

    resizeObserverRef.current.observe(container);

    // Also listen to window events
    const handleResize = () => {
      updateCanvasSize();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      if (retryTimeoutRef.current !== null) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [containerRef, updateCanvasSize]);

  return {
    isReady,
    forceRecalc,
    logicalWidth: logicalSize.width,
    logicalHeight: logicalSize.height,
  };
}
