import { ThemeToggle } from '@/components/theme-toggle';
import { LoginArea } from '@/components/auth/LoginArea';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SimpleNavBarProps {
  showHomeButton?: boolean;
  className?: string;
}

export function SimpleNavBar({ showHomeButton = true, className = "" }: SimpleNavBarProps) {
  const navigate = useNavigate();

  return (
    <div className={`flex justify-between items-center p-4 ${className}`}>
      <div className="flex items-center gap-2">
        {showHomeButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Home
          </Button>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LoginArea />
      </div>
    </div>
  );
}