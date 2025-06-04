import { BlobbiFeed } from '@/components/blobbi/BlobbiFeed';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';

export default function BlobbiCommunity() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
      <div className="container mx-auto py-8 px-4">
        <AppHeader 
          title="Blobbi Community"
          leftContent={
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/blobbi')}
              className="hover:bg-purple-100 dark:hover:bg-purple-900/20"
            >
              <Home className="h-4 w-4" />
            </Button>
          }
        />
        <BlobbiFeed />
      </div>
    </div>
  );
}