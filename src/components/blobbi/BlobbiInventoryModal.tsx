import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BlobbiItem, BlobbiAction } from '@/types/blobbi';
import { useBlobbi } from '@/hooks/useBlobbi';
import { useToast } from '@/hooks/useToast';
import { getInventoryItemsByType } from '@/lib/blobbi';
import { Utensils, Gamepad2, Pill, Bath, Sparkles } from 'lucide-react';
import { SHOP_ITEMS } from '@/lib/shop-items';

interface BlobbiInventoryModalProps {
  isOpen: boolean;
  onClose: (actionPerformed?: boolean, action?: BlobbiAction) => void;
  actionType: BlobbiAction;
}

const ACTION_TYPE_MAP: Record<BlobbiAction, string> = {
  feed: 'food',
  play: 'toy',
  medicine: 'medicine',
  clean: 'hygiene',
  rest: '',
  warming: '',
  checking: '',
  singing: '',
  talking: '',
  cruzar: '',
};

const ACTION_ICONS: Record<BlobbiAction, React.ComponentType<{ className?: string }> | null> = {
  feed: Utensils,
  play: Gamepad2,
  medicine: Pill,
  clean: Bath,
  rest: null,
  warming: null,
  checking: null,
  singing: null,
  talking: null,
  cruzar: null,
};

export function BlobbiInventoryModal({ isOpen, onClose, actionType }: BlobbiInventoryModalProps) {
  const { blobbi, performAction } = useBlobbi();
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<BlobbiItem | null>(null);
  
  if (!blobbi) return null;
  
  const itemType = ACTION_TYPE_MAP[actionType];
  if (!itemType) return null;
  
  const inventoryItems = getInventoryItemsByType(blobbi, itemType, SHOP_ITEMS) as (BlobbiItem & { quantity: number })[];
  const ActionIcon = ACTION_ICONS[actionType];
  
  const handleUseItem = async () => {
    if (!selectedItem) return;
    
    try {
      // Use the performAction method with item effects
      await performAction(actionType, selectedItem.effect);
      
      toast({
        title: "Item Used!",
        description: `${blobbi.name} used ${selectedItem.name}!`,
      });
      
      // Close with action performed flag
      onClose(true, actionType);
    } catch (error) {
      toast({
        title: "Failed to use item",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const getActionTitle = () => {
    switch (actionType) {
      case 'feed':
        return 'Feed Your Blobbi';
      case 'play':
        return 'Play with Your Blobbi';
      case 'medicine':
        return 'Heal Your Blobbi';
      case 'clean':
        return 'Clean Your Blobbi';
      default:
        return 'Use Item';
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ActionIcon && <ActionIcon className="w-5 h-5" />}
            {getActionTitle()}
          </DialogTitle>
        </DialogHeader>
        
        {inventoryItems.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              You don't have any {itemType} items in your inventory.
            </p>
            <Button variant="outline" onClick={() => onClose(false)}>
              Go to Shop
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2 max-h-[300px] overflow-y-auto">
              {inventoryItems.map((item) => (
                <Card 
                  key={item.id}
                  className={`cursor-pointer transition-colors ${
                    selectedItem?.id === item.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedItem(item)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{item.icon}</span>
                        <div>
                          <h4 className="font-medium text-sm">{item.name}</h4>
                          <div className="flex gap-2 mt-1">
                            {item.effect && Object.entries(item.effect).map(([stat, value]) => (
                              <Badge key={stat} variant="secondary" className="text-xs">
                                {stat} +{value}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">x{item.quantity}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onClose(false)} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleUseItem} 
                disabled={!selectedItem}
                className="flex-1"
              >
                Use Item
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}