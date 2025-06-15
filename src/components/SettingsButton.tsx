import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { SettingsModal } from './SettingsModal';
import { cn } from '@/lib/utils';

interface SettingsButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showLabel?: boolean;
}

export function SettingsButton({ 
  variant = 'ghost', 
  size = 'icon', 
  className,
  showLabel = false 
}: SettingsButtonProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsSettingsOpen(true)}
        className={cn(
          // Enhanced styling for Aresto design system
          "relative transition-all duration-200 ease-in-out",
          "hover:shadow-elegant hover:scale-105",
          "active:scale-95",
          "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
          // Warm glow on hover for icon variant
          size === 'icon' && "hover:glow-warm",
          className
        )}
        title="Settings"
      >
        <Settings className={cn(
          "transition-transform duration-200",
          "group-hover:rotate-12",
          showLabel ? "w-4 h-4" : "w-4 h-4"
        )} />
        {showLabel && (
          <span className="ml-2 font-medium">Settings</span>
        )}
      </Button>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}