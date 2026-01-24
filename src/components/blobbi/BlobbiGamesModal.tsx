import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Timer, Trophy, Zap, Hash, Grid3X3, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

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
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-700';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700';
      case 'Hard':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-700';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600';
    }
  };

  const availableGames = GAMES.filter(g => g.available);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        'w-[calc(100vw-2rem)] max-w-4xl max-h-[85vh]',
        'bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm',
        'border border-purple-200/50 dark:border-purple-600/50',
        'rounded-2xl overflow-hidden shadow-elegant-xl'
      )}>
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            Choose a Game
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Select a mini-game to play and earn rewards
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[500px]">
          {/* Mobile: List layout */}
          <div className="flex flex-col gap-3 md:hidden pr-2">
            {availableGames.map((game) => (
              <button
                key={game.id}
                onClick={() => handleGameSelect(game)}
                disabled={!game.available}
                className={cn(
                  'flex items-center gap-4 p-4 rounded-xl text-left',
                  'bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20',
                  'hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-900/30 dark:hover:to-pink-900/30',
                  'border border-purple-200/50 dark:border-purple-600/50',
                  'hover:border-purple-300 dark:hover:border-purple-500',
                  'transition-all duration-300 hover:shadow-lg hover:scale-[1.02]',
                  !game.available && 'opacity-60 cursor-not-allowed'
                )}
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  {game.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100 truncate">
                      {game.name}
                    </h3>
                    <Badge
                      variant="secondary"
                      className={cn('text-xs', getDifficultyColor(game.difficulty))}
                    >
                      {game.difficulty}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                    {game.description}
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <Trophy className="w-3 h-3 text-yellow-500" />
                    <span className="font-medium text-yellow-600 dark:text-yellow-400">
                      {game.rewards}
                    </span>
                  </div>
                </div>
                <Play className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              </button>
            ))}
          </div>

          {/* Desktop: Grid layout */}
          <div className="hidden md:grid gap-4 md:grid-cols-2 lg:grid-cols-3 pr-2">
            {GAMES.map((game) => (
              <Card
                key={game.id}
                className={cn(
                  'cursor-pointer transition-all duration-300 backdrop-blur-sm rounded-xl',
                  'border border-purple-200/50 dark:border-purple-600/50',
                  game.available
                    ? 'hover:shadow-lg hover:scale-[1.02] bg-white/80 dark:bg-gray-800/80 hover:border-purple-300 dark:hover:border-purple-500'
                    : 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-800/50'
                )}
                onClick={() => handleGameSelect(game)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
                      {game.icon}
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn('text-xs', getDifficultyColor(game.difficulty))}
                    >
                      {game.difficulty}
                    </Badge>
                  </div>
                  <CardTitle className="text-base text-gray-900 dark:text-gray-100">
                    {game.name}
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
                    {game.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-gray-600 dark:text-gray-400">Rewards:</span>
                    <span className="font-medium text-yellow-600 dark:text-yellow-400">
                      {game.rewards}
                    </span>
                  </div>
                  {game.available ? (
                    <Button
                      size="sm"
                      className={cn(
                        'w-full h-9 rounded-lg',
                        'bg-gradient-to-r from-purple-500 to-pink-500',
                        'hover:from-purple-600 hover:to-pink-600',
                        'text-white font-medium shadow-lg',
                        'transition-all duration-300'
                      )}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Play Now
                    </Button>
                  ) : (
                    <Badge
                      variant="outline"
                      className="w-full justify-center bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600"
                    >
                      Coming Soon
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        <div className="mt-4 pt-4 border-t border-purple-200/50 dark:border-purple-600/50">
          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200/50 dark:border-purple-600/50">
            <Trophy className="w-4 h-4 text-purple-500 dark:text-purple-400 flex-shrink-0" />
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center">
              Play games to earn coins and keep your Blobbi entertained!
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}