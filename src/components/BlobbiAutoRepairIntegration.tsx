import { useBlobbiAutoRepair } from '@/hooks/useBlobbiAutoRepair';

/**
 * Integration component that enables automatic repair of Blobbi STATE events
 * with missing tags. This component should be mounted at the app level.
 */
export function BlobbiAutoRepairIntegration() {
  useBlobbiAutoRepair();
  return null;
}
