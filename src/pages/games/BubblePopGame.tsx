import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Play, RotateCcw, Trophy, Clock } from 'lucide-react';
import { useBlobbiGameSystem } from '@/hooks/useBlobbiInteractionSystem';
import { useToast } from '@/hooks/useToast';
import { useAddCoins } from '@/hooks/useBlobbonautProfile';
import { BlobbiVisual } from '@/components/blobbi/BlobbiVisual';
import { BlobbiEvolvedVisual } from '@/components/blobbi/BlobbiEvolvedVisual';
import { cn } from '@/lib/utils';

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
  timestamp: number;
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
  const { mutateAsync: addCoins } = useAddCoins();

  // Get the specific Blobbi ID from navigation state
  const blobbiId = location.state?.blobbiId;

  // Use the specific Blobbi if provided, otherwise fall back to user's Blobbi
  const { blobbi, playGame, isPlaying, isLoading } = useBlobbiGameSystem(blobbiId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  const gameTimerRef = useRef<number>();
  const bubbleSpawnRef = useRef<number>();
  const bubbleUpdateRef = useRef<number>();
  const resizeObserverRef = useRef<ResizeObserver>();

  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    timeLeft: GAME_DURATION,
    isPlaying: false,
    gameOver: false,
    bubbles: [],
    poppedBubbles: [],
  });
  const [hasEndedGame, setHasEndedGame] = useState(false);
  const [isCanvasReady, setIsCanvasReady] = useState(false);

  // Use the passed blobbiId or fall back to the loaded blobbi's ID
  const effectiveBlobbiId = blobbiId || blobbi?.id;

  // Generate random bubble using CSS pixel coordinates
  const createBubble = useCallback((): Bubble => {
    const radius = Math.random() * (BUBBLE_MAX_RADIUS - BUBBLE_MIN_RADIUS) + BUBBLE_MIN_RADIUS;
    const container = containerRef.current;
    if (!container) throw new Error('Container not available');

    // Use CSS pixel coordinates from container's bounding rect
    const rect = container.getBoundingClientRect();
    
    return {
      id: Date.now() + Math.random(),
      x: Math.random() * (rect.width - radius * 2) + radius,
      y: rect.height + radius, // Start just below visible area in CSS pixels
      radius,
      color: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)],
      speed: 1 + Math.random() * 2,
      points: Math.floor((BUBBLE_MAX_RADIUS - radius) / 5) + 5,
      createdAt: Date.now(),
      lifespan: BUBBLE_LIFESPAN,
    };
  }, []);

  // Handle bubble click - use CSS pixel coordinates
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!gameState.isPlaying || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Click coordinates in CSS pixels (no scaling needed, bubbles are in CSS px)
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
            timestamp: Date.now(),
          }],
        };
      }

      return prev;
    });
  }, [gameState.isPlaying]);

  // Clean up all intervals and animations
  const cleanupGame = useCallback(() => {
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = undefined;
    }
    if (bubbleSpawnRef.current) {
      clearInterval(bubbleSpawnRef.current);
      bubbleSpawnRef.current = undefined;
    }
    if (bubbleUpdateRef.current) {
      clearInterval(bubbleUpdateRef.current);
      bubbleUpdateRef.current = undefined;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
  }, []);

  // Start game - ensure canvas is ready first
  const startGame = useCallback(() => {
    cleanupGame();
    setHasEndedGame(false);
    
    // Only start if canvas is ready
    if (!isCanvasReady) {
      console.warn('Canvas not ready, waiting...');
      // Set a flag to start game once canvas is ready
      const checkReady = setInterval(() => {
        if (isCanvasReady) {
          clearInterval(checkReady);
          setGameState({
            score: 0,
            timeLeft: GAME_DURATION,
            isPlaying: true,
            gameOver: false,
            bubbles: [],
            poppedBubbles: [],
          });
        }
      }, 100);
      return;
    }
    
    setGameState({
      score: 0,
      timeLeft: GAME_DURATION,
      isPlaying: true,
      gameOver: false,
      bubbles: [],
      poppedBubbles: [],
    });
  }, [cleanupGame, isCanvasReady]);

  // End game and record interaction using enhanced system
  const endGame = useCallback(async (finalScore: number) => {
    cleanupGame();

    try {
      // Record the game interaction using enhanced system that automatically handles both 14919 and 31124 events
      if (blobbi && effectiveBlobbiId) {
        await playGame('bubble-pop', finalScore, GAME_DURATION, 10);
      }

      // Award coins based on score
      const coinsEarned = Math.floor(finalScore / 10);

      // Actually add the coins to the user's balance
      await addCoins(coinsEarned);

      toast({
        title: 'Game Over!',
        description: `You scored ${finalScore} points and earned ${coinsEarned} coins!`,
      });
    } catch (error) {
      console.error('Failed to record game interaction:', error);
      // Still show game over message even if recording fails
      toast({
        title: 'Game Over!',
        description: `You scored ${finalScore} points!`,
      });
    }
  }, [effectiveBlobbiId, blobbi, playGame, toast, addCoins, cleanupGame]);

  // Game timer
  useEffect(() => {
    if (!gameState.isPlaying) return;

    gameTimerRef.current = window.setInterval(() => {
      setGameState(prev => {
        if (!prev.isPlaying) return prev;

        const newTimeLeft = prev.timeLeft - 1;

        if (newTimeLeft <= 0) {
          return { ...prev, timeLeft: 0, isPlaying: false, gameOver: true };
        }

        return { ...prev, timeLeft: newTimeLeft };
      });
    }, 1000);

    return () => {
      if (gameTimerRef.current) {
        clearInterval(gameTimerRef.current);
      }
    };
  }, [gameState.isPlaying]);

  // Handle game over
  useEffect(() => {
    if (gameState.gameOver && !hasEndedGame) {
      setHasEndedGame(true);
      endGame(gameState.score);
    }
  }, [gameState.gameOver, gameState.score, endGame, hasEndedGame]);

  // Bubble spawning - only if canvas is ready
  useEffect(() => {
    if (!gameState.isPlaying || !isCanvasReady) return;

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
  }, [gameState.isPlaying, createBubble, isCanvasReady]);

  // Update bubble positions - only if canvas is ready
  useEffect(() => {
    if (!gameState.isPlaying || !isCanvasReady) return;

    bubbleUpdateRef.current = window.setInterval(() => {
      setGameState(prev => {
        const now = Date.now();
        const container = containerRef.current;
        const maxHeight = container ? container.getBoundingClientRect().height : 1000;

        // Update bubble positions and remove expired/off-screen bubbles
        const updatedBubbles = prev.bubbles
          .filter(bubble => {
            // Remove bubbles that have expired or gone off screen
            return now - bubble.createdAt < bubble.lifespan && bubble.y + bubble.radius > 0;
          })
          .map(bubble => ({
            ...bubble,
            y: bubble.y - bubble.speed,
          }))
          .filter(bubble => {
            // Clamp to visible bounds (in case container resized)
            return bubble.y < maxHeight + bubble.radius * 2;
          });

        // Clean up old popped bubble animations
        const activePoppedBubbles = prev.poppedBubbles.filter(popped => {
          return now - popped.timestamp < 500;
        });

        return {
          ...prev,
          bubbles: updatedBubbles,
          poppedBubbles: activePoppedBubbles,
        };
      });
    }, 16); // ~60fps

    return () => {
      if (bubbleUpdateRef.current) {
        clearInterval(bubbleUpdateRef.current);
      }
    };
  }, [gameState.isPlaying, isCanvasReady]);

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

  // Resize canvas using ResizeObserver for robust handling
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      
      // Check if container has valid dimensions
      if (rect.width === 0 || rect.height === 0) {
        setIsCanvasReady(false);
        return;
      }
      
      // Set display size (css pixels)
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      
      // Set actual size in memory (scaled to account for extra pixel density)
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      // CRITICAL: Reset transform before applying DPR scaling to prevent accumulation
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Reset transform matrix to identity
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // Now apply DPR scaling (this won't accumulate on subsequent calls)
        ctx.scale(dpr, dpr);
      }
      
      // Mark canvas as ready once it has valid dimensions and DPR is applied
      setIsCanvasReady(true);
    };

    // Initial size
    updateCanvasSize();

    // Use ResizeObserver for container size changes
    resizeObserverRef.current = new ResizeObserver(() => {
      updateCanvasSize();
    });

    resizeObserverRef.current.observe(container);

    // Also handle window resize and orientation change
    const handleResize = () => updateCanvasSize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupGame();
    };
  }, [cleanupGame]);

  // Show loading state while Blobbi is being loaded
  if (isLoading) {
    return (
      <div className="fixed inset-0 overflow-hidden">
        <div 
          className="bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20 flex items-center justify-center p-4"
          style={{
            height: 'calc(100dvh - var(--app-header-h, 0px))',
            marginTop: 'var(--app-header-h, 0px)',
          }}
        >
          <Card className="w-full max-w-md bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl shadow-elegant-xl">
            <CardContent className="p-8">
              <div className="flex items-center justify-center space-y-4 flex-col">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading your Blobbi...</p>
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
      <div className="fixed inset-0 overflow-hidden">
        <div 
          className="bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20 flex items-center justify-center p-4"
          style={{
            height: 'calc(100dvh - var(--app-header-h, 0px))',
            marginTop: 'var(--app-header-h, 0px)',
          }}
        >
          <Card className="w-full max-w-md bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl shadow-elegant-xl">
            <CardContent className="p-8">
              <div className="text-center space-y-4">
                <p className="text-gray-600 dark:text-gray-400">No Blobbi found to play with!</p>
                <Button onClick={() => navigate(-1)} variant="outline" className="border-purple-200 dark:border-purple-600">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
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
        {/* Game Card */}
        <Card className="relative w-full h-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl shadow-elegant-xl overflow-hidden">
          <CardContent className="p-0 h-full">
            <div 
              ref={containerRef}
              className="relative w-full h-full bg-gradient-to-t from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30"
            >
              {/* Score and Time - Top Right Overlay */}
              <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
                <div className={cn(
                  "px-4 py-2 rounded-xl backdrop-blur-sm",
                  "bg-white/90 dark:bg-gray-800/90",
                  "border border-purple-200/50 dark:border-purple-600/50",
                  "shadow-lg"
                )}>
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    <span className="font-bold text-gray-900 dark:text-gray-100">{gameState.score}</span>
                  </div>
                </div>

                <div className={cn(
                  "px-4 py-2 rounded-xl backdrop-blur-sm",
                  "bg-white/90 dark:bg-gray-800/90",
                  "border border-purple-200/50 dark:border-purple-600/50",
                  "shadow-lg"
                )}>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-bold text-gray-900 dark:text-gray-100">{gameState.timeLeft}s</span>
                  </div>
                </div>
              </div>

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

              {/* Game Canvas - Higher z-index to be in front of Blobbi */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full cursor-pointer z-20"
                onClick={handleCanvasClick}
              />

              {/* Game Over Overlay */}
              {gameState.gameOver && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
                  <Card className="w-full max-w-sm p-6 sm:p-8 text-center bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl shadow-elegant-xl">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl sm:text-2xl text-gray-900 dark:text-gray-100">Game Over!</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">{gameState.score} points</div>
                      <div className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                        You earned {Math.floor(gameState.score / 10)} coins!
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 justify-center">
                        <Button 
                          onClick={startGame} 
                          className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Play Again
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => navigate(-1)} 
                          className="border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                        >
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          Back
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Start Screen */}
              {!gameState.isPlaying && !gameState.gameOver && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
                  <Card className="w-full max-w-sm p-6 sm:p-8 text-center bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl shadow-elegant-xl">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl sm:text-2xl text-gray-900 dark:text-gray-100">Bubble Pop!</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                        Pop as many bubbles as you can before time runs out!
                      </p>
                      <div className="space-y-2 text-xs sm:text-sm text-left text-gray-700 dark:text-gray-300">
                        <p>• Click on bubbles to pop them</p>
                        <p>• Smaller bubbles give more points</p>
                        <p>• Bubbles disappear after 5 seconds</p>
                      </div>
                      <Button 
                        onClick={startGame} 
                        size="lg" 
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                      >
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
    </div>
  );
}
