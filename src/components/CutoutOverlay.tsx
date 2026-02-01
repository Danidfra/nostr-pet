import React, { useEffect, useRef, useState, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { CutoutShape, HandPointerConfig } from '@/types/tour';

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
  /** Callback when overlay is closed */
  onClose: () => void;
  /** Children elements (e.g., tour content card) */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
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
  onClose,
  children,
  className,
}: CutoutOverlayProps) {
  // Generate unique mask ID to prevent collisions across instances and HMR
  const maskId = useId();
  
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [holeRect, setHoleRect] = useState<Rect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const targetElementRef = useRef<Element | null>(null);

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

  // Update target and hole positions
  const updateTargetPosition = useCallback(() => {
    const targetElement = document.querySelector(targetSelector);
    
    if (targetElement) {
      // Store reference for MutationObserver
      targetElementRef.current = targetElement;
      
      const rect = targetElement.getBoundingClientRect();
      setTargetRect({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      });
      setHoleRect(calculateHoleRect(rect));
    } else {
      console.warn('CutoutOverlay: Target element not found:', targetSelector);
      targetElementRef.current = null;
      setTargetRect(null);
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

    // Reduced MutationObserver scope: observe only target element or its parent container
    const observer = new MutationObserver(handleUpdate);
    const observeTarget = targetElementRef.current?.parentElement || document.body;
    
    observer.observe(observeTarget, {
      childList: true,
      subtree: observeTarget === document.body, // Only use subtree if observing body
      attributes: true,
      attributeFilter: ['class', 'style'], // Only watch class and style changes
    });

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('orientationchange', handleUpdate);
      observer.disconnect();
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

  const handPosition = holeRect ? getHandPosition(holeRect) : null;
  const handScale = hand?.scale || 1;

  const overlayContent = (
    <div
      ref={overlayRef}
      className={cn(
        "fixed inset-0 z-[90] pointer-events-none",
        className
      )}
    >
      {/* 
        Layer 1: Visual overlay (SVG with mask) - no pointer events
        This provides the visual dark overlay with cutout
      */}
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

      {/* 
        Layer 2: Interaction blocking divs - blocks clicks outside hole
        This creates four divs around the hole that capture pointer events
      */}
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

      {/* 
        If no hole is detected, block entire screen
      */}
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

      {/* Close button (X) in top-right */}
      <Button
        variant="outline"
        size="icon"
        onClick={onClose}
        className="absolute top-4 right-4 z-[91] pointer-events-auto border-2 border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm"
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Hand pointer with gentle animation */}
      {hand?.enabled && handPosition && (
        <div
          className="absolute pointer-events-none z-[92] animate-[gentle-bob_2s_ease-in-out_infinite]"
          style={{
            top: `${handPosition.top}px`,
            left: `${handPosition.left}px`,
            transform: `translate(-50%, -50%) scale(${handScale})`,
          }}
        >
          <img
            src="/assets/overboard/hand.png"
            alt="Hand pointer"
            className="w-24 h-24 drop-shadow-lg"
            style={{
              filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))',
            }}
          />
        </div>
      )}

      {/* Children (tour controls) */}
      {children && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 pointer-events-auto">
            {children}
          </div>
        </div>
      )}

      {/* Animation keyframes */}
      <style>{`
        @keyframes gentle-bob {
          0%, 100% {
            transform: translate(-50%, -50%) scale(${handScale}) translateY(0);
          }
          50% {
            transform: translate(-50%, -50%) scale(${handScale}) translateY(-8px);
          }
        }
      `}</style>
    </div>
  );

  // Render via portal to avoid z-index conflicts
  return createPortal(overlayContent, document.body);
}
