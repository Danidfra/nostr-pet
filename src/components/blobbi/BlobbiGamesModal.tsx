import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Timer, Trophy, Zap } from 'lucide-react';

interface BlobbiGamesModalProps {
  isOpen: boolean;
  onClose: () => void;
  blobbiId: string;
}

interface GameInfo {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  rewards: string;
  path: string;
  available: boolean;
}

const GAMES: GameInfo[] = [
  {
    id: 'bubble-pop',
    name: 'Bubble Pop',
    description: 'Pop as many bubbles as you can before time runs out!',
    icon: <Sparkles className="w-8 h-8 text-blue-500" />,
    difficulty: 'Easy',
    rewards: '10-50 coins',
    path: '/games/bubble-pop',
    available: true,
  },
  {
    id: 'speed-feed',
    name: 'Speed Feed',
    description: 'Feed your Blobbi the right foods as fast as possible!',
    icon: <Timer className="w-8 h-8 text-orange-500" />,
    difficulty: 'Medium',
    rewards: '20-80 coins',
    path: '/games/speed-feed',
    available: false,
  },
  {
    id: 'blobbi-race',
    name: 'Blobbi Race',
    description: 'Race against other Blobbis in this exciting challenge!',
    icon: <Zap className="w-8 h-8 text-yellow-500" />,
    difficulty: 'Hard',
    rewards: '30-100 coins',
    path: '/games/blobbi-race',
    available: false,
  },
];

export function BlobbiGamesModal({ isOpen, onClose, blobbiId }: BlobbiGamesModalProps) {
  const navigate = useNavigate();

  const handleGameSelect = (game: GameInfo) => {
    if (!game.available) return;
    
    onClose();
    navigate(game.path, { state: { blobbiId } });
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return 'bg-green-100 text-green-800';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'Hard':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Blobbi Games
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((game) => (
            <Card
              key={game.id}
              className={`cursor-pointer transition-all ${
                game.available
                  ? 'hover:shadow-lg hover:scale-105'
                  : 'opacity-60 cursor-not-allowed'
              }`}
              onClick={() => handleGameSelect(game)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  {game.icon}
                  <Badge
                    variant="secondary"
                    className={getDifficultyColor(game.difficulty)}
                  >
                    {game.difficulty}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{game.name}</CardTitle>
                <CardDescription className="text-sm">
                  {game.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Rewards:</span>
                  <span className="font-medium">{game.rewards}</span>
                </div>
                {!game.available && (
                  <Badge variant="outline" className="mt-2 w-full justify-center">
                    Coming Soon
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          Play games to earn coins and keep your Blobbi entertained!
        </div>
      </DialogContent>
    </Dialog>
  );
}