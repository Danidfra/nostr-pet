import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BlobbiAction, Blobbi, BlobbiInteractionType } from '@/types/blobbi';
import { Utensils, Gamepad2, Bath, Moon, Sun, Pill, Trophy, Thermometer, Eye, Music, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { BlobbiInventoryModal } from './BlobbiInventoryModal';

// Helper function to check if an action is available (not on cooldown)
function isActionAvailable(action: BlobbiAction, lastActionTime: number, currentTime: number): boolean {
  const cooldownDuration = {
    feed: 30 * 60 * 1000,      // 30 minutes
    play: 15 * 60 * 1000,      // 15 minutes
    clean: 60 * 60 * 1000,     // 1 hour
    rest: 4 * 60 * 60 * 1000,  // 4 hours
    warming: 10 * 60 * 1000,   // 10 minutes
    checking: 5 * 60 * 1000,   // 5 minutes
    singing: 20 * 60 * 1000,   // 20 minutes
    talking: 10 * 60 * 1000,   // 10 minutes
    medicine: 2 * 60 * 60 * 1000, // 2 hours
  }[action];
  
  return (currentTime - lastActionTime) >= cooldownDuration;
}

interface BlobbiActionsProps {
  blobbi: Blobbi;
  onAction: (action: BlobbiAction) => void;
  isPerformingAction: boolean;
  className?: string;
  onGamesClick?: () => void;
  lifecycleStatus?: {
    isEligibleForEvolution: boolean;
    evolutionStatus?: {
      isReady: boolean;
      message: string;
    };
  };
  onEvolution?: () => void;
}

export function BlobbiActions({ 
  blobbi, 
  onAction, 
  isPerformingAction, 
  className, 
  onGamesClick,
  lifecycleStatus,
  onEvolution 
}: BlobbiActionsProps) {
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<BlobbiAction | null>(null);
  const [lastActions, setLastActions] = useState<Record<BlobbiAction, number>>({
    feed: 0,
    play: 0,
    clean: 0,
    rest: 0,
    warming: 0,
    checking: 0,
    singing: 0,
    talking: 0,
    medicine: 0,
  });
  
  const [cooldowns, setCooldowns] = useState<Record<BlobbiAction, number>>({
    feed: 0,
    play: 0,
    clean: 0,
    rest: 0,
    warming: 0,
    checking: 0,
    singing: 0,
    talking: 0,
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
              rest: 4 * 60 * 60 * 1000,
              warming: 10 * 60 * 1000,
              checking: 5 * 60 * 1000,
              singing: 20 * 60 * 1000,
              talking: 10 * 60 * 1000,
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
    // For actions that can use items, open the inventory modal
    if (['feed', 'play', 'clean', 'medicine'].includes(action)) {
      setSelectedAction(action);
      setInventoryModalOpen(true);
    } else {
      // For other actions, perform directly
      onAction(action);
      setLastActions(prev => ({ ...prev, [action]: Date.now() }));
    }
  };
  
  const handleInventoryClose = () => {
    setInventoryModalOpen(false);
    setSelectedAction(null);
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
  
  const getActionsForStage = () => {
    if (blobbi.lifeStage === 'egg') {
      return [
        {
          action: 'warming' as BlobbiAction,
          icon: Thermometer,
          label: 'Warm',
          color: 'hover:bg-orange-100',
          disabled: false,
          tooltip: 'Keep the egg warm',
        },
        {
          action: 'checking' as BlobbiAction,
          icon: Eye,
          label: 'Check',
          color: 'hover:bg-blue-100',
          disabled: false,
          tooltip: 'Check on the egg',
        },
        {
          action: 'singing' as BlobbiAction,
          icon: Music,
          label: 'Sing',
          color: 'hover:bg-purple-100',
          disabled: false,
          tooltip: 'Sing to the egg',
        },
        {
          action: 'talking' as BlobbiAction,
          icon: MessageCircle,
          label: 'Talk',
          color: 'hover:bg-green-100',
          disabled: false,
          tooltip: 'Talk to the egg',
        },
      ];
    }
    
    // Baby and Adult actions
    return [
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
        disabled: blobbi.stats.hygiene > 90 || blobbi.state === 'sleeping',
        tooltip: blobbi.stats.hygiene > 90 ? 'Already clean!' : blobbi.state === 'sleeping' ? 'Blobbi is sleeping' : '',
      },
      {
        action: 'rest' as BlobbiAction,
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
  };
  
  const actions = getActionsForStage();
  
  return (
    <>
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
            
            {/* Games Button - only for baby and adult */}
            {blobbi.lifeStage !== 'egg' && (
              <Button
                variant="outline"
                size="sm"
                onClick={onGamesClick}
                disabled={isPerformingAction}
                className={cn(
                  'flex flex-col gap-1 h-auto py-3 relative',
                  !isPerformingAction && 'hover:bg-purple-100'
                )}
              >
                <Trophy className="w-5 h-5" />
                <span className="text-xs">Games</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {selectedAction && (
        <BlobbiInventoryModal
          isOpen={inventoryModalOpen}
          onClose={handleInventoryClose}
          actionType={selectedAction}
        />
      )}
    </>
  );
}