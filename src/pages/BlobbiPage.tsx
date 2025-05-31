import BlobbiEvolution from '@/components/BlobbiEvolution';
import { BlobbiTimeline } from '@/components/blobbi/BlobbiTimeline';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBlobbi } from '@/hooks/useBlobbi';

export function BlobbiPage() {
  const { user } = useCurrentUser();
  const { blobbi } = useBlobbi();

  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <BlobbiEvolution />
        </div>
        {blobbi && (
          <div>
            <BlobbiTimeline blobbiId={blobbi.id} />
          </div>
        )}
      </div>
    </div>
  );
}