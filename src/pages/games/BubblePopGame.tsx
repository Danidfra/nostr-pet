import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Play, RotateCcw, Trophy } from 'lucide-react';
import { useBlobbi } from '@/hooks/useBlobbi';
import { useBlobbiGameInteraction } from '@/hooks/useBlobbiInteractionWithStateUpdate';
import { useToast } from '@/hooks/useToast';
import { BlobbiVisual } from '@/components/blobbi/BlobbiVisual';
import { BlobbiEvolvedVisual } from '@/components/blobbi/BlobbiEvolvedVisual';
import { AppHeader } from '@/components/AppHeader';

interface Bubble {
  id: number;
  x: number;
  y: number;
  radius: number;
  color: string;
  speed: number;
  points: number;
  createdAt: number;
  lifespan: number;
}

interface PoppedBubble {
  x: number;
  y: number;
  points: number;
  id: number;
  timestamp?: number;
}

interface GameState {
  score: number;
  timeLeft: number;
  isPlaying: boolean;
  gameOver: boolean;
  bubbles: Bubble[];
  poppedBubbles: PoppedBubble[];
}

const GAME_DURATION = 60; // seconds
const BUBBLE_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3'];
const BUBBLE_MIN_RADIUS = 20;
const BUBBLE_MAX_RADIUS = 50;
const BUBBLE_SPAWN_RATE = 1000; // milliseconds
const BUBBLE_LIFESPAN = 5000; // milliseconds

