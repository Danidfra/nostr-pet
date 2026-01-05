import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Blobbi } from '@/types/blobbi';
import { BlobbiVisual } from './BlobbiVisual';
import { BlobbiEvolvedVisual } from './BlobbiEvolvedVisual';
import { EggGraphic } from './EggGraphic';
import { Search, Check, Sparkles, Egg, Baby, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface BlobbiSelectorDrawerProps {
  blobbis: Blobbi[];
  selectedBlobbiId: string | null;
  onSelectBlobbi: (blobbiId: string) => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function BlobbiSelectorDrawer({
  blobbis,
  selectedBlobbiId,
  onSelectBlobbi,
  trigger,
  open,
  onOpenChange,
}: BlobbiSelectorDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBlobbis = blobbis.filter(blobbi =>
    blobbi.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (blobbiId: string) => {
    onSelectBlobbi(blobbiId);
    if (onOpenChange) {
      onOpenChange(false);
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'egg': return Egg;
      case 'baby': return Baby;
      case 'adult': return Crown;
      default: return Sparkles;
    }
  };

  const getStageGradient = (stage: string) => {
    switch (stage) {
      case 'egg': return 'from-yellow-500 to-amber-500';
      case 'baby': return 'from-blue-500 to-cyan-500';
      case 'adult': return 'from-purple-500 to-pink-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </div>
            <span>Select Your Blobbi</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search Blobbis..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white/50 dark:bg-gray-800/50 border-purple-200/50 dark:border-purple-600/50 focus:border-purple-300 dark:focus:border-purple-500"
            />
          </div>

          {/* Blobbi List */}
          <ScrollArea className="h-[400px] pr-2">
            <div className="space-y-2">
              {filteredBlobbis.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No Blobbis found
                  </p>
                </div>
              ) : (
                filteredBlobbis.map((blobbi) => {
                  const isSelected = blobbi.id === selectedBlobbiId;
                  const StageIcon = getStageIcon(blobbi.lifeStage);
                  const stageGradient = getStageGradient(blobbi.lifeStage);

                  return (
                    <button
                      key={blobbi.id}
                      onClick={() => handleSelect(blobbi.id)}
                      className={cn(
                        "group relative overflow-hidden rounded-xl p-3 w-full text-left",
                        "bg-gradient-to-br from-white/80 to-white/40 dark:from-gray-800/80 dark:to-gray-800/40",
                        "border transition-all duration-200",
                        isSelected
                          ? "border-purple-400 dark:border-purple-500 shadow-lg shadow-purple-200/20 dark:shadow-purple-900/20 scale-[1.02]"
                          : "border-purple-200/50 dark:border-purple-600/50 hover:border-purple-300 dark:hover:border-purple-500 hover:scale-[1.01]"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {/* Blobbi Visual */}
                        <div className="relative flex-shrink-0">
                          <div className="w-16 h-16 flex flex-col items-center justify-end bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-2">
                            <div className="scale-75">
                              {blobbi.lifeStage === 'egg' ? (
                                <EggGraphic
                                  blobbi={blobbi}
                                  size="small"
                                  animated={false}
                                  warmth={blobbi.eggTemperature || 60}
                                />
                              ) : blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi' ? (
                                <BlobbiEvolvedVisual
                                  blobbi={blobbi}
                                  size="small"
                                />
                              ) : (
                                <BlobbiVisual
                                  blobbi={blobbi}
                                  size="small"
                                />
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Blobbi Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                              {blobbi.name}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className={cn(
                              "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white",
                              "bg-gradient-to-r",
                              stageGradient
                            )}>
                              <StageIcon className="w-3 h-3" />
                              <span className="capitalize">{blobbi.lifeStage}</span>
                            </div>
                            {blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi' && (
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                                <Sparkles className="w-3 h-3" />
                                <span className="capitalize">{blobbi.evolutionForm}</span>
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {formatDistanceToNow(blobbi.lastInteraction * 1000, { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
