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
  className
}: SpotlightOverlayProps) {
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [isMaskSupported, setIsMaskSupported] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);

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
      setTargetRect({
        x: rect.left - padding,
        y: rect.top - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2
      });
    } else {
      console.warn('SpotlightOverlay: Target element not found');
      setTargetRect(null);
    }
  }, [targetRef, targetSelector, padding]);

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