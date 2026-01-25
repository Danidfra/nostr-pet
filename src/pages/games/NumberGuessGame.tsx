import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Play, RotateCcw, Trophy, TrendingUp, TrendingDown, HelpCircle } from 'lucide-react';
import { useBlobbiGameSystem } from '@/hooks/useBlobbiInteractionSystem';
import { useToast } from '@/hooks/useToast';
import { useAddCoins } from '@/hooks/useBlobbonautProfile';
import { BlobbiVisual } from '@/components/blobbi/BlobbiVisual';
import { BlobbiEvolvedVisual } from '@/components/blobbi/BlobbiEvolvedVisual';
import { AppHeader } from '@/components/AppHeader';
import { cn } from '@/lib/utils';

interface GameState {
  currentNumber: number;
  nextNumber: number | null;
  round: number;
  correctGuesses: number;
  totalRounds: number;
  isPlaying: boolean;
  gameOver: boolean;
  playerGuess: 'higher' | 'lower' | null;
  showResult: boolean;
  lastGuessCorrect: boolean | null;
  gameStartTime: number;
  gameStarted: boolean;
}

const TOTAL_ROUNDS = 5;
const WINNING_THRESHOLD = 3;

export function NumberGuessGame() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { mutateAsync: addCoins } = useAddCoins();

  // Get the specific Blobbi ID from navigation state
  const blobbiId = location.state?.blobbiId;

  // Use the specific Blobbi if provided, otherwise fall back to user's Blobbi
  const { blobbi, playGame, isPlaying, isLoading } = useBlobbiGameSystem(blobbiId);

  const [gameState, setGameState] = useState<GameState>({
    currentNumber: Math.floor(Math.random() * 9) + 1,
    nextNumber: null,
    round: 1,
    correctGuesses: 0,
    totalRounds: TOTAL_ROUNDS,
    isPlaying: false,
    gameOver: false,
    playerGuess: null,
    showResult: false,
    lastGuessCorrect: null,
    gameStartTime: 0,
    gameStarted: false,
  });
  const [hasEndedGame, setHasEndedGame] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  // Use the passed blobbiId or fall back to the loaded blobbi's ID
  const effectiveBlobbiId = blobbiId || blobbi?.id;

  // Generate a new random number (1-9)
  const generateNumber = useCallback((): number => {
    return Math.floor(Math.random() * 9) + 1;
  }, []);

  // Start game
  const startGame = useCallback(() => {
    setHasEndedGame(false);
    const startNumber = generateNumber();
    setGameState({
      currentNumber: startNumber,
      nextNumber: null,
      round: 1,
      correctGuesses: 0,
      totalRounds: TOTAL_ROUNDS,
      isPlaying: true,
      gameOver: false,
      playerGuess: null,
      showResult: false,
      lastGuessCorrect: null,
      gameStartTime: Date.now(),
      gameStarted: true,
    });
  }, [generateNumber]);

  // Make a guess
  const makeGuess = useCallback((guess: 'higher' | 'lower') => {
    if (!gameState.isPlaying || gameState.showResult) return;

    let nextNumber = generateNumber();
    while (nextNumber === gameState.currentNumber) {
      nextNumber = generateNumber();
    }
    const isCorrect =
      (guess === 'higher' && nextNumber > gameState.currentNumber) ||
      (guess === 'lower' && nextNumber < gameState.currentNumber);

    setGameState(prev => ({
      ...prev,
      nextNumber,
      playerGuess: guess,
      showResult: true,
      lastGuessCorrect: isCorrect,
      correctGuesses: prev.correctGuesses + (isCorrect ? 1 : 0),
    }));
  }, [gameState.isPlaying, gameState.showResult, gameState.currentNumber, generateNumber]);

  // Continue to next round
  const nextRound = useCallback(() => {
    if (gameState.round >= TOTAL_ROUNDS) {
      // Game over
      setGameState(prev => ({
        ...prev,
        isPlaying: false,
        gameOver: true,
        showResult: false,
      }));
    } else {
      // Next round
      setGameState(prev => ({
        ...prev,
        currentNumber: prev.nextNumber!,
        nextNumber: null,
        round: prev.round + 1,
        playerGuess: null,
        showResult: false,
        lastGuessCorrect: null,
      }));
    }
  }, [gameState.round]);

  // Handle leaving the game
  const handleLeaveGame = useCallback(() => {
    // Reset all game state
    setHasEndedGame(false);
    setGameState({
      currentNumber: Math.floor(Math.random() * 9) + 1,
      nextNumber: null,
      round: 1,
      correctGuesses: 0,
      totalRounds: TOTAL_ROUNDS,
      isPlaying: false,
      gameOver: false,
      playerGuess: null,
      showResult: false,
      lastGuessCorrect: null,
      gameStartTime: 0,
      gameStarted: false,
    });
    navigate(-1);
  }, [navigate]);

  // End game and record interaction
  const endGame = useCallback(async (finalScore: number, won: boolean) => {
    if (hasEndedGame) return; // Prevent multiple calls

    const gameDuration = Math.floor((Date.now() - gameState.gameStartTime) / 1000);

    try {
      // Record the game interaction using the new system
      if (blobbi && effectiveBlobbiId) {
        await playGame('number-guess', finalScore, gameDuration, 10);
      }

      // Award coins based on performance
      const baseCoins = won ? 30 : 10; // Bonus for winning
      const bonusCoins = finalScore * 5; // 5 coins per correct guess
      const totalCoins = baseCoins + bonusCoins;

      // Actually add the coins to the user's balance
      await addCoins(totalCoins);

      toast({
        title: won ? 'You Won!' : 'Game Over!',
        description: `You got ${finalScore}/${TOTAL_ROUNDS} correct and earned ${totalCoins} coins!`,
      });
    } catch (error) {
      console.error('Failed to record game interaction or add coins:', error);
      // Still show game over message even if recording fails
      toast({
        title: won ? 'You Won!' : 'Game Over!',
        description: `You got ${finalScore}/${TOTAL_ROUNDS} correct!`,
      });
    }
  }, [effectiveBlobbiId, blobbi, playGame, toast, gameState.gameStartTime, hasEndedGame, addCoins]);

  // Handle game over - only run once when game ends
  useEffect(() => {
    if (gameState.gameOver && !hasEndedGame && !isPlaying) {
      setHasEndedGame(true);
      const won = gameState.correctGuesses >= WINNING_THRESHOLD;

      // Use setTimeout to prevent potential React batching issues
      setTimeout(() => {
        endGame(gameState.correctGuesses, won);
      }, 100);
    }
  }, [gameState.gameOver, hasEndedGame, isPlaying]); // Added isPlaying to prevent calling during mutation

  const getResultMessage = () => {
    if (!gameState.showResult || gameState.lastGuessCorrect === null) return '';

    if (gameState.lastGuessCorrect) {
      return `Correct! ${gameState.nextNumber} is ${gameState.playerGuess} than ${gameState.currentNumber}`;
    } else {
      return `Wrong! ${gameState.nextNumber} is ${gameState.playerGuess === 'higher' ? 'lower' : 'higher'} than ${gameState.currentNumber}`;
    }
  };

  const getGameOverMessage = () => {
    const won = gameState.correctGuesses >= WINNING_THRESHOLD;
    if (won) {
      return `Congratulations! You won with ${gameState.correctGuesses}/${TOTAL_ROUNDS} correct guesses!`;
    } else {
      return `Game over! You got ${gameState.correctGuesses}/${TOTAL_ROUNDS} correct. You need ${WINNING_THRESHOLD} to win.`;
    }
  };

  // Show loading state while Blobbi is being loaded
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLeaveGame}
                className="flex items-center gap-2 hover:bg-purple-100 dark:hover:bg-purple-900/20"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </div>
          </div>
          <Card className="relative overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
            <CardContent className="p-8">
              <div className="flex items-center justify-center h-[400px]">
                <div className="text-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
                  <p className="text-gray-600 dark:text-gray-400">Loading your Blobbi...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show error state if no Blobbi is found
  if (!blobbi) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLeaveGame} disabled={isPlaying}
                className="flex items-center gap-2 hover:bg-purple-100 dark:hover:bg-purple-900/20"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </div>
          </div>
          <Card className="relative overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
            <CardContent className="p-8">
              <div className="flex items-center justify-center h-[400px]">
                <div className="text-center space-y-4">
                  <p className="text-gray-600 dark:text-gray-400">No Blobbi found to play with!</p>
                  <Button onClick={handleLeaveGame} variant="outline">
                    Go Back
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden">
      <div 
        className="bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20 flex items-center justify-center p-2 sm:p-4 min-h-0"
        style={{
          height: 'calc(100dvh - var(--app-header-h, 0px))',
          marginTop: 'var(--app-header-h, 0px)',
        }}
      >
        <div className="w-full h-full max-w-6xl flex items-center justify-center min-h-0">
          {/* Game Area */}
          <Card className="relative w-full h-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl shadow-elegant-xl overflow-hidden">
            <CardContent className="p-0 h-full">
              <div className="relative w-full h-full min-h-0 bg-gradient-to-t from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30">

              {/* Game Stats & Help - Top Row */}
              <div className="absolute top-4 left-0 right-0 z-[60] flex items-center justify-between px-4 pointer-events-none">
                <div className="flex-1 flex justify-start pointer-events-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLeaveGame}
                    className={cn(
                      "rounded-xl backdrop-blur-sm",
                      "bg-white/90 dark:bg-gray-800/90",
                      "border border-purple-200/50 dark:border-purple-600/50",
                      "shadow-lg hover:shadow-xl transition-all"
                    )}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "px-4 py-2 rounded-xl backdrop-blur-sm",
                    "bg-white/90 dark:bg-gray-800/90",
                    "border border-purple-200/50 dark:border-purple-600/50",
                    "shadow-lg"
                  )}>
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        {gameState.correctGuesses}/{gameState.totalRounds}
                      </span>
                    </div>
                  </div>

                  <div className={cn(
                    "px-4 py-2 rounded-xl backdrop-blur-sm",
                    "bg-white/90 dark:bg-gray-800/90",
                    "border border-purple-200/50 dark:border-purple-600/50",
                    "shadow-lg"
                  )}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        Round {gameState.round}/{gameState.totalRounds}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex justify-end pointer-events-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHelp(true)}
                    className={cn(
                      "rounded-xl backdrop-blur-sm",
                      "bg-white/90 dark:bg-gray-800/90",
                      "border border-purple-200/50 dark:border-purple-600/50",
                      "shadow-lg hover:shadow-xl transition-all"
                    )}
                  >
                    <HelpCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Game Content */}
              {gameState.isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
                  <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 md:gap-4 w-full max-w-5xl">

                    {/* Numbers Row */}
                    <div className="flex items-center justify-center gap-6 sm:gap-8 md:gap-12 lg:gap-16 w-full">
                      {/* Left Number */}
                      <div className="flex flex-col items-center gap-1 sm:gap-2">
                        <div className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Current Number</div>
                        <Card className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 lg:w-22 lg:h-22 flex items-center justify-center bg-blue-500 text-white border-2 border-blue-600 shadow-lg">
                          <span className="text-2xl sm:text-3xl md:text-3xl lg:text-4xl font-bold">{gameState.currentNumber}</span>
                        </Card>
                      </div>

                      {/* Right Number */}
                      <div className="flex flex-col items-center gap-1 sm:gap-2">
                        <div className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Next Number</div>
                        <Card className={`w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 lg:w-22 lg:h-22 flex items-center justify-center border-2 shadow-lg ${
                          gameState.nextNumber !== null
                            ? 'bg-purple-500 text-white border-purple-600'
                            : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                        }`}>
                          <span className="text-2xl sm:text-3xl md:text-3xl lg:text-4xl font-bold">
                            {gameState.nextNumber !== null ? gameState.nextNumber : '?'}
                          </span>
                        </Card>
                      </div>
                    </div>

                    {/* Blobbi Character */}
                    {blobbi && (
                      <div className="flex flex-col items-center gap-1 sm:gap-2 md:gap-3">
                        <div className="text-xs sm:text-sm md:text-base font-medium text-gray-700 dark:text-gray-300 text-center px-2">
                          {gameState.showResult ? 'Result!' : 'Will the next number be higher or lower?'}
                        </div>
                        <div className="flex items-center justify-center max-h-[140px] sm:max-h-[170px] md:max-h-[220px] overflow-hidden">
                          <div className="pointer-events-none max-w-full overflow-hidden">
                            <style>
                              {`
                                .game-blobbi-wrapper * {
                                  animation: none !important;
                                }
                              `}
                            </style>
                            <div className="origin-center scale-[0.5] sm:scale-[0.55] md:scale-[0.65] lg:scale-[0.75]">
                              <div className="game-blobbi-wrapper">
                                {blobbi.evolutionForm ? (
                                  <BlobbiEvolvedVisual
                                    blobbi={blobbi}
                                    size="medium"
                                  />
                                ) : (
                                  <BlobbiVisual
                                    blobbi={blobbi}
                                    size="medium"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Game Controls */}
                        {!gameState.showResult && (
                          <div className="flex gap-3 sm:gap-4 md:gap-6">
                            <Button
                              onClick={() => makeGuess('higher')}
                              className="flex items-center gap-1 sm:gap-2 bg-green-500 hover:bg-green-600 text-white px-4 sm:px-6 md:px-8 py-2 sm:py-2.5 md:py-3 text-sm sm:text-base md:text-lg font-semibold shadow-lg"
                              size="lg"
                            >
                              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                              Higher
                            </Button>
                            <Button
                              onClick={() => makeGuess('lower')}
                              className="flex items-center gap-1 sm:gap-2 bg-red-500 hover:bg-red-600 text-white px-4 sm:px-6 md:px-8 py-2 sm:py-2.5 md:py-3 text-sm sm:text-base md:text-lg font-semibold shadow-lg"
                              size="lg"
                            >
                              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                              Lower
                            </Button>
                          </div>
                        )}

                        {/* Result Display */}
                        {gameState.showResult && (
                          <div className="text-center space-y-2 sm:space-y-3 md:space-y-4 max-w-md px-2">
                            <div className={`text-sm sm:text-base md:text-lg font-semibold leading-tight ${
                              gameState.lastGuessCorrect ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {getResultMessage()}
                            </div>
                            <Button
                              onClick={nextRound}
                              className="bg-purple-500 hover:bg-purple-600 text-white px-6 sm:px-8 py-2 sm:py-2.5 md:py-3 text-sm sm:text-base md:text-lg font-semibold shadow-lg"
                              size="lg"
                            >
                              {gameState.round >= TOTAL_ROUNDS ? 'Finish Game' : 'Next Round'}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Welcome Screen */}
              {!gameState.gameStarted && !gameState.gameOver && (
                <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
                  <div className="flex flex-col items-center justify-center gap-4 sm:gap-6 md:gap-8 w-full max-w-2xl">
                    {/* Blobbi Character */}
                    {blobbi && (
                      <div className="flex flex-col items-center gap-2 sm:gap-3 md:gap-4">
                        <div className="text-base sm:text-lg md:text-xl font-semibold text-gray-700 dark:text-gray-300 text-center px-2">
                          Ready to play Number Guessing?
                        </div>
                        <div className="flex items-center justify-center max-h-[180px] sm:max-h-[220px] md:max-h-[260px] overflow-hidden">
                          <div className="pointer-events-none max-w-full overflow-hidden">
                            <style>
                              {`
                                .game-blobbi-wrapper * {
                                  animation: none !important;
                                }
                              `}
                            </style>
                            <div className="origin-center scale-[0.6] sm:scale-[0.65] md:scale-[0.75] lg:scale-[0.85]">
                              <div className="game-blobbi-wrapper">
                                {blobbi.evolutionForm ? (
                                  <BlobbiEvolvedVisual
                                    blobbi={blobbi}
                                    size="medium"
                                  />
                                ) : (
                                  <BlobbiVisual
                                    blobbi={blobbi}
                                    size="medium"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Start Game Button */}
                        <Button
                          onClick={startGame} disabled={isPlaying}
                          size="lg"
                          className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 sm:px-8 py-2.5 sm:py-3 text-base sm:text-lg font-semibold shadow-lg"
                        >
                          <Play className="w-5 h-5 sm:w-6 sm:h-6" />
                          Start Game
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Game Over Overlay */}
              {gameState.gameOver && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                  <Card className="p-8 text-center bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-purple-200 dark:border-purple-600 max-w-md">
                    <CardHeader>
                      <CardTitle className={`text-2xl ${
                        gameState.correctGuesses >= WINNING_THRESHOLD ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'
                      }`}>
                        {gameState.correctGuesses >= WINNING_THRESHOLD ? 'You Won!' : 'Game Over!'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-lg text-gray-900 dark:text-gray-100">
                        {getGameOverMessage()}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">
                        You earned {(gameState.correctGuesses >= WINNING_THRESHOLD ? 30 : 10) + (gameState.correctGuesses * 5)} coins!
                      </div>
                      <div className="flex gap-2 justify-center">
                        <Button onClick={startGame} className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
                          <RotateCcw className="w-4 h-4" />
                          Play Again
                        </Button>
                        <Button variant="outline" onClick={handleLeaveGame} className="border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20">
                          {isPlaying ? 'Saving...' : 'Back to Blobbi'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* How to Play Modal */}
      <Dialog open={showHowToPlay} onOpenChange={setShowHowToPlay}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-600" />
              How to Play Number Guessing
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Test your intuition in this classic Tamagotchi-style guessing game!
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-sm flex items-center justify-center font-bold mt-0.5">1</div>
                <div>
                  <p className="font-medium">Look at the current number</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">A number from 1-9 will be shown on the left</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-500 text-white text-sm flex items-center justify-center font-bold mt-0.5">2</div>
                <div>
                  <p className="font-medium">Make your guess</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Will the next number be Higher or Lower?</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-purple-500 text-white text-sm flex items-center justify-center font-bold mt-0.5">3</div>
                <div>
                  <p className="font-medium">See the result</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">The next number is revealed on the right</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-purple-800 dark:text-purple-200">Game Rules:</h4>
              <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
                <li>• Play {TOTAL_ROUNDS} rounds total</li>
                <li>• Numbers range from 1 to 9</li>
                <li>• Get {WINNING_THRESHOLD} or more correct to win</li>
                <li>• Earn coins based on your performance!</li>
              </ul>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">Rewards:</h4>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                <li>• Win bonus: 30 coins</li>
                <li>• Participation: 10 coins</li>
                <li>• +5 coins per correct guess</li>
              </ul>
            </div>

            <Button
              onClick={() => setShowHowToPlay(false)}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
            >
              Got it, let's play!
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Help Modal */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-purple-600" />
              Game Help
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Need a refresher on how to play?
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-green-500 mt-1" />
                <div>
                  <p className="font-medium">Higher Button</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Click when you think the next number will be greater than the current number</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <TrendingDown className="w-5 h-5 text-red-500 mt-1" />
                <div>
                  <p className="font-medium">Lower Button</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Click when you think the next number will be less than the current number</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Quick Tips:</h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Numbers 1-3 are more likely to go higher</li>
                <li>• Numbers 7-9 are more likely to go lower</li>
                <li>• Numbers 4-6 could go either way!</li>
                <li>• Trust your instincts and have fun!</li>
              </ul>
            </div>

            <Button
              onClick={() => setShowHelp(false)}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
            >
              Back to Game
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}