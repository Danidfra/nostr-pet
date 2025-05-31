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
        className={cn(className)}
        title="Settings"
      >
        <Settings className="w-4 h-4" />
        {showLabel && <span className="ml-2">Settings</span>}
      </Button>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}