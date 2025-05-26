import { BlobbiGame } from '@/components/blobbi/BlobbiGame';
import { DailyCheckIn } from '@/components/blobbi/DailyCheckIn';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBlobbi } from '@/hooks/useBlobbi';

export default function Blobbi() {
  const { user } = useCurrentUser();
  const { blobbi } = useBlobbi();
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Blobbi</h1>
        <LoginArea />
      </div>
      
      <div className="grid lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <BlobbiGame />
        </div>
        
        {/* Sidebar */}
        {user && blobbi && (
          <div className="space-y-4">
            <DailyCheckIn />
          </div>
        )}
      </div>
    </div>
  );
}