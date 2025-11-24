import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Zap, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlobbiFakeStatusIndicatorProps {
  hasFakeStatus: boolean;
  pendingInteractionCount: number;
  className?: string;
}

export function BlobbiFakeStatusIndicator({ 
  hasFakeStatus, 
  pendingInteractionCount, 
  className 
}: BlobbiFakeStatusIndicatorProps) {
  if (!hasFakeStatus || pendingInteractionCount === 0) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge 
          variant="secondary" 
          className={cn(
            "flex items-center gap-1 bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700 animate-pulse",
            className
          )}
        >
          <Zap className="w-3 h-3" />
          <span className="text-xs font-medium">
            {pendingInteractionCount} pending
          </span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-sm space-y-1">
          <p className="font-medium">Instant Updates Active</p>
          <p className="text-xs text-muted-foreground">
            {pendingInteractionCount} interaction{pendingInteractionCount !== 1 ? 's' : ''} syncing with the network
          </p>
          <p className="text-xs text-muted-foreground">
            Your Blobbi responds immediately while changes are confirmed
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}