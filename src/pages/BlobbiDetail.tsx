import { useParams } from 'react-router-dom';
import { BlobbiDetailContent } from './blobbi/BlobbiDetailContent';

export default function BlobbiDetail() {
  const { blobbiId } = useParams<{ blobbiId: string }>();

  if (!blobbiId) {
    return <div>Invalid Blobbi ID</div>;
  }

  return <BlobbiDetailContent blobbiId={blobbiId} />;
}
