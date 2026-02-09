import React, { useEffect, useRef, useState, useCallback, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { CutoutShape, HandPointerConfig } from '@/types/tour';

/**
 * Position preset for tour controls.
 * - 'bottom-center': Centered at bottom with spacing (default)
 * - 'top-center': Centered at top with spacing
 * - 'center': Centered in viewport
 * - 'bottom-left': Bottom left corner with spacing
 * - 'bottom-right': Bottom right corner with spacing
 * - 'top-left': Top left corner with spacing
 * - 'top-right': Top right corner with spacing
 */
export type ControlsPosition = 
  | 'bottom-center'
  | 'top-center'
  | 'center'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-left'
  | 'top-right';

interface CutoutOverlayProps {
  /** CSS selector for the target element (e.g., '#dashboard-blobbi-visual') */
  targetSelector: string;
  /** Padding around the target element in pixels (default: 16) */
  padding?: number;
  /** Border radius for 'rounded' shape in pixels (default: 24) */
  radius?: number;
  /** Shape of the cutout hole (default: 'rounded') */
  shape?: CutoutShape;
  /** Override hole width (otherwise uses element width + padding) */
  holeWidth?: number;
  /** Override hole height (otherwise uses element height + padding) */
  holeHeight?: number;
  /** Horizontal offset for the hole in pixels */
  holeOffsetX?: number;
  /** Vertical offset for the hole in pixels */
  holeOffsetY?: number;
  /** Overlay opacity (0-1, default: 0.80) */
  overlayOpacity?: number;
  /** Hand pointer configuration */
  hand?: HandPointerConfig;
  /** Position for tour controls (default: 'bottom-center') */
  controlsPosition?: ControlsPosition;
  /** Distance from viewport edges for controls in pixels (default: 24) */
  controlsInset?: number;
  /** Fine-tune horizontal position offset in pixels (default: 0) */
  controlsOffsetX?: number;
  /** Fine-tune vertical position offset in pixels (default: 0) */
  controlsOffsetY?: number;
  /** Callback when overlay is closed */
  onClose: () => void;
  /** Children elements (e.g., tour content card) */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** 
   * Block outside pointer events to prevent Radix Dialog dismissal.
   * When true, captures and stops propagation of pointer/click events
   * on the overlay (but not on the tour card or highlighted element).
   * Use this when the tour step is inside a modal to prevent accidental closure.
   * (default: false)
   */
  blockOutsidePointerEvents?: boolean;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * CutoutOverlay - A dark overlay with a configurable cutout "hole" around a target element.
 * 
 * **Layering Architecture:**
 * - Layer 1 (z-index 1-2): Visual overlay (SVG mask) + Click blockers
 * - Layer 2 (z-index 3): Hand pointer (optional)
 * - Layer 3 (z-index 4-5): Tour controls + Close button
 * 
 * **How to use:**
 * 1. Add an ID to your target element: `<div id="my-element">...</div>`
 * 2. Use this component with `targetSelector="#my-element"`
 * 
 * **Configuring the cutout hole:**
 * - `shape`: 'rect' | 'rounded' | 'circle' | 'pill'
 * - `padding`: Space around target (default: 16px)
 * - `radius`: Border radius for 'rounded' (default: 24px)
 * - `holeWidth/holeHeight`: Force specific hole size
 * - `holeOffsetX/holeOffsetY`: Move hole relative to element
 * 
 * **Positioning tour controls:**
 * - `controlsPosition`: 'bottom-center' (default), 'top-center', 'center', 
 *   'bottom-left', 'bottom-right', 'top-left', 'top-right'
 * - `controlsInset`: Distance from viewport edges in pixels (default: 24px)
 * - `controlsOffsetX/controlsOffsetY`: Fine-tune position in pixels (default: 0)
 * - Controls are independent from hole position
 * - Example: Hole at bottom? Use 'top-center' to avoid collision
 * 
 * **Hand pointer:**
 * - `hand.enabled`: Show/hide hand pointer
 * - `hand.side`: 'top' | 'right' | 'bottom' | 'left'
 * - `hand.offsetX/offsetY`: Fine-tune position
 * - `hand.scale`: Size adjustment (default: 1)
 * 
 * **Example:**
 * ```tsx
 * <CutoutOverlay
 *   targetSelector="#dashboard-blobbi-visual"
 *   shape="rounded"
 *   padding={16}
 *   radius={24}
 *   controlsPosition="top-center"
 *   controlsInset={32}
 *   controlsOffsetY={10}
 *   hand={{ enabled: true, side: 'right' }}
 *   onClose={handleClose}
 * >
 *   <TourCard />
 * </CutoutOverlay>
 * ```
 */
export function CutoutOverlay({
  targetSelector,
  padding = 16,
  radius = 24,
  shape = 'rounded',
  holeWidth,
  holeHeight,
  holeOffsetX = 0,
  holeOffsetY = 0,
  overlayOpacity = 0.80,
  hand,
  controlsPosition = 'bottom-center',
  controlsInset = 24,
  controlsOffsetX = 0,
  controlsOffsetY = 0,
  onClose,
  children,
  className,
  blockOutsidePointerEvents = false,
}: CutoutOverlayProps) {
  // Generate unique mask ID to prevent collisions across instances and HMR
  // Sanitize to avoid special characters that could break SVG mask references
  const rawId = useId();
  const maskId = useMemo(() => 'cutout-mask-' + rawId.replace(/[^a-zA-Z0-9_-]/g, ''), [rawId]);
  
  const [holeRect, setHoleRect] = useState<Rect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tourCardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const targetElementRef = useRef<Element | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  // Calculate the hole rectangle based on target element and configuration
  const calculateHoleRect = useCallback((rect: DOMRect): Rect => {
    // Start with element rect plus padding
    let x = rect.left - padding;
    let y = rect.top - padding;
    let width = rect.width + padding * 2;
    let height = rect.height + padding * 2;

    // Apply width/height overrides if provided (centered on element)
    if (holeWidth !== undefined) {
      const centerX = rect.left + rect.width / 2;
      x = centerX - holeWidth / 2;
      width = holeWidth;
    }
    if (holeHeight !== undefined) {
      const centerY = rect.top + rect.height / 2;
      y = centerY - holeHeight / 2;
      height = holeHeight;
    }

    // Apply offsets
    x += holeOffsetX;
    y += holeOffsetY;

    return { x, y, width, height };
  }, [padding, holeWidth, holeHeight, holeOffsetX, holeOffsetY]);

  // Update hole position based on target element
  const updateTargetPosition = useCallback(() => {
    const targetElement = document.querySelector(targetSelector);
    
    if (targetElement) {
      // Store reference for MutationObserver
      targetElementRef.current = targetElement;
      
      const rect = targetElement.getBoundingClientRect();
      setHoleRect(calculateHoleRect(rect));
    } else {
      console.warn('CutoutOverlay: Target element not found:', targetSelector);
      targetElementRef.current = null;
      setHoleRect(null);
    }
  }, [targetSelector, calculateHoleRect]);

  // Set up event listeners for position updates (with RAF throttling)
  useEffect(() => {
    updateTargetPosition();

    const handleUpdate = () => {
      // Cancel any pending RAF
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      // Schedule update on next frame
      rafRef.current = requestAnimationFrame(() => {
        updateTargetPosition();
        rafRef.current = null;
      });
    };

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true); // Use capture to catch all scrolls
    window.addEventListener('orientationchange', handleUpdate);

    // Improved MutationObserver: prefer target's parent with subtree enabled
    // This allows detecting layout changes within the parent without observing entire body
    const setupObserver = () => {
      // Clean up existing observer
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      const observer = new MutationObserver(() => {
        handleUpdate();
        
        // Upgrade observer if target now has parent and we're observing body
        if (currentObserveTarget === document.body) {
          const parent = targetElementRef.current?.parentElement;
          if (parent && parent !== document.body) {
            // Switch to more efficient parent observation
            observer.disconnect();
            currentObserveTarget = parent;
            observer.observe(parent, {
              childList: true,
              subtree: true, // Allow subtree on parent (not body) to catch internal layout changes
              attributes: true,
              attributeFilter: ['class', 'style'],
            });
          }
        }
      });

      observerRef.current = observer;
      
      // Determine initial observe target: prefer parent, fallback to body
      let currentObserveTarget: Element = targetElementRef.current?.parentElement || document.body;
      
      // Use subtree: true on parent (efficient), subtree: true on body (fallback only)
      observer.observe(currentObserveTarget, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
    };

    setupObserver();

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('orientationchange', handleUpdate);
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [updateTargetPosition]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Generate SVG path for the cutout hole based on shape
  const generateHolePath = useCallback((hole: Rect): string => {
    const { x, y, width, height } = hole;

    switch (shape) {
      case 'circle': {
        // Use smallest dimension for perfect circle
        const r = Math.min(width, height) / 2;
        const cx = x + width / 2;
        const cy = y + height / 2;
        return `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`;
      }

      case 'pill': {
        // Pill shape: radius = half of height
        const r = Math.min(radius, height / 2);
        return `
          M ${x + r},${y}
          L ${x + width - r},${y}
          A ${r},${r} 0 0,1 ${x + width - r},${y + height}
          L ${x + r},${y + height}
          A ${r},${r} 0 0,1 ${x + r},${y}
        `;
      }

      case 'rounded': {
        // Rounded rectangle with configurable radius
        const r = Math.min(radius, width / 2, height / 2);
        return `
          M ${x + r},${y}
          L ${x + width - r},${y}
          A ${r},${r} 0 0,1 ${x + width},${y + r}
          L ${x + width},${y + height - r}
          A ${r},${r} 0 0,1 ${x + width - r},${y + height}
          L ${x + r},${y + height}
          A ${r},${r} 0 0,1 ${x},${y + height - r}
          L ${x},${y + r}
          A ${r},${r} 0 0,1 ${x + r},${y}
        `;
      }

      case 'rect':
      default: {
        // Sharp rectangle
        return `
          M ${x},${y}
          L ${x + width},${y}
          L ${x + width},${y + height}
          L ${x},${y + height}
          Z
        `;
      }
    }
  }, [shape, radius]);

  // Calculate hand pointer position
  const getHandPosition = useCallback((hole: Rect): { top: number; left: number } | null => {
    if (!hand?.enabled) return null;

    const side = hand.side || 'right';
    const offsetX = hand.offsetX || 0;
    const offsetY = hand.offsetY || 0;
    const baseGap = 20; // Base distance from hole edge

    let top = 0;
    let left = 0;

    switch (side) {
      case 'top':
        left = hole.x + hole.width / 2 + offsetX;
        top = hole.y - baseGap + offsetY;
        break;
      case 'right':
        left = hole.x + hole.width + baseGap + offsetX;
        top = hole.y + hole.height / 2 + offsetY;
        break;
      case 'bottom':
        left = hole.x + hole.width / 2 + offsetX;
        top = hole.y + hole.height + baseGap + offsetY;
        break;
      case 'left':
        left = hole.x - baseGap + offsetX;
        top = hole.y + hole.height / 2 + offsetY;
        break;
    }

    return { top, left };
  }, [hand]);

  // Get hand orientation transform based on side
  const getHandOrientationTransform = useCallback((): string => {
    if (!hand?.enabled) return '';
    
    // autoOrient defaults to true
    const autoOrient = hand.autoOrient !== false;
    if (!autoOrient) return '';

    const side = hand.side || 'right';

    switch (side) {
      case 'left':
        // Hand asset points right by default, which is correct for left side
        return '';
      case 'right':
        // Flip horizontally to point left toward cutout
        return 'scaleX(-1)';
      case 'top':
        // Rotate 90° clockwise to point down toward cutout
        return 'rotate(90deg)';
      case 'bottom':
        // Rotate 90° counter-clockwise (270° clockwise) to point up toward cutout
        return 'rotate(-90deg)';
      default:
        return '';
    }
  }, [hand]);

  const handPosition = holeRect ? getHandPosition(holeRect) : null;
  const handScale = hand?.scale || 1;
  const handOrientationTransform = getHandOrientationTransform();

  // Calculate control positioning styles and classes
  // Using inline styles for dynamic values (inset, offsets) to avoid Tailwind JIT issues
  const getControlPositioning = useCallback((): { 
    style: React.CSSProperties; 
    className: string;
  } => {
    const baseStyle: React.CSSProperties = {};
    let transformClass = '';
    
    switch (controlsPosition) {
      case 'top-center':
        baseStyle.top = `${controlsInset + controlsOffsetY}px`;
        baseStyle.left = '50%';
        transformClass = '-translate-x-1/2';
        if (controlsOffsetX !== 0) {
          baseStyle.marginLeft = `${controlsOffsetX}px`;
        }
        break;
        
      case 'center':
        baseStyle.top = '50%';
        baseStyle.left = '50%';
        transformClass = '-translate-x-1/2 -translate-y-1/2';
        if (controlsOffsetX !== 0) {
          baseStyle.marginLeft = `${controlsOffsetX}px`;
        }
        if (controlsOffsetY !== 0) {
          baseStyle.marginTop = `${controlsOffsetY}px`;
        }
        break;
        
      case 'bottom-left':
        baseStyle.bottom = `${controlsInset + controlsOffsetY}px`;
        baseStyle.left = `${controlsInset + controlsOffsetX}px`;
        break;
        
      case 'bottom-right':
        baseStyle.bottom = `${controlsInset + controlsOffsetY}px`;
        baseStyle.right = `${controlsInset - controlsOffsetX}px`;
        break;
        
      case 'top-left':
        baseStyle.top = `${controlsInset + controlsOffsetY}px`;
        baseStyle.left = `${controlsInset + controlsOffsetX}px`;
        break;
        
      case 'top-right':
        baseStyle.top = `${controlsInset + controlsOffsetY}px`;
        baseStyle.right = `${controlsInset - controlsOffsetX}px`;
        break;
        
      case 'bottom-center':
      default:
        baseStyle.bottom = `${controlsInset + controlsOffsetY}px`;
        baseStyle.left = '50%';
        transformClass = '-translate-x-1/2';
        if (controlsOffsetX !== 0) {
          baseStyle.marginLeft = `${controlsOffsetX}px`;
        }
        break;
    }
    
    return { style: baseStyle, className: transformClass };
  }, [controlsPosition, controlsInset, controlsOffsetX, controlsOffsetY]);

  /**
   * Prevents outside pointer events from reaching underlying Radix Dialog.
   * 
   * WHY THIS IS NEEDED:
   * Radix Dialog uses PointerDownOutside detection to auto-close modals.
   * When the tour overlay is active and a modal is open, clicking the tour
   * card or overlay is detected as an "outside click" and closes the modal.
   * 
   * HOW IT WORKS:
   * - Uses capture phase to intercept events before they bubble to Dialog
   * - Checks if click is inside tour card (allow those to work normally)
   * - Blocks all other events to prevent Dialog's outside-click detection
   * 
   * CAPTURE PHASE ORDER:
   * 1. This handler runs (capture)
   * 2. If not tour card, stop propagation
   * 3. Dialog never receives the event
   * 4. Modal stays open
   */
  const handleOverlayPointerEvent = useCallback((event: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    if (!blockOutsidePointerEvents) return;

    // Allow events inside the tour card to work normally
    if (tourCardRef.current?.contains(event.target as Node)) {
      return;
    }

    // Allow events on the highlighted target element to work normally
    // (for interactive steps where user needs to click the target)
    if (targetElementRef.current?.contains(event.target as Node)) {
      return;
    }

    // Block all other events to prevent Radix Dialog dismissal
    event.preventDefault();
    event.stopPropagation();
    
    // stopImmediatePropagation prevents other handlers on same element
    if (typeof event.nativeEvent.stopImmediatePropagation === 'function') {
      event.nativeEvent.stopImmediatePropagation();
    }
  }, [blockOutsidePointerEvents]);

  const overlayContent = (
    <div
      ref={overlayRef}
      className={cn(
        "fixed inset-0 z-[90] pointer-events-none",
        className
      )}
      // Capture-phase handlers to prevent Radix Dialog dismissal
      onPointerDownCapture={handleOverlayPointerEvent}
      onClickCapture={handleOverlayPointerEvent}
    >
      {/* ========================================================================
          LAYER 1: Visual overlay (SVG with mask) + Click blockers
          z-index: 1-2
          Purpose: Provides dark overlay with cutout and blocks clicks outside hole
          ======================================================================== */}
      
      {/* SVG overlay with cutout mask (visual only, no pointer events) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1 }}
      >
        <defs>
          <mask id={maskId}>
            {/* White background (visible area) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black hole (transparent area) */}
            {holeRect && (
              <path
                d={generateHolePath(holeRect)}
                fill="black"
              />
            )}
          </mask>
        </defs>
        
        {/* Dark overlay with cutout mask */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="black"
          opacity={overlayOpacity}
          mask={`url(#${maskId})`}
        />

        {/* Optional subtle outline/glow around hole */}
        {holeRect && (
          <path
            d={generateHolePath(holeRect)}
            fill="none"
            stroke="rgba(167, 139, 250, 0.4)"
            strokeWidth="2"
          />
        )}
      </svg>

      {/* Click blocking divs around the hole (blocks interaction outside hole) */}
      {holeRect && (
        <>
          {/* Top blocker */}
          <div
            className="absolute left-0 right-0 pointer-events-auto"
            style={{
              top: 0,
              height: holeRect.y,
              zIndex: 2,
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          />
          
          {/* Left blocker */}
          <div
            className="absolute pointer-events-auto"
            style={{
              top: holeRect.y,
              left: 0,
              width: holeRect.x,
              height: holeRect.height,
              zIndex: 2,
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          />
          
          {/* Right blocker */}
          <div
            className="absolute pointer-events-auto"
            style={{
              top: holeRect.y,
              left: holeRect.x + holeRect.width,
              right: 0,
              height: holeRect.height,
              zIndex: 2,
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          />
          
          {/* Bottom blocker */}
          <div
            className="absolute left-0 right-0 pointer-events-auto"
            style={{
              top: holeRect.y + holeRect.height,
              bottom: 0,
              zIndex: 2,
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          />
        </>
      )}

      {/* Fallback: block entire screen if no hole is detected */}
      {!holeRect && (
        <div
          className="absolute inset-0 pointer-events-auto"
          style={{ zIndex: 2 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        />
      )}

      {/* ========================================================================
          LAYER 2: Hand pointer (optional)
          z-index: 3
          Purpose: Animated hand indicator positioned near the hole
          ======================================================================== */}
      
      {hand?.enabled && handPosition && (
        <div
          className="absolute pointer-events-none animate-[gentle-bob_2s_ease-in-out_infinite]"
          style={{
            top: `${handPosition.top}px`,
            left: `${handPosition.left}px`,
            transform: `translate(-50%, -50%) scale(${handScale}) ${handOrientationTransform}`,
            zIndex: 3,
          }}
        >
          <img
            src="/assets/overboard/hand.png"
            alt="Hand pointer"
            className="w-24 drop-shadow-lg"
            style={{
              filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))',
            }}
          />
        </div>
      )}

      {/* ========================================================================
          LAYER 3: Tour controls (children) + Close button
          z-index: 4-5
          Purpose: Interactive UI controls that appear above everything else
          ======================================================================== */}
      
      {/* Close button (X) in top-right corner */}
      <Button
        variant="outline"
        size="icon"
        onClick={onClose}
        className="absolute top-4 right-4 pointer-events-auto border-2 border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm"
        style={{ zIndex: 5 }}
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Tour controls container (positioned based on controlsPosition prop) */}
      {children && (() => {
        const { style: positionStyle, className: transformClass } = getControlPositioning();
        return (
          <div
            ref={tourCardRef}
            className={cn("absolute pointer-events-auto", transformClass)}
            style={{ ...positionStyle, zIndex: 4 }}
          >
            {children}
          </div>
        );
      })()}

      {/* Animation keyframes for hand pointer */}
      <style>{`
        @keyframes gentle-bob {
          0%, 100% {
            transform: translate(-50%, -50%) scale(${handScale}) ${handOrientationTransform} translateY(0);
          }
          50% {
            transform: translate(-50%, -50%) scale(${handScale}) ${handOrientationTransform} translateY(-8px);
          }
        }
      `}</style>
    </div>
  );

  // Render via portal to avoid z-index conflicts
  return createPortal(overlayContent, document.body);
}
