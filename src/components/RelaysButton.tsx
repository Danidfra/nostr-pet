import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import { SettingsModal } from './SettingsModal';
import { cn } from '@/lib/utils';

interface RelaysButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function RelaysButton({ 
  variant = 'outline', 
  size = 'icon', 
  className,
}: RelaysButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsModalOpen(true)}
        className={cn(
          "relative transition-all duration-300 ease-in-out",
          "hover:shadow-elegant hover:scale-105 hover:border-purple-300 dark:hover:border-purple-500",
          "active:scale-95",
          "focus-visible:ring-2 focus-visible:ring-purple-400/50 focus-visible:ring-offset-2",
          "bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-purple-200/50 dark:border-purple-600/50",
          className
        )}
        title="Relays"
        aria-label="Open relay settings"
      >
        <Globe className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        <span className="sr-only">Relays</span>
      </Button>

      <SettingsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultTab="relays"
      />
    </>
  );
}
