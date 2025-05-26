import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BlobbiAction, Blobbi } from '@/types/blobbi';
import { Utensils, Gamepad2, Bath, Moon, Sun, Pill } from 'lucide-react';
import { useState, useEffect } from 'react';
import { isActionAvailable } from '@/lib/blobbi';
import { cn } from '@/lib/utils';

interface BlobbiActionsProps {
  blobbi: Blobbi;
  onAction: (action: BlobbiAction) => void;
  isPerformingAction: boolean;
  className?: string;
}

export function BlobbiActions({ blobbi, onAction, isPerformingAction, className }: BlobbiActionsProps) {
  const [lastActions, setLastActions] = useState<Record<BlobbiAction, number>>({
    feed: 0,
    play: 0,
    clean: 0,
    sleep: 0,
    wake: 0,
    medicine: 0,
  });
  
  const [cooldowns, setCooldowns] = useState<Record<BlobbiAction, number>>({
    feed: 0,
    play: 0,
    clean: 0,
    sleep: 0,
    wake: 0,
    medicine: 0,
  });
  
  // Update cooldowns every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCooldowns(prev => {
        const updated = { ...prev };
        for (const action in updated) {
          const key = action as BlobbiAction;
          const lastTime = lastActions[key];
          if (lastTime && !isActionAvailable(key, lastTime, now)) {
            const cooldownDuration = {
              feed: 30 * 60 * 1000,
              play: 15 * 60 * 1000,
              clean: 60 * 60 * 1000,
              sleep: 4 * 60 * 60 * 1000,
              wake: 0,
              medicine: 2 * 60 * 60 * 1000,
            }[key];
            updated[key] = Math.ceil((cooldownDuration - (now - lastTime)) / 1000);
          } else {
            updated[key] = 0;
          }
        }
        return updated;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [lastActions]);
  
  const handleAction = (action: BlobbiAction) => {
    onAction(action);
    setLastActions(prev => ({ ...prev, [action]: Date.now() }));
  };
  
  const formatCooldown = (seconds: number) => {
    if (seconds <= 0) return '';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };
  
  const actions = [
    {
      action: 'feed' as BlobbiAction,
      icon: Utensils,
      label: 'Feed',
      color: 'hover:bg-orange-100',
      disabled: blobbi.stats.hunger > 90 || blobbi.state === 'sleeping',
      tooltip: blobbi.stats.hunger > 90 ? 'Already full!' : blobbi.state === 'sleeping' ? 'Blobbi is sleeping' : '',
    },
    {
      action: 'play' as BlobbiAction,
      icon: Gamepad2,
      label: 'Play',
      color: 'hover:bg-yellow-100',
      disabled: blobbi.stats.energy < 20 || blobbi.state === 'sleeping',
      tooltip: blobbi.stats.energy < 20 ? 'Too tired to play' : blobbi.state === 'sleeping' ? 'Blobbi is sleeping' : '',
    },
    {
      action: 'clean' as BlobbiAction,
      icon: Bath,
      label: 'Clean',
      color: 'hover:bg-purple-100',
      disabled: blobbi.stats.cleanliness > 90 || blobbi.state === 'sleeping',
      tooltip: blobbi.stats.cleanliness > 90 ? 'Already clean!' : blobbi.state === 'sleeping' ? 'Blobbi is sleeping' : '',
    },
    {
      action: blobbi.state === 'sleeping' ? 'wake' as BlobbiAction : 'sleep' as BlobbiAction,
      icon: blobbi.state === 'sleeping' ? Sun : Moon,
      label: blobbi.state === 'sleeping' ? 'Wake' : 'Sleep',
      color: 'hover:bg-blue-100',
      disabled: blobbi.state === 'sleeping' ? false : blobbi.stats.energy > 70,
      tooltip: blobbi.state !== 'sleeping' && blobbi.stats.energy > 70 ? 'Not tired yet' : '',
    },
    {
      action: 'medicine' as BlobbiAction,
      icon: Pill,
      label: 'Medicine',
      color: 'hover:bg-red-100',
      disabled: blobbi.stats.health > 70,
      tooltip: blobbi.stats.health > 70 ? 'Already healthy!' : '',
    },
  ];
  
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map(({ action, icon: Icon, label, color, disabled, tooltip }) => {
            const cooldown = cooldowns[action];
            const isOnCooldown = cooldown > 0;
            const isDisabled = disabled || isOnCooldown || isPerformingAction;
            
            return (
              <Button
                key={action}
                variant="outline"
                size="sm"
                onClick={() => handleAction(action)}
                disabled={isDisabled}
                className={cn(
                  'flex flex-col gap-1 h-auto py-3 relative',
                  !isDisabled && color
                )}
                title={tooltip || (isOnCooldown ? `Cooldown: ${formatCooldown(cooldown)}` : '')}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs">{label}</span>
                {isOnCooldown && (
                  <span className="absolute -top-1 -right-1 text-[10px] bg-background px-1 rounded border">
                    {formatCooldown(cooldown)}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}