import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCreateBlobbi } from '@/hooks/useBlobbiEvents';
import { createBlobbiWithAdoption, validatePetName } from '@/lib/blobbi-adoption';
import { Blobbi } from '@/types/blobbi';

export interface AdoptBlobbiParams {
  petName: string;
}

export function useBlobbiAdoption() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { createBlobbi } = useCreateBlobbi();

  const adoptBlobbi = useMutation({
    mutationFn: async ({ petName }: AdoptBlobbiParams): Promise<Blobbi> => {
      if (!user) {
        throw new Error('User must be logged in to adopt a Blobbi');
      }

      // Validate the pet name
      const validation = validatePetName(petName);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Create the Blobbi with adoption record following the specification
      const { blobbi, adoptionRecord } = createBlobbiWithAdoption({
        petName: petName.trim(),
        userPubkey: user.pubkey
      });

      // Use the existing createBlobbi function which handles both state and record creation
      const createdBlobbi = await createBlobbi({
        name: petName.trim(),
        stage: 'egg',
        birthData: adoptionRecord
      });
      
      return createdBlobbi;
    },
    onSuccess: (blobbi) => {
      // Invalidate relevant queries to refresh Blobbi lists
      queryClient.invalidateQueries({ queryKey: ['blobbis'] });
      queryClient.invalidateQueries({ queryKey: ['blobbis-new'] });
      queryClient.invalidateQueries({ queryKey: ['user-blobbis'] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-state'] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-records'] });
      
      // Invalidate specific Blobbi queries
      if (blobbi.id) {
        queryClient.invalidateQueries({ queryKey: ['blobbi', blobbi.id] });
        queryClient.invalidateQueries({ queryKey: ['blobbi-state', blobbi.id] });
        queryClient.invalidateQueries({ queryKey: ['blobbi-records', blobbi.id] });
      }
    },
    onError: (error) => {
      console.error('Failed to adopt Blobbi:', error);
    }
  });

  return {
    adoptBlobbi: adoptBlobbi.mutateAsync,
    isAdopting: adoptBlobbi.isPending,
    error: adoptBlobbi.error,
    reset: adoptBlobbi.reset,
    validatePetName
  };
}