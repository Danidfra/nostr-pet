import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Check, Loader2 } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { useSetCurrentCompanion } from '@/hooks/useSetCurrentCompanion';
import { useToast } from '@/hooks/useToast';
import { Blobbi } from '@/types/blobbi';

interface SetCompanionButtonProps {
  blobbi: Blobbi;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function SetCompanionButton({ 
  blobbi, 
  variant = 'outline',
  size = 'default',
  className = ''
}: SetCompanionButtonProps) {
  const { user } = useCurrentUser();
  const { data: profile } = useBlobbonautProfile();
  const { mutate: setCompanion, isPending } = useSetCurrentCompanion();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  if (!user || !profile) {
    return null;
  }

  const isCurrentCompanion = profile.currentCompanion === blobbi.id;
  const ownsThisBlobbi = profile.ownedBlobbis.includes(blobbi.id);

  if (!ownsThisBlobbi) {
    return null; // Don't show the button if user doesn't own this Blobbi
  }

  const handleSetCompanion = async () => {
    if (isCurrentCompanion) {
      // If already companion, remove it
      setIsUpdating(true);
      setCompanion(null, {
        onSuccess: () => {
          toast({
            title: "Companion Removed",
            description: `${blobbi.name} is no longer your companion.`,
          });
          setIsUpdating(false);
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
          setIsUpdating(false);
        },
      });
    } else {
      // Set as new companion
      setIsUpdating(true);
      setCompanion(blobbi.id, {
        onSuccess: () => {
          toast({
            title: "Companion Selected!",
            description: `${blobbi.name} is now your companion and will follow you around!`,
          });
          setIsUpdating(false);
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
          setIsUpdating(false);
        },
      });
    }
  };

  const isLoading = isPending || isUpdating;

  return (
    <Button
      variant={isCurrentCompanion ? 'default' : variant}
      size={size}
      onClick={handleSetCompanion}
      disabled={isLoading}
      className={`gap-2 ${isCurrentCompanion ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white' : ''} ${className}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          {isCurrentCompanion ? 'Removing...' : 'Setting...'}
        </>
      ) : isCurrentCompanion ? (
        <>
          <Check className="h-4 w-4 mr-2" />
          Current Companion
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4 mr-2" />
          Set as Companion
        </>
      )}
    </Button>
  );
}