import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface SpotlightOverlayProps {
  targetRef?: React.RefObject<HTMLElement>;
  targetSelector?: string;
  padding?: number;
  radius?: number;
  onClose: () => void;
  children?: React.ReactNode;
  className?: string;
  imageUrl?: string; // Can be a string path or imported asset
  imageOffset?: number; // Legacy offset (maintained for backward compatibility)
  imageOffsetX?: number; // Horizontal offset relative to spotlight center
  imageOffsetY?: number; // Vertical offset relative to default placement
  imagePosition?: "below" | "above" | "left" | "right"; // Position relative to spotlight
  imageWidth?: number | string; // Custom width (e.g., 400, "400px", "80%")
  imageHeight?: number | string; // Custom height (e.g., 300, "300px", "80%")
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function SpotlightOverlay({
  targetRef,
  targetSelector,
  padding = 12,
  radius = 12,
  onClose,
  children,
  className,
  imageUrl,
  imageOffset = 12,
  imageOffsetX = 0,
  imageOffsetY = 0,
  imagePosition = "below",
  imageWidth,
  imageHeight
}: SpotlightOverlayProps) {
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [isMaskSupported, setIsMaskSupported] = useState(true);
  const [imagePositionState, setImagePositionState] = useState<{ top: number; left: number; transform: string } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Helper function to compute image position
  const computeImagePosition = useCallback((
    rect: { x: number; y: number; width: number; height: number },
    imgW: number,
    imgH: number,
    pos: "below" | "above" | "left" | "right",
    gap = 12,
    ox = 0,
    oy = 0
  ) => {
    // Base anchor point BEFORE offsets
    let ax, ay;

    if (pos === "below") {
      ax = rect.x + rect.width / 2;  // center horizontally
      ay = rect.y + rect.height + gap;  // below element
    } else if (pos === "above") {
      ax = rect.x + rect.width / 2;  // center horizontally
      ay = rect.y - gap - imgH;      // above element
    } else if (pos === "left") {
      ax = rect.x - gap - imgW;        // left of element
      ay = rect.y + rect.height / 2;  // center vertically
    } else if (pos === "right") {
      ax = rect.x + rect.width + gap;   // right of element
      ay = rect.y + rect.height / 2;  // center vertically
    } else {
      // Default to "below"
      ax = rect.x + rect.width / 2;
      ay = rect.y + rect.height + gap;
    }

    // Apply offsets AFTER base anchor calculation
    const left = ax + ox;
    const top = ay + oy;

    // Transform based on position type
    const transform =
      pos === "left" || pos === "right"
        ? "translate(0, -50%)"   // Center vertically for left/right
        : "translate(-50%, 0)";  // Center horizontally for below/above

    return { left, top, transform };
  }, []);

  // Function to get target element and calculate its position
  const updateTargetPosition = useCallback(() => {
    let targetElement: HTMLElement | null = null;

    // Try to get element from ref first
    if (targetRef?.current) {
      targetElement = targetRef.current;
    }
    // Then try selector
    else if (targetSelector) {
      targetElement = document.querySelector(targetSelector);
    }

    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      const spotlightRect = {
        x: rect.left - padding,
        y: rect.top - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2
      };

      setTargetRect(spotlightRect);

      // Calculate image position if imageUrl is provided
      if (imageUrl) {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Estimate image dimensions (we'll use max-width: min(520px, 80vw) and height: auto)
        const imageMaxWidth = Math.min(520, viewportWidth * 0.8);
        const estimatedImageHeight = imageMaxWidth * 0.6; // Rough estimate, will be adjusted by actual image

        // Use the effective offset values (already processed by BlobbiTour)
        const finalOffsetX = imageOffsetX ?? 0;
        const finalOffsetY = imageOffsetY ?? 0;

        // Use default position if not specified
        const position = imagePosition ?? "below";

        // Calculate position using the computeImagePosition function
        const { left, top, transform } = computeImagePosition(
          spotlightRect,
          imageMaxWidth,
          estimatedImageHeight,
          position,
          12, // gap
          finalOffsetX,
          finalOffsetY
        );

        // Apply viewport clamping with padding AFTER offsets
        const viewportPadding = 12;
        let finalLeft = left;
        let finalTop = top;

        // Clamp to viewport boundaries
        finalLeft = Math.max(viewportPadding, Math.min(viewportWidth - imageMaxWidth - viewportPadding, finalLeft));
        finalTop = Math.max(viewportPadding, Math.min(viewportHeight - estimatedImageHeight - viewportPadding, finalTop));

        // Debug logging
        console.log('🎯 SpotlightOverlay final position:', {
          spotlightRect: { x: spotlightRect.x, y: spotlightRect.y, width: spotlightRect.width, height: spotlightRect.height },
          imagePosition: position,
          offsets: { x: finalOffsetX, y: finalOffsetY },
          beforeClamp: { left, top },
          afterClamp: { left: finalLeft, top: finalTop },
          transform,
          viewport: { width: viewportWidth, height: viewportHeight }
        });

        setImagePositionState({ top: finalTop, left: finalLeft, transform });
      } else {
        setImagePositionState(null);
      }
    } else {
      console.warn('SpotlightOverlay: Target element not found');
      setTargetRect(null);
      setImagePositionState(null);
    }
  }, [targetRef, targetSelector, padding, imageUrl, imageOffsetX, imageOffsetY, imagePosition, computeImagePosition]);

  // Check mask support
  useEffect(() => {
    const testElement = document.createElement('div');
    setIsMaskSupported('mask' in testElement.style || 'webkitMask' in testElement.style);
  }, []);

  // Set up event listeners for position updates
  useEffect(() => {
    updateTargetPosition();

    const handleUpdate = () => {
      updateTargetPosition();
    };

    // Listen for various events that might affect positioning
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate);
    window.addEventListener('orientationchange', handleUpdate);

    // Use MutationObserver to detect DOM changes
    const observer = new MutationObserver(handleUpdate);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate);
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

  // Handle clicks outside the spotlight
  const handleOverlayClick = (e: React.MouseEvent) => {
    // If we have a target rect, check if click is outside the spotlight
    if (targetRect) {
      const clickX = e.clientX;
      const clickY = e.clientY;

      const isInsideSpotlight =
        clickX >= targetRect.x &&
        clickX <= targetRect.x + targetRect.width &&
        clickY >= targetRect.y &&
        clickY <= targetRect.y + targetRect.height;

      if (!isInsideSpotlight) {
        e.preventDefault();
        e.stopPropagation();
      }
    } else {
      // No target found, allow clicking through
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Render the spotlight mask
  const renderSpotlightMask = () => {
    if (!targetRect) {
      // No target found, render full overlay
      return (
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={handleOverlayClick}
        />
      );
    }

    if (isMaskSupported) {
      // Use CSS mask for modern browsers
      const maskStyle: React.CSSProperties = {
        maskImage: `radial-gradient(circle at ${targetRect.x + targetRect.width / 2}px ${targetRect.y + targetRect.height / 2}px, transparent 0%, transparent ${Math.max(targetRect.width, targetRect.height) / 2}px, black ${Math.max(targetRect.width, targetRect.height) / 2 + 1}px)`,
        WebkitMaskImage: `radial-gradient(circle at ${targetRect.x + targetRect.width / 2}px ${targetRect.y + targetRect.height / 2}px, transparent 0%, transparent ${Math.max(targetRect.width, targetRect.height) / 2}px, black ${Math.max(targetRect.width, targetRect.height) / 2 + 1}px)`,
        maskSize: 'cover',
        WebkitMaskSize: 'cover',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat'
      };

      return (
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          style={maskStyle}
          onClick={handleOverlayClick}
        />
      );
    } else {
      // Fallback: Use 4 divs to create the hole
      return (
        <>
          {/* Top */}
          <div
            className="absolute left-0 right-0 top-0 bg-black/80 backdrop-blur-sm"
            style={{ height: targetRect.y }}
            onClick={handleOverlayClick}
          />
          {/* Left */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-black/80 backdrop-blur-sm"
            style={{
              top: targetRect.y,
              width: targetRect.x,
              height: targetRect.height
            }}
            onClick={handleOverlayClick}
          />
          {/* Right */}
          <div
            className="absolute right-0 top-0 bottom-0 bg-black/80 backdrop-blur-sm"
            style={{
              top: targetRect.y,
              left: targetRect.x + targetRect.width,
              width: `calc(100% - ${targetRect.x + targetRect.width}px)`,
              height: targetRect.height
            }}
            onClick={handleOverlayClick}
          />
          {/* Bottom */}
          <div
            className="absolute left-0 right-0 bottom-0 bg-black/80 backdrop-blur-sm"
            style={{
              top: targetRect.y + targetRect.height,
              height: `calc(100% - ${targetRect.y + targetRect.height}px)`
            }}
            onClick={handleOverlayClick}
          />
        </>
      );
    }
  };

  const overlayContent = (
    <div
      ref={overlayRef}
      className={cn(
        "fixed inset-0 z-[90] pointer-events-none",
        className
      )}
    >
      {/* Spotlight mask */}
      <div className="absolute inset-0 pointer-events-auto">
        {renderSpotlightMask()}
      </div>

      {/* Close button (X) in top-right */}
      <Button
        variant="outline"
        size="icon"
        onClick={onClose}
        className="absolute top-4 right-4 z-[91] pointer-events-auto border-2 border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm"
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Step Image */}
      {imageUrl && imagePositionState && (
        <div
          style={{
            position: "fixed",
            top: `${imagePositionState.top}px`,
            left: `${imagePositionState.left}px`,
            transform: imagePositionState.transform,
            zIndex: 92,
            pointerEvents: 'none',
            ...(imageWidth || imageHeight ? {} : { maxWidth: 'min(520px, 80vw)', width: '100%' })
          }}
        >
          <img
            src={imageUrl}
            alt="Tour step illustration"
            className="rounded-lg"
            style={{
              pointerEvents: 'auto', // Allow hover on image if needed
              width: imageWidth ?? 'auto',
              height: imageHeight ?? 'auto',
              maxWidth: imageWidth ? 'none' : undefined,
              maxHeight: imageHeight ? 'none' : undefined
            }}
            onLoad={(e) => {
              // Recalculate position when image loads to get exact dimensions
              const img = e.target as HTMLImageElement;
              const actualHeight = img.offsetHeight;
              const actualWidth = img.offsetWidth;
              const viewportWidth = window.innerWidth;
              const viewportHeight = window.innerHeight;

              if (targetRect) {
                // Use final offset values (already processed)
                const finalOffsetX = imageOffsetX ?? 0;
                const finalOffsetY = imageOffsetY ?? 0;

                // Use default position if not specified
                const position = imagePosition ?? "below";

                // Recalculate position with actual image dimensions
                const { left, top, transform } = computeImagePosition(
                  targetRect,
                  actualWidth,
                  actualHeight,
                  position,
                  12, // gap
                  finalOffsetX,
                  finalOffsetY
                );

                // Apply viewport clamping with padding AFTER offsets
                const viewportPadding = 12;
                let finalLeft = left;
                let finalTop = top;

                // Clamp to viewport boundaries
                finalLeft = Math.max(viewportPadding, Math.min(viewportWidth - actualWidth - viewportPadding, finalLeft));
                finalTop = Math.max(viewportPadding, Math.min(viewportHeight - actualHeight - viewportPadding, finalTop));

                console.log('🖼️ Image loaded - recalculated position:', {
                  actualSize: { width: actualWidth, height: actualHeight },
                  finalPosition: { left: finalLeft, top: finalTop, transform }
                });

                setImagePositionState({ top: finalTop, left: finalLeft, transform });
              }
            }}
            onError={(e) => {
              // Hide image gracefully if it fails to load
              e.currentTarget.style.display = 'none';
              console.warn('Tour image failed to load:', imageUrl);
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
    </div>
  );

  // Render via portal to avoid z-index conflicts
  return createPortal(overlayContent, document.body);
}