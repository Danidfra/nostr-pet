import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Package, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlobbiPlaySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChooseToys: () => void;
  onChooseGames: () => void;
  blobbiName?: string;
}

export function BlobbiPlaySelectorModal({
  isOpen,
  onClose,
  onChooseToys,
  onChooseGames,
  blobbiName,
}: BlobbiPlaySelectorModalProps) {
  const handleToysClick = () => {
    onChooseToys();
    onClose();
  };

  const handleGamesClick = () => {
    onChooseGames();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        'w-[calc(100vw-2rem)] max-w-md',
        'bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm',
        'border border-purple-200/50 dark:border-purple-600/50',
        'rounded-2xl overflow-hidden shadow-elegant-xl'
      )}>
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            Play with {blobbiName || 'Blobbi'}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Choose how you'd like to play
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          {/* Toys Option */}
          <Button
            onClick={handleToysClick}
            className={cn(
              'flex flex-col items-center justify-center gap-4 h-auto py-8 px-6',
              'bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20',
              'hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-900/30 dark:hover:to-pink-900/30',
              'border border-purple-200/50 dark:border-purple-600/50',
              'hover:border-purple-300 dark:hover:border-purple-500',
              'rounded-xl shadow-lg',
              'transition-all duration-300 hover:shadow-elegant-lg hover:scale-[1.02]',
              'text-gray-900 dark:text-gray-100'
            )}
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-base mb-1">Play with Toys</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Use items from your inventory
              </div>
            </div>
          </Button>

          {/* Games Option */}
          <Button
            onClick={handleGamesClick}
            className={cn(
              'flex flex-col items-center justify-center gap-4 h-auto py-8 px-6',
              'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20',
              'hover:from-yellow-100 hover:to-orange-100 dark:hover:from-yellow-900/30 dark:hover:to-orange-900/30',
              'border border-yellow-200/50 dark:border-yellow-600/50',
              'hover:border-yellow-300 dark:hover:border-yellow-500',
              'rounded-xl shadow-lg',
              'transition-all duration-300 hover:shadow-elegant-lg hover:scale-[1.02]',
              'text-gray-900 dark:text-gray-100'
            )}
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-base mb-1">Play Games</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Choose from mini-games
              </div>
            </div>
          </Button>
        </div>

        <div className="pt-2 pb-2">
          <div className="text-center">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
