import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Timer, Trophy, Zap, Hash, Grid3X3 } from 'lucide-react';

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
    id: 'number-guess',
    name: 'Number Guessing',
    description: 'Guess if the next number is higher or lower in this Tamagotchi classic!',
    icon: <Hash className="w-8 h-8 text-green-500" />,
    difficulty: 'Easy',
    rewards: '15-55 coins',
    path: '/games/number-guess',
    available: true,
  },
  {
    id: 'tic-tac-toe',
    name: 'Tic-Tac-Toe',
    description: 'Classic strategy game! Play against a friendly bot or challenge other players.',
    icon: <Grid3X3 className="w-8 h-8 text-purple-500" />,
    difficulty: 'Easy',
    rewards: '25-50 coins',
    path: '/games/tic-tac-toe',
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
      <DialogContent className="max-w-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            Blobbi Games
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((game) => (
            <Card
              key={game.id}
              className={`cursor-pointer transition-all duration-200 ${
                game.available
                  ? 'hover:shadow-lg hover:scale-105 bg-white/80 dark:bg-gray-800/80'
                  : 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-800/50'
              } backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-xl`}
              onClick={() => handleGameSelect(game)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
                    {game.icon}
                  </div>
                  <Badge
                    variant="secondary"
                    className={`${getDifficultyColor(game.difficulty)} border`}
                  >
                    {game.difficulty}
                  </Badge>
                </div>
                <CardTitle className="text-lg text-gray-900 dark:text-gray-100">{game.name}</CardTitle>
                <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                  {game.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="text-muted-foreground">Rewards:</span>
                  <span className="font-medium text-yellow-600 dark:text-yellow-400">{game.rewards}</span>
                </div>
                {!game.available && (
                  <Badge variant="outline" className="mt-2 w-full justify-center bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600">
                    Coming Soon
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-full border border-purple-200 dark:border-purple-600">
            <Trophy className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Play games to earn coins and keep your Blobbi entertained!
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}