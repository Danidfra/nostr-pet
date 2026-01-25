import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Play, RotateCcw, Users, HelpCircle, Bot, Gamepad2 } from 'lucide-react';
import { useBlobbiGameSystem } from '@/hooks/useBlobbiInteractionSystem';
import { useToast } from '@/hooks/useToast';
import { useAddCoins } from '@/hooks/useBlobbonautProfile';
import { BlobbiVisual } from '@/components/blobbi/BlobbiVisual';
import { BlobbiEvolvedVisual } from '@/components/blobbi/BlobbiEvolvedVisual';
import { cn } from '@/lib/utils';
import { useCanvasSize } from '@/hooks/useCanvasSize';

type Player = 'X' | 'O';
type CellValue = Player | null;
type Board = CellValue[];
type GameMode = 'bot' | 'multiplayer';

interface GameState {
  board: Board;
  currentPlayer: Player;
  winner: Player | 'tie' | null;
  gameOver: boolean;
  isPlaying: boolean;
  gameStartTime: number;
  gameStarted: boolean;
  moves: number;
  gameMode: GameMode | null;
  isPlayerTurn: boolean;
}

interface WinLine {
  indices: number[];
  direction: 'horizontal' | 'vertical' | 'diagonal';
}

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

export function TicTacToeGame() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { mutateAsync: addCoins } = useAddCoins();

  const blobbiId = location.state?.blobbiId;
  const { blobbi, playGame, isPlaying, isLoading } = useBlobbiGameSystem(blobbiId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  const endGameOnceRef = useRef<string | null>(null);
  const roundIdRef = useRef<string>(crypto.randomUUID());

  const [gameState, setGameState] = useState<GameState>({
    board: Array(9).fill(null),
    currentPlayer: 'X',
    winner: null,
    gameOver: false,
    isPlaying: false,
    gameStartTime: 0,
    gameStarted: false,
    moves: 0,
    gameMode: null,
    isPlayerTurn: true,
  });
  const [hasEndedGame, setHasEndedGame] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [winLine, setWinLine] = useState<WinLine | null>(null);

  const effectiveBlobbiId = blobbiId || blobbi?.id;

  // Canvas sizing hook - handles all DPR and resize logic
  const { isReady: isCanvasReady, forceRecalc, logicalWidth, logicalHeight } = useCanvasSize(
    canvasRef,
    containerRef
  );

  // Check for winner
  const checkWinner = useCallback((board: Board): { winner: Player | 'tie' | null; winLine: WinLine | null } => {
    for (const combination of WINNING_COMBINATIONS) {
      const [a, b, c] = combination;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        let direction: 'horizontal' | 'vertical' | 'diagonal';
        if (a < 3 && b < 3 && c < 3) direction = 'horizontal';
        else if (a % 3 === b % 3 && b % 3 === c % 3) direction = 'vertical';
        else direction = 'diagonal';

        return {
          winner: board[a] as Player,
          winLine: { indices: combination, direction }
        };
      }
    }

    if (board.every(cell => cell !== null)) {
      return { winner: 'tie', winLine: null };
    }

    return { winner: null, winLine: null };
  }, []);

  // Bot AI
  const getBotMove = useCallback((board: Board): number => {
    const availableMoves = board.map((cell, index) => cell === null ? index : null).filter(val => val !== null) as number[];
    if (availableMoves.length === 0) return -1;

    const mistakeProbability = 0.5;
    if (Math.random() < mistakeProbability) {
      return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }

    // Check if bot can win
    for (const move of availableMoves) {
      const testBoard = [...board];
      testBoard[move] = 'O';
      const { winner } = checkWinner(testBoard);
      if (winner === 'O') return move;
    }

    // Check if bot needs to block
    for (const move of availableMoves) {
      const testBoard = [...board];
      testBoard[move] = 'X';
      const { winner } = checkWinner(testBoard);
      if (winner === 'X') return move;
    }

    // Take center if available
    if (board[4] === null) return 4;

    // Take corners
    const corners = [0, 2, 6, 8].filter(i => board[i] === null);
    if (corners.length > 0 && Math.random() > 0.3) {
      return corners[Math.floor(Math.random() * corners.length)];
    }

    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
  }, [checkWinner]);

  // Make a move
  const makeMove = useCallback((index: number, player?: Player) => {
    if (!gameState.isPlaying || gameState.board[index] || gameState.gameOver) return;
    if (gameState.gameMode === 'bot' && !gameState.isPlayerTurn && !player) return;

    setGameState(prev => {
      const newBoard = [...prev.board];
      const currentPlayer = player || prev.currentPlayer;
      newBoard[index] = currentPlayer;

      const { winner, winLine } = checkWinner(newBoard);
      if (winner && winLine) {
        setWinLine(winLine);
      }

      const nextPlayer = currentPlayer === 'X' ? 'O' : 'X';

      return {
        ...prev,
        board: newBoard,
        currentPlayer: nextPlayer,
        winner,
        gameOver: winner !== null,
        moves: prev.moves + 1,
        isPlayerTurn: prev.gameMode === 'bot' ? nextPlayer === 'X' : true,
      };
    });
  }, [gameState.isPlaying, gameState.board, gameState.gameOver, gameState.gameMode, gameState.isPlayerTurn, checkWinner]);

  // Start game
  const startGame = useCallback((mode: GameMode) => {
    setHasEndedGame(false);
    setWinLine(null);
    roundIdRef.current = crypto.randomUUID();
    endGameOnceRef.current = null;
    setGameState({
      board: Array(9).fill(null),
      currentPlayer: 'X',
      winner: null,
      gameOver: false,
      isPlaying: true,
      gameStartTime: Date.now(),
      gameStarted: true,
      moves: 0,
      gameMode: mode,
      isPlayerTurn: true,
    });
    setShowHowToPlay(false);
    // Force canvas recalculation after layout settles
    forceRecalc();
  }, [forceRecalc]);

  // Reset to mode selection
  const resetToModeSelection = useCallback(() => {
    setHasEndedGame(false);
    setWinLine(null);
    roundIdRef.current = crypto.randomUUID();
    endGameOnceRef.current = null;
    setGameState({
      board: Array(9).fill(null),
      currentPlayer: 'X',
      winner: null,
      gameOver: false,
      isPlaying: false,
      gameStartTime: 0,
      gameStarted: false,
      moves: 0,
      gameMode: null,
      isPlayerTurn: true,
    });
    // Force canvas recalculation after layout settles
    forceRecalc();
  }, [forceRecalc]);

  // End game
  const endGame = useCallback(async (winner: Player | 'tie' | null, moves: number, gameMode: GameMode | null) => {
    const gameDuration = Math.floor((Date.now() - gameState.gameStartTime) / 1000);

    try {
      if (blobbi && effectiveBlobbiId) {
        const score = winner === 'X' ? 100 : winner === 'O' ? 50 : winner === 'tie' ? 75 : 0;
        await playGame('tic-tac-toe', score, gameDuration, 10);
      }

      let coinsEarned = 0;
      let message = '';

      // Bot mode coin rules: player is always X, bot is O
      if (gameMode === 'bot') {
        if (winner === 'X') {
          coinsEarned = 50;
          message = 'You win! You earned 50 coins!';
        } else if (winner === 'O') {
          // Bot wins - only participation reward
          coinsEarned = 10;
          message = 'Bot wins! You earned 10 coins for playing!';
        } else if (winner === 'tie') {
          coinsEarned = 25;
          message = "It's a tie! You earned 25 coins!";
        }
      } else {
        // Multiplayer mode
        if (winner === 'X') {
          coinsEarned = 50;
          message = 'Player X wins! You earned 50 coins!';
        } else if (winner === 'O') {
          coinsEarned = 50;
          message = 'Player O wins! You earned 50 coins!';
        } else if (winner === 'tie') {
          coinsEarned = 25;
          message = "It's a tie! You earned 25 coins!";
        }
      }

      if (coinsEarned > 0) {
        await addCoins(coinsEarned);
      }

      toast({
        title: 'Game Over!',
        description: message,
      });
    } catch (error) {
      console.error('Failed to record game:', error);
      toast({
        title: 'Game Over!',
        description: 'Game completed!',
      });
    }
  }, [effectiveBlobbiId, blobbi, playGame, toast, addCoins, gameState.gameStartTime]);

  // Handle game over
  useEffect(() => {
    if (gameState.gameOver && endGameOnceRef.current !== roundIdRef.current) {
      // Set guard immediately to prevent multiple calls
      endGameOnceRef.current = roundIdRef.current;
      setHasEndedGame(true);
      endGame(gameState.winner, gameState.moves, gameState.gameMode);
    }
  }, [gameState.gameOver, gameState.winner, gameState.moves, gameState.gameMode, endGame]);

  // Bot move
  useEffect(() => {
    if (gameState.gameMode === 'bot' && !gameState.isPlayerTurn && !gameState.gameOver && gameState.isPlaying) {
      const timer = setTimeout(() => {
        const move = getBotMove(gameState.board);
        if (move !== -1) {
          makeMove(move, 'O');
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [gameState.gameMode, gameState.isPlayerTurn, gameState.gameOver, gameState.board, gameState.isPlaying, getBotMove, makeMove]);

  // Handle canvas click - use logical coordinates
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!gameState.isPlaying || !canvasRef.current || !isCanvasReady) return;
    if (gameState.gameMode === 'bot' && !gameState.isPlayerTurn) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Get click position in device pixels
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const deviceX = (event.clientX - rect.left) * scaleX;
    const deviceY = (event.clientY - rect.top) * scaleY;
    
    // Convert to logical (CSS) pixels
    const logicalX = deviceX / dpr;
    const logicalY = deviceY / dpr;
    
    // Calculate cell using logical coordinates
    const logicalW = canvas.width / dpr;
    const logicalH = canvas.height / dpr;
    const cellWidth = logicalW / 3;
    const cellHeight = logicalH / 3;
    
    const col = Math.floor(logicalX / cellWidth);
    const row = Math.floor(logicalY / cellHeight);
    const index = row * 3 + col;

    if (index >= 0 && index < 9) {
      makeMove(index);
    }
  }, [gameState.isPlaying, gameState.gameMode, gameState.isPlayerTurn, makeMove, isCanvasReady]);

  // Handle touch events - use logical coordinates
  const handleCanvasTouch = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (!gameState.isPlaying || !canvasRef.current || !isCanvasReady) return;
    if (gameState.gameMode === 'bot' && !gameState.isPlayerTurn) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];
    const dpr = window.devicePixelRatio || 1;
    
    // Get touch position in device pixels
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const deviceX = (touch.clientX - rect.left) * scaleX;
    const deviceY = (touch.clientY - rect.top) * scaleY;
    
    // Convert to logical (CSS) pixels
    const logicalX = deviceX / dpr;
    const logicalY = deviceY / dpr;
    
    // Calculate cell using logical coordinates
    const logicalW = canvas.width / dpr;
    const logicalH = canvas.height / dpr;
    const cellWidth = logicalW / 3;
    const cellHeight = logicalH / 3;
    
    const col = Math.floor(logicalX / cellWidth);
    const row = Math.floor(logicalY / cellHeight);
    const index = row * 3 + col;

    if (index >= 0 && index < 9) {
      makeMove(index);
    }
  }, [gameState.isPlaying, gameState.gameMode, gameState.isPlayerTurn, makeMove, isCanvasReady]);

  // Draw the board using logical (CSS) pixel coordinates
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isCanvasReady) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Single animation loop - cancel any existing one first
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }

    const animate = () => {
      // Use logical size from hook for all drawing calculations
      const logicalW = logicalWidth;
      const logicalH = logicalHeight;

      // Safety check
      if (logicalW === 0 || logicalH === 0) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      
      // Clear using logical coordinates (transform handles DPR)
      ctx.clearRect(0, 0, logicalW, logicalH);

      // All drawing uses logical (CSS) pixels - transform handles DPR
      const cellWidth = logicalW / 3;
      const cellHeight = logicalH / 3;

      // Draw grid lines
      ctx.strokeStyle = '#FF6B9D';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';

      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellWidth, 10);
        ctx.lineTo(i * cellWidth, logicalH - 10);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(10, i * cellHeight);
        ctx.lineTo(logicalW - 10, i * cellHeight);
        ctx.stroke();
      }

      // Draw X's and O's
      gameState.board.forEach((cell, index) => {
        if (!cell) return;

        const row = Math.floor(index / 3);
        const col = index % 3;
        const centerX = col * cellWidth + cellWidth / 2;
        const centerY = row * cellHeight + cellHeight / 2;
        const size = Math.min(cellWidth, cellHeight) * 0.3;

        if (cell === 'X') {
          const gradient = ctx.createLinearGradient(centerX - size, centerY - size, centerX + size, centerY + size);
          gradient.addColorStop(0, '#FF6B9D');
          gradient.addColorStop(1, '#C44569');

          ctx.strokeStyle = gradient;
          ctx.lineWidth = 8;
          ctx.lineCap = 'round';

          ctx.beginPath();
          ctx.moveTo(centerX - size, centerY - size);
          ctx.lineTo(centerX + size, centerY + size);
          ctx.moveTo(centerX + size, centerY - size);
          ctx.lineTo(centerX - size, centerY + size);
          ctx.stroke();
        } else if (cell === 'O') {
          const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, size);
          gradient.addColorStop(0, '#4ECDC4');
          gradient.addColorStop(1, '#26A69A');

          ctx.strokeStyle = gradient;
          ctx.lineWidth = 8;
          ctx.lineCap = 'round';

          ctx.beginPath();
          ctx.arc(centerX, centerY, size, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      // Draw winning line animation
      if (winLine && gameState.gameOver) {
        const time = Date.now() * 0.005;
        const opacity = 0.5 + 0.3 * Math.sin(time);

        ctx.strokeStyle = `rgba(255, 215, 0, ${opacity})`;
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';

        const [start, , end] = winLine.indices;
        const startRow = Math.floor(start / 3);
        const startCol = start % 3;
        const endRow = Math.floor(end / 3);
        const endCol = end % 3;

        const startX = startCol * cellWidth + cellWidth / 2;
        const startY = startRow * cellHeight + cellHeight / 2;
        const endX = endCol * cellWidth + cellWidth / 2;
        const endY = endRow * cellHeight + cellHeight / 2;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
    };
  }, [gameState.board, winLine, gameState.gameOver, isCanvasReady, logicalWidth, logicalHeight]);



  const getGameStatusMessage = () => {
    if (gameState.gameOver) {
      if (gameState.winner === 'tie') return "It's a tie!";
      if (gameState.gameMode === 'bot') {
        return gameState.winner === 'X' ? "You win!" : "Bot wins!";
      }
      return `Player ${gameState.winner} wins!`;
    }

    if (gameState.gameMode === 'bot') {
      return gameState.currentPlayer === 'X' ? "Your turn" : "Bot's turn";
    }

    return `Player ${gameState.currentPlayer}'s turn`;
  };

  const getModeName = () => {
    if (gameState.gameMode === 'bot') return 'vs Bot';
    if (gameState.gameMode === 'multiplayer') return 'vs Player';
    return 'Tic-Tac-Toe';
  };

  // Loading state
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

  // Error state
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
        <div className="w-full h-full max-w-4xl flex items-center justify-center min-h-0">
          <Card className="relative w-full h-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl shadow-elegant-xl overflow-hidden">
            <CardContent className="p-0 h-full">
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                {/* Top-Left: Back Button */}
                <div className="absolute top-4 left-4 z-30">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(-1)}
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

                {/* Top-Right: Help Button + Status */}
                <div className="absolute top-4 right-4 z-30 flex flex-col gap-2 items-end">
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

                  {/* Game Mode & Status Chip */}
                  {gameState.gameStarted && (
                    <div className={cn(
                      "px-3 py-2 rounded-xl backdrop-blur-sm",
                      "bg-white/90 dark:bg-gray-800/90",
                      "border border-purple-200/50 dark:border-purple-600/50",
                      "shadow-lg text-center"
                    )}>
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-900 dark:text-gray-100">
                        {gameState.gameMode === 'bot' ? (
                          <Bot className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                        ) : (
                          <Users className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                        )}
                        <span>{getModeName()}</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {getGameStatusMessage()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Game Board Container */}
                <div className="flex-1 flex items-center justify-center w-full p-4 min-h-0">
                  <div 
                    ref={containerRef}
                    className="w-full max-w-[440px] aspect-square min-h-0 flex items-stretch justify-stretch"
                  >
                    <canvas
                      ref={canvasRef}
                      className="w-full h-full cursor-pointer rounded-xl shadow-lg"
                      onClick={handleCanvasClick}
                      onTouchStart={handleCanvasTouch}
                    />
                  </div>
                </div>

                {/* Blobbi - Bottom Center (smaller) */}
                {blobbi && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none scale-75">
                    <style>
                      {`
                        .game-blobbi-wrapper * {
                          animation: none !important;
                        }
                      `}
                    </style>
                    <div className="game-blobbi-wrapper">
                      {blobbi.evolutionForm ? (
                        <BlobbiEvolvedVisual blobbi={blobbi} size="small" />
                      ) : (
                        <BlobbiVisual blobbi={blobbi} size="small" />
                      )}
                    </div>
                  </div>
                )}

                {/* How to Play / Mode Selection */}
                {showHowToPlay && !gameState.gameStarted && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
                    <Card className="w-full max-w-sm p-6 sm:p-8 text-center bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl shadow-elegant-xl">
                      <div className="space-y-6">
                        <div>
                          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                            Tic-Tac-Toe
                          </h2>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Choose your game mode
                          </p>
                        </div>

                        <div className="space-y-3">
                          <Button
                            onClick={() => startGame('bot')}
                            size="lg"
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl"
                          >
                            <Bot className="w-5 h-5" />
                            Play vs Bot
                          </Button>

                          <Button
                            onClick={() => startGame('multiplayer')}
                            size="lg"
                            variant="outline"
                            className="w-full flex items-center justify-center gap-2 border-purple-200 dark:border-purple-600 rounded-xl"
                          >
                            <Users className="w-5 h-5" />
                            Play vs Player
                          </Button>
                        </div>

                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          <p>• Get three in a row to win</p>
                          <p>• Earn coins for wins and ties</p>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Game Over Overlay */}
                {gameState.gameOver && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
                    <Card className="w-full max-w-sm p-6 sm:p-8 text-center bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl shadow-elegant-xl">
                      <div className="space-y-4">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {getGameStatusMessage()}
                        </h2>

                        <div className="flex flex-col sm:flex-row gap-2 justify-center">
                          <Button
                            onClick={() => startGame(gameState.gameMode!)}
                            className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Play Again
                          </Button>

                          <Button
                            variant="outline"
                            onClick={resetToModeSelection}
                            className="border-purple-200 dark:border-purple-600"
                          >
                            <Gamepad2 className="w-4 h-4 mr-2" />
                            Change Mode
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Help Dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl text-gray-900 dark:text-gray-100">How to Play</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <p><strong>Goal:</strong> Get three of your marks in a row (horizontal, vertical, or diagonal)</p>
            <p><strong>vs Bot:</strong> Play against an AI opponent that makes strategic moves</p>
            <p><strong>vs Player:</strong> Take turns with a friend on the same device</p>
            <p><strong>Rewards:</strong> Win = 50 coins, Tie = 25 coins</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