export function BubblePopGame() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { blobbi, addCoins } = useBlobbi();
  const { mutateAsync: recordGameInteraction } = useBlobbiGameInteraction();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const gameLoopRef = useRef<number>();
  const bubbleSpawnRef = useRef<number>();
  
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    timeLeft: GAME_DURATION,
    isPlaying: false,
    gameOver: false,
    bubbles: [],
    poppedBubbles: [],
  });
  const [hasEndedGame, setHasEndedGame] = useState(false);

  const blobbiId = location.state?.blobbiId || blobbi?.id;

  // Generate random bubble
  const createBubble = useCallback((): Bubble => {
    const radius = Math.random() * (BUBBLE_MAX_RADIUS - BUBBLE_MIN_RADIUS) + BUBBLE_MIN_RADIUS;
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('Canvas not available');
    
    return {
      id: Date.now() + Math.random(),
      x: Math.random() * (canvas.width - radius * 2) + radius,
      y: canvas.height + radius,
      radius,
      color: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)],
      speed: 1 + Math.random() * 2,
      points: Math.floor((BUBBLE_MAX_RADIUS - radius) / 5) + 5,
      createdAt: Date.now(),
      lifespan: BUBBLE_LIFESPAN,
    };
  }, []);

  // Handle bubble click
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!gameState.isPlaying || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setGameState(prev => {
      const clickedBubble = prev.bubbles.find(bubble => {
        const distance = Math.sqrt((x - bubble.x) ** 2 + (y - bubble.y) ** 2);
        return distance <= bubble.radius;
      });

      if (clickedBubble) {
        return {
          ...prev,
          score: prev.score + clickedBubble.points,
          bubbles: prev.bubbles.filter(b => b.id !== clickedBubble.id),
          poppedBubbles: [...prev.poppedBubbles, {
            x: clickedBubble.x,
            y: clickedBubble.y,
            points: clickedBubble.points,
            id: clickedBubble.id,
          }],
        };
      }

      return prev;
    });
  }, [gameState.isPlaying]);

  // Start game
  const startGame = useCallback(() => {
    setHasEndedGame(false);
    setGameState({
      score: 0,
      timeLeft: GAME_DURATION,
      isPlaying: true,
      gameOver: false,
      bubbles: [],
      poppedBubbles: [],
    });
  }, []);

  // End game and record interaction using enhanced system
  const endGame = useCallback(async (finalScore: number) => {
    if (bubbleSpawnRef.current) {
      clearInterval(bubbleSpawnRef.current);
    }

    try {
      // Record the game interaction using enhanced system that automatically handles both 14919 and 31124 events
      if (blobbi && blobbiId) {
        await recordGameInteraction({
          blobbiId,
          gameType: 'bubble-pop',
          score: finalScore,
          duration: GAME_DURATION,
          energyCost: 10,
        });
      }

      // Award coins based on score
      const coinsEarned = Math.floor(finalScore / 10);
      if (coinsEarned > 0 && blobbi && addCoins) {
        try {
          await addCoins(coinsEarned);
          toast({
            title: 'Game Over!',
            description: `You scored ${finalScore} points and earned ${coinsEarned} coins!`,
          });
        } catch (error) {
          console.error('Failed to add coins:', error);
          toast({
            title: 'Game Over!',
            description: `You scored ${finalScore} points!`,
          });
        }
      } else {
        toast({
          title: 'Game Over!',
          description: `You scored ${finalScore} points!`,
        });
      }
    } catch (error) {
      console.error('Failed to record game interaction:', error);
      // Still show game over message even if recording fails
      toast({
        title: 'Game Over!',
        description: `You scored ${finalScore} points!`,
      });
    }
  }, [blobbiId, blobbi, recordGameInteraction, toast, addCoins]);

  // Game loop
  useEffect(() => {
    if (!gameState.isPlaying) return;

    const gameInterval = setInterval(() => {
      setGameState(prev => {
        if (!prev.isPlaying) return prev;
        
        const newTimeLeft = prev.timeLeft - 1;
        
        if (newTimeLeft <= 0) {
          return { ...prev, timeLeft: 0, isPlaying: false, gameOver: true };
        }

        return { ...prev, timeLeft: newTimeLeft };
      });
    }, 1000);

    return () => clearInterval(gameInterval);
  }, [gameState.isPlaying]);

  // Handle game over
  useEffect(() => {
    if (gameState.gameOver && !hasEndedGame) {
      setHasEndedGame(true);
      endGame(gameState.score);
    }
  }, [gameState.gameOver, gameState.score, endGame, hasEndedGame]);

  // Bubble spawning
  useEffect(() => {
    if (!gameState.isPlaying) return;

    bubbleSpawnRef.current = window.setInterval(() => {
      setGameState(prev => ({
        ...prev,
        bubbles: [...prev.bubbles, createBubble()],
      }));
    }, BUBBLE_SPAWN_RATE);

    return () => {
      if (bubbleSpawnRef.current) {
        clearInterval(bubbleSpawnRef.current);
      }
    };
  }, [gameState.isPlaying, createBubble]);

  // Update bubble positions
  useEffect(() => {
    if (!gameState.isPlaying) return;

    const updateInterval = setInterval(() => {
      setGameState(prev => {
        const now = Date.now();
        
        // Update bubble positions and remove expired/off-screen bubbles
        const updatedBubbles = prev.bubbles
          .filter(bubble => {
            // Remove bubbles that have expired or gone off screen
            return now - bubble.createdAt < bubble.lifespan && bubble.y + bubble.radius > 0;
          })
          .map(bubble => ({
            ...bubble,
            y: bubble.y - bubble.speed,
          }));

        // Clean up old popped bubble animations
        const activePoppedBubbles = prev.poppedBubbles.filter(popped => {
          if (!popped.timestamp) return false;
          return now - popped.timestamp < 500;
        });

        return {
          ...prev,
          bubbles: updatedBubbles,
          poppedBubbles: activePoppedBubbles,
        };
      });
    }, 16); // ~60fps

    return () => clearInterval(updateInterval);
  }, [gameState.isPlaying]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      // Clear canvas (transparent to show gradient background)
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const now = Date.now();

      // Draw current bubbles
      gameState.bubbles.forEach(bubble => {
        // Check if bubble should still exist
        if (now - bubble.createdAt >= bubble.lifespan) return;
        
        const opacity = Math.max(0.3, 1 - (now - bubble.createdAt) / bubble.lifespan);
        ctx.globalAlpha = opacity;
        
        // Draw bubble shadow
        ctx.beginPath();
        ctx.arc(bubble.x + 2, bubble.y + 2, bubble.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fill();
        
        // Draw bubble
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
        ctx.fillStyle = bubble.color;
        ctx.fill();
        
        // Draw bubble outline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw highlight
        ctx.beginPath();
        ctx.arc(bubble.x - bubble.radius / 3, bubble.y - bubble.radius / 3, bubble.radius / 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fill();
        
        ctx.globalAlpha = 1;
      });

      // Draw popped bubble animations
      gameState.poppedBubbles.forEach(popped => {
        if (!popped.timestamp) return;
        const age = now - popped.timestamp;
        if (age >= 500) return;
        
        const opacity = 1 - age / 500;
        ctx.globalAlpha = opacity;
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#4CAF50';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`+${popped.points}`, popped.x, popped.y - age / 10);
        ctx.globalAlpha = 1;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState.bubbles, gameState.poppedBubbles]);

  // Resize canvas
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const container = canvasRef.current.parentElement;
        if (container) {
          canvasRef.current.width = container.clientWidth;
          canvasRef.current.height = container.clientHeight;
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <AppHeader 
          leftContent={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 hover:bg-purple-100 dark:hover:bg-purple-900/20"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          }
        />
        
        {/* Game Stats */}
        <div className="flex justify-center gap-4 mb-4">
          <Card className="px-4 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-600" />
              <span className="font-bold text-gray-900 dark:text-gray-100">{gameState.score}</span>
            </div>
          </Card>
          
          <Card className="px-4 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 dark:text-gray-100">{gameState.timeLeft}s</span>
            </div>
          </Card>
        </div>

        {/* Game Area */}
        <Card className="relative overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
          <CardContent className="p-0">
            <div className="relative w-full h-[600px] bg-gradient-to-t from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30">
              {/* Blobbi Character */}
              {blobbi && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none">
                  <style>
                    {`
                      .game-blobbi-wrapper * {
                        animation: none !important;
                      }
                    `}
                  </style>
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
              )}

              {/* Game Canvas */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full cursor-pointer"
                onClick={handleCanvasClick}
              />

              {/* Game Over Overlay */}
              {gameState.gameOver && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                  <Card className="p-8 text-center bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                    <CardHeader>
                      <CardTitle className="text-2xl text-gray-900 dark:text-gray-100">Game Over!</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-4xl font-bold text-gray-900 dark:text-gray-100">{gameState.score} points</div>
                      <div className="text-gray-600 dark:text-gray-400">
                        You earned {Math.floor(gameState.score / 10)} coins!
                      </div>
                      <div className="flex gap-2 justify-center">
                        <Button onClick={startGame} className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
                          <RotateCcw className="w-4 h-4" />
                          Play Again
                        </Button>
                        <Button variant="outline" onClick={() => navigate(-1)} className="border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20">
                          Back to Games
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Start Screen */}
              {!gameState.isPlaying && !gameState.gameOver && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                  <Card className="p-8 text-center bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                    <CardHeader>
                      <CardTitle className="text-2xl text-gray-900 dark:text-gray-100">Bubble Pop!</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-gray-600 dark:text-gray-400">
                        Pop as many bubbles as you can before time runs out!
                      </p>
                      <div className="space-y-2 text-sm text-left text-gray-700 dark:text-gray-300">
                        <p>• Click on bubbles to pop them</p>
                        <p>• Smaller bubbles give more points</p>
                        <p>• Bubbles disappear after 5 seconds</p>
                      </div>
                      <Button onClick={startGame} size="lg" className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
                        <Play className="w-5 h-5" />
                        Start Game
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}