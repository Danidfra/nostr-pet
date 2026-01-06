import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FloatingMenuModal } from './FloatingMenuModal';

interface Position {
  x: number;
  y: number;
}

const STORAGE_KEY = 'blobbi-fab-position';
const DEFAULT_POSITION: Position = { x: window.innerWidth - 76, y: 16 }; // top-right with margin
const FAB_SIZE = 56; // h-14 w-14 = 56px

function parsePosition(stored: string | null): Position {
  if (!stored) return DEFAULT_POSITION;

  try {
    const parsed = JSON.parse(stored) as unknown;

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'x' in parsed &&
      'y' in parsed &&
      typeof (parsed as { x: unknown }).x === 'number' &&
      typeof (parsed as { y: unknown }).y === 'number'
    ) {
      return parsed as Position;
    }

    return DEFAULT_POSITION;
  } catch {
    return DEFAULT_POSITION;
  }
}

function clampPosition(pos: Position): Position {
  const margin = 16; // Minimum margin from edges
  const maxX = window.innerWidth - FAB_SIZE - margin;
  const maxY = window.innerHeight - FAB_SIZE - margin;

  return {
    x: Math.max(margin, Math.min(pos.x, maxX)),
    y: Math.max(margin, Math.min(pos.y, maxY)),
  };
}

interface FloatingMenuButtonProps {
  coinBalance: number;
  onOpenShop: () => void;
  onOpenStats: () => void;
  onOpenMissions: () => void;
  className?: string;
}

export function FloatingMenuButton({
  coinBalance,
  onOpenShop,
  onOpenStats,
  onOpenMissions,
  className,
}: FloatingMenuButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Position>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return clampPosition(parsePosition(stored));
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [dragStartTime, setDragStartTime] = useState(0);

  const buttonRef = useRef<HTMLButtonElement>(null);

  // Save position to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  }, [position]);

  // Clamp position on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition(prevPos => clampPosition(prevPos));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Don't start drag if clicking to open menu when already open
    if (isOpen) return;

    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    setDragStartTime(Date.now());

    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;

    e.preventDefault();
    e.stopPropagation();

    const newPos = {
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    };

    setPosition(clampPosition(newPos));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;

    e.preventDefault();
    e.stopPropagation();

    const dragDuration = Date.now() - dragStartTime;
    const wasDragged = dragDuration > 150; // If dragged for more than 150ms, consider it a drag not a click

    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    // If it was a quick tap (not a drag), open the menu
    if (!wasDragged) {
      setIsOpen(true);
    }
  };

  return (
    <>
      {/* Floating Action Button - Draggable */}
      <Button
        ref={buttonRef}
        size="icon"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={cn(
          "fixed z-50 touch-none",
          "h-14 w-14 rounded-full shadow-lg",
          "bg-gradient-to-br from-purple-500 to-pink-500",
          "hover:from-purple-600 hover:to-pink-600",
          "border-2 border-white/20",
          "transition-transform duration-200 hover:scale-110",
          isDragging ? "cursor-grabbing scale-110" : "cursor-grab",
          className
        )}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6 text-white" />
      </Button>

      {/* Menu Modal */}
      <FloatingMenuModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        coinBalance={coinBalance}
        onOpenShop={onOpenShop}
        onOpenStats={onOpenStats}
        onOpenMissions={onOpenMissions}
      />
    </>
  );
}
