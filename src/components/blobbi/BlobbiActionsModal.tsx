import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BlobbiAction, Blobbi } from '@/types/blobbi';
import { Utensils, Gamepad2, Bath, Moon, Sun, Pill, Trophy, Thermometer, Eye, Music, MessageCircle, Heart, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isActionAvailableForStage } from '@/lib/cooldown-storage';

interface ActionConfig {
  action: BlobbiAction;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  disabled: boolean;
  tooltip: string;
}

interface BlobbiActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  blobbi: Blobbi;
  onAction: (action: BlobbiAction) => void;
  actionInProgress: BlobbiAction | null;
  isSleeping: boolean;
  canSleep: boolean;
  canWakeUp: boolean;
}

export function BlobbiActionsModal({
  isOpen,
  onClose,
  blobbi,
  onAction,
  actionInProgress,
  isSleeping,
  canSleep,
  canWakeUp,
}: BlobbiActionsModalProps) {
  const getActionsForStage = (): ActionConfig[] => {
    if (blobbi.lifeStage === 'egg') {
      return [
        {
          action: 'warm' as BlobbiAction,
          icon: Thermometer,
          label: 'Warm',
          color: 'hover:bg-orange-100 dark:hover:bg-orange-900/20',
          disabled: false,
          tooltip: 'Keep the egg warm',
        },
        {
          action: 'check' as BlobbiAction,
          icon: Eye,
          label: 'Check',
          color: 'hover:bg-blue-100 dark:hover:bg-blue-900/20',
          disabled: false,
          tooltip: 'Check on the egg',
        },
        {
          action: 'sing' as BlobbiAction,
          icon: Music,
          label: 'Sing',
          color: 'hover:bg-purple-100 dark:hover:bg-purple-900/20',
          disabled: false,
          tooltip: 'Sing to the egg',
        },
        {
          action: 'talk' as BlobbiAction,
          icon: MessageCircle,
          label: 'Talk',
          color: 'hover:bg-green-100 dark:hover:bg-green-900/20',
          disabled: false,
          tooltip: 'Talk to the egg',
        },
      ];
    }

    const baseActions: ActionConfig[] = [
      {
        action: 'feed' as BlobbiAction,
        icon: Utensils,
        label: 'Feed',
        color: 'hover:bg-orange-100 dark:hover:bg-orange-900/20',
        disabled: blobbi.stats.hunger > 90 || blobbi.state === 'sleeping',
        tooltip: blobbi.stats.hunger > 90 ? 'Already full!' : blobbi.state === 'sleeping' ? 'Blobbi is sleeping' : 'Feed your Blobbi',
      },
      {
        action: 'play' as BlobbiAction,
        icon: Gamepad2,
        label: 'Play',
        color: 'hover:bg-yellow-100 dark:hover:bg-yellow-900/20',
        disabled: blobbi.stats.energy < 20 || blobbi.state === 'sleeping',
        tooltip: blobbi.stats.energy < 20 ? 'Too tired to play' : blobbi.state === 'sleeping' ? 'Blobbi is sleeping' : 'Play with your Blobbi',
      },
      {
        action: 'clean' as BlobbiAction,
        icon: Bath,
        label: 'Clean',
        color: 'hover:bg-purple-100 dark:hover:bg-purple-900/20',
        disabled: blobbi.state === 'sleeping',
        tooltip: blobbi.state === 'sleeping' ? 'Blobbi is sleeping' : 'Clean your Blobbi',
      },
      {
        action: 'rest' as BlobbiAction,
        icon: isSleeping ? Sun : Moon,
        label: isSleeping ? 'Wake' : 'Sleep',
        color: 'hover:bg-blue-100 dark:hover:bg-blue-900/20',
        disabled: isSleeping ? !canWakeUp : !canSleep || blobbi.stats.energy > 70,
        tooltip: isSleeping ? (canWakeUp ? 'Wake up your Blobbi' : 'Cannot wake up') : (blobbi.stats.energy > 70 ? 'Not tired yet' : 'Put your Blobbi to sleep'),
      },
      {
        action: 'medicine' as BlobbiAction,
        icon: Pill,
        label: 'Medicine',
        color: 'hover:bg-red-100 dark:hover:bg-red-900/20',
        disabled: false,
        tooltip: 'Give medicine to your Blobbi',
      },
    ];

    if (blobbi.lifeStage === 'adult') {
      baseActions.push({
        action: 'cruzar' as BlobbiAction,
        icon: Heart,
        label: 'Breed',
        color: 'hover:bg-pink-100 dark:hover:bg-pink-900/20',
        disabled: true,
        tooltip: 'Breeding feature coming soon',
      });
    }

    return baseActions;
  };

  const actions = getActionsForStage();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </div>
            <span className="truncate">Actions for {blobbi.name}</span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-8rem)]">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pr-2">
            {actions.map(({ action, icon: Icon, label, color, disabled, tooltip }) => {
              const isAvailableForStage = isActionAvailableForStage(action, blobbi.lifeStage);
              const isThisActionInProgress = actionInProgress === action;
              const isDisabled = !isAvailableForStage || disabled || !!actionInProgress;

              let actionTooltip = tooltip;
              if (!isAvailableForStage) {
                actionTooltip = `Not available in ${blobbi.lifeStage} stage`;
              }

              return (
                <Button
                  key={action}
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    onAction(action);
                    // Close modal after action is triggered
                    if (!isDisabled) {
                      onClose();
                    }
                  }}
                  disabled={isDisabled}
                  className={cn(
                    'flex flex-col items-center gap-2 h-auto py-4 rounded-xl transition-all duration-200',
                    !isDisabled && isAvailableForStage && color,
                    !isAvailableForStage && 'opacity-50'
                  )}
                  title={actionTooltip}
                >
                  {isThisActionInProgress ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    <Icon className="w-8 h-8" />
                  )}
                  <span className="text-sm font-medium">{label}</span>
                </Button>
              );
            })}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t border-purple-200/50 dark:border-purple-600/50">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full h-11 rounded-xl border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
