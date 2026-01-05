import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlobbiFooterProps {
  onOpenActions: () => void;
  className?: string;
}

/**
 * Simplified footer component matching the header design language
 * Contains a single centered "Actions" button
 */
export function BlobbiFooter({
  onOpenActions,
  className,
}: BlobbiFooterProps) {
  return (
    <div className={cn(
      "flex-shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      className
    )}>
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-center max-w-4xl mx-auto">
          <Button
            size="default"
            onClick={onOpenActions}
            className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-md hover:shadow-lg transition-all"
          >
            <Zap className="w-4 h-4" />
            Actions
          </Button>
        </div>
      </div>
    </div>
  );
}
