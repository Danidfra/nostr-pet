import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCreateBlobbi } from '@/hooks/useBlobbiEvents';
import { useBlobbonautProfile, useAddBlobbi, useCreateInitialProfile } from '@/hooks/useBlobbonautProfile';
import { createBlobbiWithAdoption, validatePetName } from '@/lib/blobbi-adoption';
import { Blobbi } from '@/types/blobbi';

export interface AdoptBlobbiParams {
  petName: string;
}

export function useBlobbiAdoption() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { createBlobbi } = useCreateBlobbi();
  const { data: blobbonautProfile } = useBlobbonautProfile();
  const { mutateAsync: addBlobbi } = useAddBlobbi();
  const { mutateAsync: createInitialProfile } = useCreateInitialProfile();

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
      
      // Update Blobbanaut Profile
      try {
        if (!blobbonautProfile) {
          // Create initial profile if it doesn't exist
          await createInitialProfile({
            ownedBlobbis: [createdBlobbi.id],
            lifetimeBlobbis: 1,
            starterBlobbi: createdBlobbi.id,
          });
        } else {
          // Add Blobbi to existing profile
          await addBlobbi(createdBlobbi.id);
        }
      } catch (error) {
        console.error('Failed to update Blobbanaut Profile after adoption:', error);
        // Don't fail the adoption if profile update fails
      }
      
      return createdBlobbi;
    },
    onSuccess: (blobbi) => {
      // Invalidate relevant queries to refresh Blobbi lists
      queryClient.invalidateQueries({ queryKey: ['blobbis'] });
      queryClient.invalidateQueries({ queryKey: ['blobbis-new'] });
      queryClient.invalidateQueries({ queryKey: ['user-blobbis'] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-state'] });
      queryClient.invalidateQueries({ queryKey: ['blobbi-records'] });
      queryClient.invalidateQueries({ queryKey: ['blobbanaut-profile'] });
      
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