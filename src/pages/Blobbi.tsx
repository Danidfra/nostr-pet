import { Link } from 'react-router-dom';
import { BlobbiGame } from '@/components/blobbi/BlobbiGame';
import { DailyCheckIn } from '@/components/blobbi/DailyCheckIn';
import { BlobbonautProfileCard } from '@/components/blobbi/BlobbonautProfileCard';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBlobbi } from '@/hooks/useBlobbi';
import { ThemeToggle } from '@/components/theme-toggle';
import { SettingsButton } from '@/components/SettingsButton';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export default function Blobbi() {
  const { user } = useCurrentUser();
  const { blobbi } = useBlobbi();
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Blobbi</h1>
        <div className="flex items-center gap-2">
          <SettingsButton />
          <ThemeToggle />
          <LoginArea />
        </div>
      </div>
      
      <div className="grid lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <BlobbiGame />
        </div>
        
        {/* Sidebar */}
        {user && (
          <div className="space-y-4">
            {/* Blobbanaut Profile */}
            <BlobbonautProfileCard />
            
            {blobbi && <DailyCheckIn />}
            
            <Link to="/blobbi/evolution">
              <Button variant="outline" className="w-full gap-2">
                <Sparkles className="w-4 h-4" />
                Evolution Guide
              </Button>
            </Link>
          </div>
        )}
      </div>

    </div>
  );
}