import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Coins,
  ShoppingBag,
  Package,
  Trophy,
  Target,
  Settings,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Position {
  x: number;
  y: number;
}

interface FloatingDashboardMenuProps {
  coinBalance: number;
  onOpenShop: () => void;
  onOpenStats: () => void;
  onOpenMissions: () => void;
  onOpenQuickActions: () => void;
  className?: string;
}

const STORAGE_KEY = 'blobbi-floating-menu-position';
const DEFAULT_POSITION: Position = { x: 20, y: 20 };

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

function clampPosition(pos: Position, menuWidth: number, menuHeight: number): Position {
  const maxX = window.innerWidth - menuWidth - 20;
  const maxY = window.innerHeight - menuHeight - 20;

  return {
    x: Math.max(20, Math.min(pos.x, maxX)),
    y: Math.max(20, Math.min(pos.y, maxY)),
  };
}

export function FloatingDashboardMenu({
  coinBalance,
  onOpenShop,
  onOpenStats,
  onOpenMissions,
  onOpenQuickActions,
  className,
}: FloatingDashboardMenuProps) {
  const [position, setPosition] = useState<Position>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return parsePosition(stored);
  });

  const [isExpanded, setIsExpanded] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });

  const menuRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  // Save position to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  }, [position]);

  // Clamp position on window resize
  useEffect(() => {
    const handleResize = () => {
      if (menuRef.current) {
        const rect = menuRef.current.getBoundingClientRect();
        const clamped = clampPosition(position, rect.width, rect.height);

        if (clamped.x !== position.x || clamped.y !== position.y) {
          setPosition(clamped);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only allow dragging from the drag handle
    if (!dragHandleRef.current?.contains(e.target as Node)) {
      return;
    }

    e.preventDefault();
    setIsDragging(true);

    const rect = menuRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !menuRef.current) return;

    e.preventDefault();

    const rect = menuRef.current.getBoundingClientRect();
    const newPos = {
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    };

    const clamped = clampPosition(newPos, rect.width, rect.height);
    setPosition(clamped);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      e.preventDefault();
      setIsDragging(false);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-50 touch-none",
        isDragging && "cursor-grabbing",
        className
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <Card className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-2 border-purple-300 dark:border-purple-600 shadow-2xl">
        <CardContent className="p-2 space-y-2">
          {/* Drag Handle Header */}
          <div
            ref={dragHandleRef}
            className={cn(
              "flex items-center justify-between gap-2 px-2 py-1 rounded cursor-grab active:cursor-grabbing",
              "bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors"
            )}
            title="Drag to move menu"
          >
            <GripVertical className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
              Game Menu
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Collapse menu" : "Expand menu"}
            >
              {isExpanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </Button>
          </div>

          {/* Coins Display - Always Visible */}
          <div className="flex items-center gap-2 px-2 py-1.5 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/40 dark:to-amber-900/40 rounded">
            <Coins className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <span className="font-bold text-sm text-yellow-700 dark:text-yellow-300">
              {coinBalance}
            </span>
          </div>

          {/* Expanded Menu Items */}
          {isExpanded && (
            <div className="space-y-1">
              {/* Shop */}
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenShop}
                className="w-full justify-start gap-2 h-8 text-xs"
                title="Open shop"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Shop
              </Button>

              {/* Divider */}
              <div className="border-t border-purple-200 dark:border-purple-700 my-1" />

              {/* Stats */}
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenStats}
                className="w-full justify-start gap-2 h-8 text-xs"
                title="View quick stats"
              >
                <Trophy className="w-3.5 h-3.5" />
                Stats
              </Button>

              {/* Missions */}
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenMissions}
                className="w-full justify-start gap-2 h-8 text-xs"
                title="View daily missions"
              >
                <Target className="w-3.5 h-3.5" />
                Missions
              </Button>

              {/* Quick Actions */}
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenQuickActions}
                className="w-full justify-start gap-2 h-8 text-xs"
                title="Quick actions"
              >
                <Settings className="w-3.5 h-3.5" />
                Actions
              </Button>
            </div>
          )}

          {/* Collapsed State - Show Icon Count */}
          {!isExpanded && (
            <div className="text-center">
              <Badge variant="secondary" className="text-xs">
                4 items
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
