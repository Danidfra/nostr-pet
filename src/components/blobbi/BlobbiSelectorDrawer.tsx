import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Blobbi } from '@/types/blobbi';
import { BlobbiVisual } from './BlobbiVisual';
import { BlobbiEvolvedVisual } from './BlobbiEvolvedVisual';
import { EggGraphic } from './EggGraphic';
import { Search, Check, Sparkles } from 'lucide-react';
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
  const [isOpen, setIsOpen] = useState(false);

  const filteredBlobbis = blobbis.filter(blobbi =>
    blobbi.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (blobbiId: string) => {
    onSelectBlobbi(blobbiId);
    if (onOpenChange) {
      onOpenChange(false);
    } else {
      setIsOpen(false);
    }
  };

  const sheetOpen = open !== undefined ? open : isOpen;
  const setSheetOpen = onOpenChange || setIsOpen;

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Select Your Blobbi</SheetTitle>
          <SheetDescription>
            Choose which Blobbi to interact with
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search Blobbis..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Blobbi List */}
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-2 pr-4">
              {filteredBlobbis.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No Blobbis found
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredBlobbis.map((blobbi) => {
                  const isSelected = blobbi.id === selectedBlobbiId;
                  
                  return (
                    <Card
                      key={blobbi.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        isSelected && "ring-2 ring-purple-500 bg-purple-50/50 dark:bg-purple-900/20"
                      )}
                      onClick={() => handleSelect(blobbi.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          {/* Blobbi Visual */}
                          <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg">
                            {blobbi.lifeStage === 'egg' ? (
                              <EggGraphic
                                blobbi={blobbi}
                                size="tiny"
                                animated={false}
                                warmth={blobbi.eggTemperature || 60}
                              />
                            ) : blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi' ? (
                              <BlobbiEvolvedVisual
                                blobbi={blobbi}
                                size="tiny"
                              />
                            ) : (
                              <BlobbiVisual
                                blobbi={blobbi}
                                size="tiny"
                              />
                            )}
                          </div>

                          {/* Blobbi Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-sm truncate">
                                {blobbi.name}
                              </h4>
                              {isSelected && (
                                <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {blobbi.lifeStage}
                              </Badge>
                              {blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi' && (
                                <Badge variant="default" className="text-xs gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  {blobbi.evolutionForm}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Last care: {formatDistanceToNow(blobbi.lastInteraction * 1000, { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
