import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import BlobbiEvolution from '@/components/BlobbiEvolution';
import { ThemeToggle } from '@/components/theme-toggle';

export default function BlobbiEvolutionPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Link to="/blobbi">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Game
            </Button>
          </Link>
          <h1 className="text-4xl font-bold">Evolution Guide</h1>
        </div>
        <ThemeToggle />
      </div>
      
      <BlobbiEvolution />
    </div>
  );
}