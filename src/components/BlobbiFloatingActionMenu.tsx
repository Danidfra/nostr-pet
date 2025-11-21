import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BlobbiSettingsModal } from './BlobbiSettingsModal';
import { BlobbiInventoryModal } from './blobbi/BlobbiInventoryModal';
import { BlobbiShop } from './blobbi/BlobbiShop';
import { useCurrentCompanion } from '@/hooks/useCurrentCompanion';
import { useBed } from '@/contexts/BedContext';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';

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
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPlayModalOpen, setIsPlayModalOpen] = useState(false);
  const [isMedicineModalOpen, setIsMedicineModalOpen] = useState(false);
  const [isCleaningModalOpen, setIsCleaningModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const [isPlayModeActive, setIsPlayModeActive] = useState(false);
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [shopDefaultTab, setShopDefaultTab] = useState('food');
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

  // ✅ NEW: Listen for play mode state changes
  useEffect(() => {
    const handleToyPlaced = () => {
      setIsPlayModeActive(true);
    };

    const handleToyInteractionEnded = () => {
      setIsPlayModeActive(false);
    };

    window.addEventListener('toy-placed', handleToyPlaced);
    window.addEventListener('companion-toy-interaction-ended', handleToyInteractionEnded);

    return () => {
      window.removeEventListener('toy-placed', handleToyPlaced);
      window.removeEventListener('companion-toy-interaction-ended', handleToyInteractionEnded);
    };
  }, []);

  // ✅ NEW: Manage body class for play mode
  useEffect(() => {
    if (isPlayModeActive) {
      document.body.classList.add('play-mode-active');
    } else {
      document.body.classList.remove('play-mode-active');
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('play-mode-active');
    };
  }, [isPlayModeActive]);

  // ✅ NEW: Listen for global shop open events
  useEffect(() => {
    const handleOpenShop = (event: CustomEvent) => {
      const { defaultTab = 'food' } = event.detail || {};
      setShopDefaultTab(defaultTab);
      setIsShopModalOpen(true);
    };

    window.addEventListener('open-shop', handleOpenShop as EventListener);

    return () => {
      window.removeEventListener('open-shop', handleOpenShop as EventListener);
    };
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

  const handleOpenSettings = createActionHandler(() => {
    setIsSettingsModalOpen(true);
  });

  // ✅ NEW: Handle stop playing action
  const handleStopPlaying = createActionHandler(() => {
    // Trigger toy removal event to companion
    window.dispatchEvent(new CustomEvent('toy-remove-request'));
    setIsPlayModeActive(false);
  });

  const handleOpenPlay = createActionHandler(() => {
    setIsPlayModalOpen(true);
  });

  const handlePlayModalClose = (actionPerformed?: boolean) => {
    setIsPlayModalOpen(false);
    if (actionPerformed) {

    }
  };

  const handleOpenMedicine = createActionHandler(() => {
    setIsMedicineModalOpen(true);
  });

  const handleMedicineModalClose = (actionPerformed?: boolean) => {
    setIsMedicineModalOpen(false);
    // If an action was performed, we could add additional logic here if needed
    if (actionPerformed) {
      // The fake status system will handle the UI updates automatically

    }
  };

  const handleOpenCleaning = createActionHandler(() => {
    setIsCleaningModalOpen(true);
  });

  const handleCleaningModalClose = (actionPerformed?: boolean) => {
    setIsCleaningModalOpen(false);
    // If an action was performed, we could add additional logic here if needed
    if (actionPerformed) {
      // The fake status system will handle the UI updates automatically

    }
  };

  if (!shouldShow || !companionData?.blobbi?.id) return null;

  const iconSrc = resolvedTheme === 'dark' ? '/blobbi-white.svg' : '/blobbi-black.svg';

  // Check if Blobbi is sleeping to determine bed action availability
  const isBlobbiSleeping = companionData?.blobbi?.isSleeping || false;
  const canRemoveBed = isBedVisible && !isBlobbiSleeping;

  const menuItems = [
    { icon: '🍽️', label: 'Feed Blobbi', action: handleFeedBlobbi, disabled: isPlayModeActive || isBlobbiSleeping },
    // ✅ UPDATED: Show "Play with Blobbi" or "Stop Playing" based on play mode state
    ...(isPlayModeActive
      ? [{ icon: '🛑', label: 'Stop Playing', action: handleStopPlaying, disabled: false }]
      : [{ icon: '🎾', label: 'Play with Blobbi', action: handleOpenPlay, disabled: isBlobbiSleeping }]
    ),
    { icon: '💊', label: 'Medicine', action: handleOpenMedicine, disabled: isPlayModeActive || isBlobbiSleeping },
    { icon: '🧼', label: 'Clean Blobbi', action: handleOpenCleaning, disabled: isPlayModeActive || isBlobbiSleeping },
    { icon: '👁️', label: 'Show/Hide Blobbi', action: handleToggleVisibility, disabled: isPlayModeActive || isBlobbiSleeping },
    {
      icon: isBedVisible ? '🛏️' : '😴',
      label: isBedVisible ? (isBlobbiSleeping ? 'Bed Required (Sleeping)' : 'Remove Bed') : 'Show Bed',
      action: handleSleep,
      disabled: isPlayModeActive || (isBedVisible && isBlobbiSleeping)
    },
    // Add wake-up option when Blobbi is sleeping
    ...(isBlobbiSleeping ? [{ icon: '☀️', label: 'Wake Up', action: handleWakeUp, disabled: isPlayModeActive }] : []),
    { icon: '🚶', label: 'Follow Me', action: handleFollowMe, disabled: isPlayModeActive || isBlobbiSleeping },
    {
      icon: (
        <img
          src={resolvedTheme === 'dark' ? '/blobbi-white.svg' : '/blobbi-black.svg'}
          alt="Settings"
          className="w-5 h-5"
        />
      ),
      label: 'Settings',
      action: handleOpenSettings,
      disabled: isPlayModeActive || isBlobbiSleeping,
    },
  ];

  return (
    <>

      <div
        ref={dragRef}
        data-floating-menu="true"
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
          style={{
            // ✅ FIXED: Let CSS handle cursor behavior during play mode
            ...(isPlayModeActive ? {} : {
              cursor: isDraggingState ? 'grabbing' : 'grab'
            })
          }}
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
              {menuItems.map((item, index) => {
                // ✅ NEW: During play mode, only allow "Stop Playing" button to be interactive
                const isStopPlayingButton = item.label === 'Stop Playing';
                const isInteractiveInPlayMode = !isPlayModeActive || isStopPlayingButton;
                const effectivelyDisabled = item.disabled || (isPlayModeActive && !isStopPlayingButton);

                return (
                  <motion.button
                    key={item.label}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md",
                      "text-sm font-medium transition-colors duration-150",
                      isMobile ? "justify-start min-w-[140px]" : "justify-center min-w-[40px]",
                      effectivelyDisabled
                        ? "text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-60"
                        : "text-gray-700 dark:text-gray-200 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                    )}
                    onClick={effectivelyDisabled ? undefined : item.action}
                    disabled={effectivelyDisabled}
                    style={{
                      // ✅ FIXED: Let CSS handle cursor behavior during play mode
                      ...(isPlayModeActive ? {} : {
                        cursor: effectivelyDisabled ? 'default' : 'pointer'
                      })
                    }}
                    initial={{ opacity: 0, x: isMobile ? -20 : 0, y: isMobile ? 0 : -20 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.15 }}
                    whileHover={effectivelyDisabled ? {} : { scale: 1.05 }}
                    whileTap={effectivelyDisabled ? {} : { scale: 0.95 }}
                    title={item.label}
                  >
                    <span className={cn(
                      "text-lg",
                      effectivelyDisabled && "grayscale"
                    )}>{item.icon}</span>
                    {isMobile && <span>{item.label}</span>}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <BlobbiSettingsModal
        blobbiId={companionData.blobbi.id}
        isOpen={isSettingsModalOpen}
        onOpenChange={setIsSettingsModalOpen}
      />
      <BlobbiInventoryModal
        isOpen={isPlayModalOpen}
        onClose={handlePlayModalClose}
        actionType="play"
        blobbi={companionData?.blobbi || undefined}
        isCompanionContext={true}
        onOpenShop={() => {
          setShopDefaultTab('toys');
          setIsShopModalOpen(true);
        }}
      />
      <BlobbiInventoryModal
        isOpen={isMedicineModalOpen}
        onClose={handleMedicineModalClose}
        actionType="medicine"
        blobbi={companionData?.blobbi || undefined}
        isCompanionContext={true}
        onOpenShop={() => {
          setShopDefaultTab('medicine');
          setIsShopModalOpen(true);
        }}
      />
      <BlobbiInventoryModal
        isOpen={isCleaningModalOpen}
        onClose={handleCleaningModalClose}
        actionType="clean"
        blobbi={companionData?.blobbi || undefined}
        isCompanionContext={true}
        onOpenShop={() => {
          setShopDefaultTab('hygiene');
          setIsShopModalOpen(true);
        }}
      />
      <BlobbiShop
        isOpen={isShopModalOpen}
        onClose={() => setIsShopModalOpen(false)}
        defaultTab={shopDefaultTab}
      />
    </>
  );
}
