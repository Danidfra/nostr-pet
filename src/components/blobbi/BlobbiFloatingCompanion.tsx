import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Blobbi } from '@/types/blobbi';
import { BlobbiVisual } from './BlobbiVisual';
import { BlobbiEvolvedVisual } from './BlobbiEvolvedVisual';
import { cn } from '@/lib/utils';

interface BlobbiFloatingCompanionProps {
  blobbi: Blobbi;
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Fallback floating companion for browsers without PiP support
 * A draggable, always-on-top widget showing Blobbi
 */
export function BlobbiFloatingCompanion({ blobbi, isVisible, onClose }: BlobbiFloatingCompanionProps) {
  const [position, setPosition] = useState({ x: window.innerWidth - 250, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [timeAwaySeconds, setTimeAwaySeconds] = useState(0);
  const [showMessage, setShowMessage] = useState(false);
  const [message, setMessage] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Track time away
  useEffect(() => {
    if (!isVisible) {
      setTimeAwaySeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setTimeAwaySeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  // Handle mouse down to start dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  // Handle mouse move while dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(0, Math.min(window.innerWidth - 200, e.clientX - dragOffset.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 250, e.clientY - dragOffset.y));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Handle Blobbi click
  const handleBlobbiClick = () => {
    const messages = [
      "👋 Miss me?",
      "💜 Come back soon!",
      "🎮 Ready to play?",
      "✨ I'm still here!",
      "🌟 Don't forget about me!",
    ];

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    setMessage(randomMessage);
    setShowMessage(true);

    setTimeout(() => {
      setShowMessage(false);
    }, 2000);
  };

  // Determine behavior based on time away
  const getBehaviorMessage = () => {
    if (timeAwaySeconds < 30) return 'Just chilling...';
    if (timeAwaySeconds < 120) return 'Getting sleepy...';
    return 'Missing you...';
  };

  if (!isVisible) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed z-[9999] rounded-2xl shadow-2xl transition-opacity duration-300",
        "bg-gradient-to-br from-purple-500 to-pink-500",
        "border-2 border-white/20",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '200px',
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
        style={{ cursor: 'pointer' }}
      >
        <X className="w-4 h-4" />
      </button>

      {/* Message bubble */}
      {showMessage && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap animate-bounce">
          {message}
        </div>
      )}

      {/* Content */}
      <div className="p-4 flex flex-col items-center gap-2">
        {/* Blobbi */}
        <div
          onClick={handleBlobbiClick}
          className="cursor-pointer hover:scale-105 transition-transform"
        >
          {blobbi.evolutionForm ? (
            <BlobbiEvolvedVisual
              blobbi={blobbi}
              size="small"
            />
          ) : (
            <BlobbiVisual
              blobbi={blobbi}
              size="small"
              forceInlineSvg={true}
            />
          )}
        </div>

        {/* Info */}
        <div className="text-center text-white text-shadow">
          <div className="font-bold text-sm">{blobbi.name}</div>
          <div className="text-xs opacity-90">{getBehaviorMessage()}</div>
          {timeAwaySeconds > 60 && (
            <div className="text-xs opacity-70 mt-1">
              Away {Math.floor(timeAwaySeconds / 60)}m {timeAwaySeconds % 60}s
            </div>
          )}
        </div>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/30 animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      <style>
        {`
          @keyframes float {
            0%, 100% {
              transform: translateY(0) translateX(0);
              opacity: 0;
            }
            10% {
              opacity: 1;
            }
            90% {
              opacity: 1;
            }
            50% {
              transform: translateY(-200px) translateX(20px);
            }
          }

          .animate-float {
            animation: float 8s infinite ease-in-out;
          }
        `}
      </style>
    </div>
  );
}
