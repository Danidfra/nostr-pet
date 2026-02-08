import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Coins } from 'lucide-react';
import { BlobbiItem } from '@/types/blobbi';

interface BlobbiItemCardProps {
  item: BlobbiItem & { quantity?: number };
  mode: 'shop' | 'inventory';
  canAfford?: boolean;
  onAction?: (item: BlobbiItem) => void;
  disabled?: boolean;
}

export function BlobbiItemCard({ item, mode, canAfford = true, onAction, disabled }: BlobbiItemCardProps) {
  const isShop = mode === 'shop';
  const isInventory = mode === 'inventory';

  return (
    <Card className={`group transition-all duration-300 ${
      isShop && (!canAfford || disabled)
        ? 'opacity-60 cursor-not-allowed'
        : isShop
          ? 'hover:scale-[1.02] hover:shadow-xl cursor-pointer'
          : 'hover:shadow-lg'
    } bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden`}>
      <CardContent className="p-0">
        {/* Header with icon and price/quantity */}
        <div className="relative p-4 pb-3 bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-900/20 dark:to-pink-900/20">
          <div className="flex items-start justify-between">
            <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
              <span className="text-2xl filter drop-shadow-sm">{item.icon}</span>
            </div>
            {isShop && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/40 dark:to-amber-900/40 rounded-full border border-yellow-200/50 dark:border-yellow-700/50 shadow-sm">
                <Coins className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                <span className="text-sm font-bold text-yellow-700 dark:text-yellow-300">{item.price}</span>
              </div>
            )}
            {isInventory && item.quantity && (
              <Badge variant="secondary" className="text-sm px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 flex-shrink-0">
                x{item.quantity}
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h4 className="font-semibold text-base mb-3 text-gray-900 dark:text-gray-100 line-clamp-1">{item.name}</h4>

          {/* Effects */}
          {item.effect && Object.entries(item.effect).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {Object.entries(item.effect).map(([stat, value]: [string, number]) => (
                <div key={stat} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 rounded-lg border border-emerald-200/50 dark:border-emerald-700/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    {stat} {value > 0 ? '+' : ''}{value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Action Button */}
          {isShop && (
            <Button
              size="sm"
              className={`w-full h-10 rounded-xl font-semibold transition-all duration-300 ${
                disabled
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : !canAfford
                    ? 'bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900/30 dark:to-pink-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 hover:from-red-200 hover:to-pink-200 dark:hover:from-red-900/40 dark:hover:to-pink-900/40'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg hover:shadow-xl'
              }`}
              disabled={!canAfford || disabled}
              onClick={() => onAction?.(item)}
            >
              {disabled ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-gray-400 flex items-center justify-center">
                    <span className="text-xs">⏳</span>
                  </div>
                  Coming Soon
                </span>
              ) : !canAfford ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-400 flex items-center justify-center">
                    <span className="text-xs text-white">!</span>
                  </div>
                  Not Enough Coins
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-xs">🛒</span>
                  </div>
                  Purchase
                </span>
              )}
            </Button>
          )}

          {isInventory && item.type === 'accessory' && (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-10 rounded-xl border-purple-200 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 font-semibold"
              onClick={() => onAction?.(item)}
            >
              Equip
            </Button>
          )}

          {isInventory && (item.type === 'food' || item.type === 'medicine' || item.type === 'toy' || item.type === 'hygiene') && (
            <div className="text-center p-2.5 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                Use from main interface
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
