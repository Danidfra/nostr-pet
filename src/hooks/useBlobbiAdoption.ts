import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCreateBlobbi } from '@/hooks/useBlobbiEvents';
import { useBlobbonautProfile, useCreateInitialProfile, useUpdateBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { createBlobbiWithAdoption, validatePetName } from '@/lib/blobbi-adoption';
import { Blobbi } from '@/types/blobbi';

export interface AdoptBlobbiParams {
  petName: string;
}

// Adoption fee in coins
export const ADOPTION_FEE = 100;

export function useBlobbiAdoption() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { createBlobbi } = useCreateBlobbi();
  const { data: blobbonautProfile } = useBlobbonautProfile();
  const { mutateAsync: createInitialProfile } = useCreateInitialProfile();
  const { mutateAsync: updateProfile } = useUpdateBlobbonautProfile();

  const adoptBlobbi = useMutation({
    mutationFn: async ({ petName }: AdoptBlobbiParams): Promise<Blobbi> => {
      if (!user) {
        throw new Error('User must be logged in to adopt a Blobbi');
      }

      // Check if user has a profile and sufficient coins
      if (!blobbonautProfile) {
        throw new Error('You must create a Blobbonaut profile before adopting a Blobbi');
      }

      if (blobbonautProfile.coins < ADOPTION_FEE) {
        throw new Error(`Insufficient coins. You need ${ADOPTION_FEE} coins to adopt a Blobbi, but you only have ${blobbonautProfile.coins} coins.`);
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

      // Update Blobbonaut Profile to add the Blobbi AND deduct coins in a single transaction
      try {
        // Don't add if already owned
        if (!blobbonautProfile.ownedBlobbis.includes(createdBlobbi.id)) {
          const updatedProfile = {
            ...blobbonautProfile,
            // Deduct adoption fee
            coins: blobbonautProfile.coins - ADOPTION_FEE,
            // Add the new Blobbi
            ownedBlobbis: [...blobbonautProfile.ownedBlobbis, createdBlobbi.id],
            lifetimeBlobbis: blobbonautProfile.lifetimeBlobbis + 1,
            // Set as starter Blobbi if this is the first one
            starterBlobbi: blobbonautProfile.ownedBlobbis.length === 0 ? createdBlobbi.id : blobbonautProfile.starterBlobbi,
          };

          await updateProfile(updatedProfile);
        }
      } catch (error) {
        console.error('Failed to update Blobbonaut Profile after adoption:', error);
        throw new Error(`Failed to complete adoption: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      queryClient.invalidateQueries({ queryKey: ['blobbonaut-profile'] });

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