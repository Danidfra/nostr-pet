import { Button } from '@/components/ui/button';
import { Gamepad2, Package, Sparkles, ShoppingBag, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlobbiActionsFooterSkeletonProps {
  className?: string;
}

/**
 * Skeleton version of BlobbiActionsFooter
 * Matches the 5-button dashboard layout visually but disabled
 */
export function BlobbiActionsFooterSkeleton({
  className,
}: BlobbiActionsFooterSkeletonProps) {
  return (
    <div className={cn("bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-t-2 border-purple-300 dark:border-purple-600 shadow-lg", className)}>
      <div className="container mx-auto px-4 py-3 sm:py-3 py-4">
        {/* Dashboard mode: 5-button layout */}
        <div className="flex items-center justify-between sm:justify-center sm:gap-4 lg:gap-8 max-w-6xl mx-auto opacity-60 pointer-events-none grayscale animate-pulse">
          {/* Left: Shop */}
          <Button
            variant="outline"
            size="sm"
            disabled
            className="flex items-center gap-2 px-3 py-2.5 h-auto rounded-full"
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Blobbies</span>
          </Button>

          {/* Right: Missions */}
          <Button
            variant="outline"
            size="sm"
            disabled
            className="flex items-center gap-2 px-3 py-2.5 h-auto rounded-full"
          >
            <Target className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Missions</span>
          </Button>

          {/* Center: Actions */}
          <Button
            variant="default"
            size="sm"
            disabled
            className="flex items-center gap-2 px-6 py-2.5 h-auto rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 shadow-lg"
          >
            <Gamepad2 className="w-5 h-5" />
            <span className="text-sm font-medium">Actions</span>
          </Button>

          {/* Right-center: Blobbies (Switch) */}
          <Button
            variant="outline"
            size="sm"
            disabled
            className="flex items-center gap-2 px-3 py-2.5 h-auto rounded-full"
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Shop</span>
          </Button>

          {/* Left-center: Inventory */}
          <Button
            variant="outline"
            size="sm"
            disabled
            className="flex items-center gap-2 px-3 py-2.5 h-auto rounded-full"
          >
            <Package className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Inventory</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
