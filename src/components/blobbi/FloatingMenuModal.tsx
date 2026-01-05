import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Coins,
  ShoppingBag,
  Package,
  Target,
  Sparkles,
  BarChart3,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  coinBalance: number;
  onOpenShop: () => void;
  onOpenStorage: () => void;
  onOpenStats: () => void;
  onOpenMissions: () => void;
  onOpenBlobbiSelector: () => void;
}

export function FloatingMenuModal({
  isOpen,
  onClose,
  coinBalance,
  onOpenShop,
  onOpenStorage,
  onOpenStats,
  onOpenMissions,
  onOpenBlobbiSelector,
}: FloatingMenuModalProps) {
  const handleMenuAction = (action: () => void) => {
    action();
    onClose();
  };

  const menuItems = [
    {
      icon: Sparkles,
      label: 'Switch Blobbi',
      action: onOpenBlobbiSelector,
      color: 'purple',
    },
    {
      icon: ShoppingBag,
      label: 'Shop',
      action: onOpenShop,
      color: 'blue',
    },
    {
      icon: Package,
      label: 'Storage',
      action: onOpenStorage,
      color: 'green',
    },
    {
      icon: BarChart3,
      label: 'Stats',
      action: onOpenStats,
      color: 'orange',
    },
    {
      icon: Target,
      label: 'Missions',
      action: onOpenMissions,
      color: 'red',
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <Menu className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </div>
            <span>Game Menu</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Coins Display */}
          <div className="flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-full border border-yellow-200 dark:border-yellow-700">
            <Coins className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <span className="font-semibold text-base text-yellow-700 dark:text-yellow-300">
              {coinBalance} Coins
            </span>
          </div>

          {/* Menu Items Grid */}
          <div className="grid grid-cols-2 gap-3 pb-2">
            {menuItems.map(({ icon: Icon, label, action, color }) => (
              <button
                key={label}
                onClick={() => handleMenuAction(action)}
                className={cn(
                  "group relative overflow-hidden rounded-xl p-4",
                  "bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-800/80 dark:to-gray-800/40",
                  "border border-purple-200/50 dark:border-purple-600/50",
                  "hover:border-purple-300 dark:hover:border-purple-500",
                  "transition-all duration-200",
                  "hover:scale-105 hover:shadow-lg hover:shadow-purple-200/20 dark:hover:shadow-purple-900/20"
                )}
              >
                <div className="flex flex-col items-center gap-2 relative z-10">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    "bg-gradient-to-br transition-all duration-200",
                    color === 'purple' && "from-purple-500 to-pink-500 group-hover:from-purple-600 group-hover:to-pink-600",
                    color === 'blue' && "from-blue-500 to-cyan-500 group-hover:from-blue-600 group-hover:to-cyan-600",
                    color === 'green' && "from-green-500 to-emerald-500 group-hover:from-green-600 group-hover:to-emerald-600",
                    color === 'orange' && "from-orange-500 to-amber-500 group-hover:from-orange-600 group-hover:to-amber-600",
                    color === 'red' && "from-red-500 to-rose-500 group-hover:from-red-600 group-hover:to-rose-600"
                  )}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {label}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
