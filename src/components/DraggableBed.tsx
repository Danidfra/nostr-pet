import { useState, useEffect, useRef, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useCurrentCompanion } from '@/hooks/useCurrentCompanion';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBlobbiSleepSystem } from '@/hooks/useBlobbiSleepSystem';
import { useToast } from '@/hooks/useToast';

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

interface DraggableBedProps {
  isVisible: boolean;
  onClose?: () => void;
  className?: string;
  onDrop?: (rect: DOMRect) => void;
}

const STORAGE_KEY = 'blobbi-bed-position';
const DRAG_THRESHOLD = 5; // pixels

const getBedDimensions = () => {
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    return { width: 120, height: 80 }; // Smaller size for mobile
  }
  return { width: 220, height: 140 }; // Default size for larger screens
};

const getDefaultPosition = (): Position => {
  const { width, height } = getBedDimensions();
  return {
    x: window.innerWidth - width - 20, // bed width + margin
    y: window.innerHeight - height - 20, // bed height + margin
  };
};

export const DraggableBed = forwardRef<HTMLDivElement, DraggableBedProps>(
  ({ isVisible, onClose, className, onDrop }, ref) => {
    const [position, setPosition] = useState<Position>(getDefaultPosition());
    const [isDraggingState, setIsDraggingState] = useState(false);
    const dragRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef<DragStartInfo | null>(null);
    
    // Hooks for wake-up functionality
    const { data: companionData } = useCurrentCompanion();
    const { user } = useCurrentUser();
    const { toast } = useToast();
    
    // Sleep system hook for the current companion
    const { wakeUp, canWakeUp } = useBlobbiSleepSystem({
      blobbi: companionData?.blobbi || null,
      isOwner: !!user && companionData?.blobbi?.ownerPubkey === user.pubkey
    });

    // Load saved position on mount
    useEffect(() => {
      const savedPosition = localStorage.getItem(STORAGE_KEY);
      if (savedPosition) {
        try {
          const parsed = JSON.parse(savedPosition);
          const { width, height } = getBedDimensions();
          const maxX = window.innerWidth - width;
          const maxY = window.innerHeight - height;
          
          setPosition({
            x: Math.max(0, Math.min(maxX, parsed.x)),
            y: Math.max(0, Math.min(maxY, parsed.y)),
          });
        } catch (error) {
          console.error('Failed to parse saved bed position:', error);
          setPosition(getDefaultPosition());
        }
      }
    }, []);

    // Update position when window resizes to keep bed in bounds
    useEffect(() => {
      const handleResize = () => {
        const { width, height } = getBedDimensions();
        const maxX = window.innerWidth - width;
        const maxY = window.innerHeight - height;
        
        setPosition(prev => ({
          x: Math.max(0, Math.min(maxX, prev.x)),
          y: Math.max(0, Math.min(maxY, prev.y)),
        }));
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    const savePosition = (newPosition: Position) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPosition));
    };

    const handlePointerDown = (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      
      e.preventDefault();
      e.stopPropagation();
      dragRef.current?.setPointerCapture(e.pointerId);
      
      const clientX = e.clientX;
      const clientY = e.clientY;
      
      dragStartRef.current = {
        x: clientX,
        y: clientY,
        startX: position.x,
        startY: position.y,
        isDragging: false,
      };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (!dragStartRef.current) return;

      const clientX = e.clientX;
      const clientY = e.clientY;

      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;

      if (!dragStartRef.current.isDragging && 
          (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
        dragStartRef.current.isDragging = true;
        setIsDraggingState(true);
      }

      if (dragStartRef.current.isDragging) {
        const { width, height } = getBedDimensions();
        const newX = dragStartRef.current.startX + deltaX;
        const newY = dragStartRef.current.startY + deltaY;
        const maxX = window.innerWidth - width;
        const maxY = window.innerHeight - height;

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
        if (onDrop && dragRef.current) {
          onDrop(dragRef.current.getBoundingClientRect());
        }
      } else {
        // Handle click (not drag) - trigger wake-up if companion is sleeping
        handleBedClick();
      }

      dragStartRef.current = null;
      setIsDraggingState(false);
    };

    // Handle bed click for wake-up interaction
    const handleBedClick = async () => {
      // Check if we have a sleeping companion and user is the owner
      if (!companionData?.blobbi || !user) {
        return;
      }

      const blobbi = companionData.blobbi;
      
      // Only trigger wake-up if the companion is sleeping
      if (!blobbi.isSleeping) {
        return;
      }

      // Check if user is the owner
      if (blobbi.ownerPubkey !== user.pubkey) {
        toast({
          title: "Cannot Wake Up",
          description: "You can only wake up your own Blobbi companion.",
          variant: "destructive",
        });
        return;
      }

      // Check if wake-up is available
      if (!canWakeUp) {
        toast({
          title: "Cannot Wake Up",
          description: "Your Blobbi cannot be woken up right now.",
          variant: "destructive",
        });
        return;
      }

      try {
        console.log('🛏️ Bed clicked - triggering wake-up sequence for:', blobbi.name);
        
        // Trigger the wake-up sequence
        await wakeUp();
        
        toast({
          title: "Blobbi Woke Up!",
          description: `${blobbi.name} has been gently woken up from their nap.`,
        });
        
        console.log('✅ Wake-up sequence completed successfully');
      } catch (error) {
        console.error('❌ Failed to wake up Blobbi:', error);
        toast({
          title: "Wake Up Failed",
          description: error instanceof Error ? error.message : "Failed to wake up your Blobbi. Please try again.",
          variant: "destructive",
        });
      }
    };

    if (!isVisible) return null;

    return (
      <motion.div
        ref={dragRef}
        className={cn(
          "fixed z-[9999] select-none",
          isDraggingState ? "cursor-grabbing" : "cursor-grab",
          className
        )}
        style={{
          left: position.x,
          top: position.y,
          touchAction: 'none',
          pointerEvents: 'auto',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: 1, 
          scale: 1,
        }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.3 }}
      >
        <div className="relative" ref={ref}>
          <motion.img 
            src="/bed.png" 
            alt="Blobbi's bed" 
            className={cn(
              "w-[120px] md:w-[220px] object-contain",
              // Add visual feedback for clickable state when companion is sleeping
              companionData?.blobbi?.isSleeping && canWakeUp && "cursor-pointer hover:brightness-110 transition-all"
            )}
            draggable={false}
            animate={{
              y: [0, -2, 0],
            }}
            transition={{
              y: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }
            }}
          />
        </div>
      </motion.div>
    );
  }
);
