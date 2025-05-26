import { BlobbiFeed } from '@/components/blobbi/BlobbiFeed';
import { LoginArea } from '@/components/auth/LoginArea';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function BlobbiCommunity() {
  const navigate = useNavigate();
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/blobbi')}
          >
            <Home className="h-4 w-4" />
          </Button>
          <h1 className="text-4xl font-bold">Blobbi Community</h1>
        </div>
        <LoginArea />
      </div>
      <BlobbiFeed />
    </div>
  );
}