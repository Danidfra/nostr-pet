import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import BlobbiEvolution from '@/components/BlobbiEvolution';
import { AppHeader } from '@/components/AppHeader';

export default function BlobbiEvolutionPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
      <div className="container mx-auto py-8 px-4">
        <AppHeader 
          title="Evolution Guide"
          subtitle="Discover how your Blobbi transforms after 4 days of loving care"
          leftContent={
            <Link to="/blobbi">
              <Button variant="ghost" size="sm" className="gap-2 hover:bg-purple-100 dark:hover:bg-purple-900/20">
                <ArrowLeft className="w-4 h-4" />
                Back to Game
              </Button>
            </Link>
          }
        />
        
        <BlobbiEvolution />
      </div>
    </div>
  );
}