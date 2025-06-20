import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentCompanion } from '@/hooks/useCurrentCompanion';
import { useBed } from '@/contexts/BedContext';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';
import blobBlack from '/blob-black.svg';
import blobWhite from '/blob-white.svg';

declare global {
  interface Window {
    openFeedModal?: () => void;
  }
}

interface FloatingActionMenuProps {
  className?: string;
}

interface Position {
  x: number;
  y: number;
}

interface DragStartInfo {
  x: number;
  y: number;
  startX: number;
  startY: number;
  isDragging: boolean;
}

const STORAGE_KEY = 'blobbi-floating-menu-position';
const DEFAULT_POSITION: Position = { x: 20, y: 20 };
const DRAG_THRESHOLD = 5; // pixels

export function BlobbiFloatingActionMenu({ className }: FloatingActionMenuProps) {
  const location = useLocation();
  const { data: companionData, isLoading } = useCurrentCompanion();
  const { isBedVisible, toggleBed } = useBed();
  const [position, setPosition] = useState<Position>(DEFAULT_POSITION);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<DragStartInfo | null>(null);
  const { theme } = useTheme();
  const [resolvedTheme, setResolvedTheme] = useState(theme);

  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const getSystemTheme = () => (mediaQuery.matches ? 'dark' : 'light');
      setResolvedTheme(getSystemTheme());

      const handleChange = () => setResolvedTheme(getSystemTheme());
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      setResolvedTheme(theme);
    }
  }, [theme]);

  const shouldShow = location.pathname.startsWith('/blobbi') && 
                    location.pathname !== '/' &&
                    !isLoading && 
                    companionData?.blobbi;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const savedPosition = localStorage.getItem(STORAGE_KEY);
    if (savedPosition) {
      try {
        setPosition(JSON.parse(savedPosition));
      } catch (error) {
        console.error('Failed to parse saved position:', error);
      }
    }
  }, []);

  const savePosition = (newPosition: Position) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPosition));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    
    e.preventDefault();
    dragRef.current?.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: position.x,
      startY: position.y,
      isDragging: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    if (!dragStartRef.current.isDragging && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
      dragStartRef.current.isDragging = true;
      setIsDraggingState(true);
      if (isMenuOpen) {
        setIsMenuOpen(false);
      }
    }

    if (dragStartRef.current.isDragging) {
      const buttonSize = 56;
      const newX = dragStartRef.current.startX + deltaX;
      const newY = dragStartRef.current.startY + deltaY;
      const maxX = window.innerWidth - buttonSize;
      const maxY = window.innerHeight - buttonSize;

      setPosition({
        x: Math.max(0, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY)),
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    dragRef.current?.releasePointerCapture(e.pointerId);

    if (dragStartRef.current?.isDragging) {
      savePosition(position);
    } else {
      // Toggle menu on tap/click
      setIsMenuOpen(prev => !prev);
    }

    dragStartRef.current = null;
    setIsDraggingState(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dragRef.current && !dragRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuOpen]);

  const createActionHandler = (action: () => void) => () => {
    action();
    setIsMenuOpen(false);
  };

  const handleFeedBlobbi = createActionHandler(() => {
    if (window.openFeedModal) {
      window.openFeedModal();
    } else if (window.blobbiCompanion?.openFeed) {
      window.blobbiCompanion.openFeed();
    }
  });

  const handleToggleVisibility = createActionHandler(() => {
    if (window.blobbiCompanion) {
      const companionElement = document.getElementById('blobbi-companion');
      const isVisible = companionElement && !companionElement.classList.contains('hidden');
      if (isVisible) {
        window.blobbiCompanion.hide();
      } else {
        window.blobbiCompanion.show();
      }
    }
  });

  const handleSleep = createActionHandler(() => {
    // Check if Blobbi is sleeping - if so, prevent hiding the bed
    if (isBedVisible && companionData?.blobbi?.isSleeping) {
      // Don't allow hiding the bed when Blobbi is sleeping
      return;
    }
    toggleBed();
  });

  const handleWakeUp = createActionHandler(() => {
    // Trigger wake-up logic for the Blobbi Companion
    window.dispatchEvent(new CustomEvent('companion-wake-up-request'));
  });

  const handleFollowMe = createActionHandler(() => {
    if (window.blobbiCompanion?.toggleMovementMode) {
      window.blobbiCompanion.toggleMovementMode();
    }
  });

  if (!shouldShow) return null;

  const iconSrc = resolvedTheme === 'dark' ? blobWhite : blobBlack;

  // Check if Blobbi is sleeping to determine bed action availability
  const isBlobbiSleeping = companionData?.blobbi?.isSleeping || false;
  const canRemoveBed = isBedVisible && !isBlobbiSleeping;
  
  const menuItems = [
    { icon: '🍽️', label: 'Feed Blobbi', action: handleFeedBlobbi, disabled: false },
    { icon: '👁️', label: 'Show/Hide Blobbi', action: handleToggleVisibility, disabled: false },
    { 
      icon: isBedVisible ? '🛏️' : '😴', 
      label: isBedVisible ? (isBlobbiSleeping ? 'Bed Required (Sleeping)' : 'Remove Bed') : 'Show Bed', 
      action: handleSleep,
      disabled: isBedVisible && isBlobbiSleeping
    },
    // Add wake-up option when Blobbi is sleeping
    ...(isBlobbiSleeping ? [{ icon: '☀️', label: 'Wake Up', action: handleWakeUp, disabled: false }] : []),
    { icon: '🚶', label: 'Follow Me', action: handleFollowMe, disabled: false },
  ];

  return (
    <div
      ref={dragRef}
      className={cn(
        "fixed z-[10000] select-none",
        isDraggingState && "cursor-grabbing",
        className
      )}
      style={{
        left: position.x,
        top: position.y,
        touchAction: 'none'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <motion.div
        className={cn(
          "relative w-14 h-14 rounded-full shadow-lg",
          "bg-white dark:bg-gray-800 border-2 border-purple-200 dark:border-purple-600",
          "hover:shadow-xl transition-shadow duration-200",
          isDraggingState ? "cursor-grabbing scale-110" : "cursor-grab"
        )}
        whileHover={{ scale: isDraggingState ? 1.1 : 1.05 }}
        whileTap={{ scale: isDraggingState ? 1.1 : 0.95 }}
        animate={{
          scale: isDraggingState ? 1.1 : 1,
          rotate: isMenuOpen ? 180 : 0
        }}
        transition={{ duration: 0.2 }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <img 
            src={iconSrc} 
            alt="Blobbi" 
            className="w-8 h-8 object-contain"
            draggable={false}
          />
        </div>
        {!isDraggingState && (
          <motion.div
            className="absolute inset-0 rounded-full bg-purple-400 dark:bg-purple-500 opacity-20"
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.1, 0.2] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            className={cn(
              "absolute flex gap-2 p-2 rounded-lg",
              "bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm",
              "border border-purple-200 dark:border-purple-600 shadow-lg",
              isMobile ? "flex-col top-16 left-0" : "flex-row top-0 left-16"
            )}
            initial={{ opacity: 0, scale: 0.8, x: isMobile ? 0 : -10, y: isMobile ? -10 : 0 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: isMobile ? 0 : -10, y: isMobile ? -10 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {menuItems.map((item, index) => (
              <motion.button
                key={item.label}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md",
                  "text-sm font-medium transition-colors duration-150",
                  isMobile ? "justify-start min-w-[140px]" : "justify-center min-w-[40px]",
                  item.disabled 
                    ? "text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-60" 
                    : "text-gray-700 dark:text-gray-200 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                )}
                onClick={item.disabled ? undefined : item.action}
                disabled={item.disabled}
                initial={{ opacity: 0, x: isMobile ? -20 : 0, y: isMobile ? 0 : -20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.15 }}
                whileHover={item.disabled ? {} : { scale: 1.05 }}
                whileTap={item.disabled ? {} : { scale: 0.95 }}
                title={item.label}
              >
                <span className={cn(
                  "text-lg",
                  item.disabled && "grayscale"
                )}>{item.icon}</span>
                {isMobile && <span>{item.label}</span>}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}