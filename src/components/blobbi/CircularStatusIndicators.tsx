import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CircularStatusIndicatorsProps {
  stats: {
    hunger: number;
    happiness: number;
    hygiene: number;
    energy: number;
    health: number;
  };
  className?: string;
}

interface StatRingProps {
  label: string;
  value: number;
  color: string;
  icon?: string;
}

function StatRing({ label, value, color, icon }: StatRingProps) {
  const radius = 24; // Reduced from 32 to 24
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  // Determine color based on value
  const getColor = () => {
    if (value >= 70) return color;
    if (value >= 40) return '#FFA500'; // Orange
    return '#EF4444'; // Red
  };

  const strokeColor = getColor();

  return (
    <div className="flex flex-col items-center gap-0.5">
      {/* Circular Progress Ring */}
      <div className="relative w-12 h-12 sm:w-14 sm:h-14">
        <svg viewBox="0 0 56 56" className="transform -rotate-90 w-12 h-12 sm:w-14 sm:h-14">
          {/* Background circle */}
          <circle
            cx="28"
            cy="28"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Progress circle */}
          <circle
            cx="28"
            cy="28"
            r={radius}
            stroke={strokeColor}
            strokeWidth="4"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] sm:text-xs font-bold" style={{ color: strokeColor }}>
            {icon}
          </span>
        </div>
      </div>
      {/* Label */}
      <span className="text-[9px] sm:text-[10px] font-medium text-gray-600 dark:text-gray-400">
        {label}
      </span>
    </div>
  );
}

export function CircularStatusIndicators({ stats, className }: CircularStatusIndicatorsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const statusItems = [
    { label: 'Hunger', value: stats.hunger, color: '#F97316', icon: '🍴' },
    { label: 'Happy', value: stats.happiness, color: '#EAB308', icon: '😊' },
    { label: 'Hygiene', value: stats.hygiene, color: '#06B6D4', icon: '💧' },
    { label: 'Energy', value: stats.energy, color: '#8B5CF6', icon: '⚡' },
    { label: 'Health', value: stats.health, color: '#10B981', icon: '❤️' },
  ];

  return (
    <div className={cn("space-y-2", className)}>
      {/* Status Rings */}
      {isExpanded && (
        <div className="flex justify-center gap-3 flex-wrap">
          {statusItems.map((stat) => (
            <StatRing
              key={stat.label}
              label={stat.label}
              value={stat.value}
              color={stat.color}
              icon={stat.icon}
            />
          ))}
        </div>
      )}

      {/* Toggle Button */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[10px] h-6 text-muted-foreground hover:text-foreground px-2"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3 h-3 mr-1" />
              Hide
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3 mr-1" />
              Show Stats
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
