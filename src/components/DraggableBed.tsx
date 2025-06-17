import { useState, useEffect, useRef, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

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
      }

      dragStartRef.current = null;
      setIsDraggingState(false);
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
            className="w-[120px] md:w-[220px] object-contain"
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
