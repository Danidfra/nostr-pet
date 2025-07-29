import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Play, RotateCcw, Trophy, Users, HelpCircle } from 'lucide-react';
import { useBlobbiGameSystem } from '@/hooks/useBlobbiInteractionSystem';
import { useToast } from '@/hooks/useToast';
import { useAddCoins } from '@/hooks/useBlobbonautProfile';
import { BlobbiVisual } from '@/components/blobbi/BlobbiVisual';
import { BlobbiEvolvedVisual } from '@/components/blobbi/BlobbiEvolvedVisual';

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
  isPlayerTurn: boolean; // For bot mode
}

interface WinLine {
  indices: number[];
  direction: 'horizontal' | 'vertical' | 'diagonal';
}

const WINNING_COMBINATIONS = [
  // Rows
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  // Columns
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  // Diagonals
  [0, 4, 8], [2, 4, 6]
];

export function TicTacToeGame() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { mutateAsync: addCoins } = useAddCoins();

  // Get the specific Blobbi ID from navigation state
  const blobbiId = location.state?.blobbiId;

  // Use the specific Blobbi if provided, otherwise fall back to user's Blobbi
  const { blobbi, playGame, isPlaying, isLoading } = useBlobbiGameSystem(blobbiId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

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

  // Use the passed blobbiId or fall back to the loaded blobbi's ID
  const effectiveBlobbiId = blobbiId || blobbi?.id;

  // Check for winner
  const checkWinner = useCallback((board: Board): { winner: Player | 'tie' | null; winLine: WinLine | null } => {
    // Check for winning combinations
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

    // Check for tie
    if (board.every(cell => cell !== null)) {
      return { winner: 'tie', winLine: null };
    }

    return { winner: null, winLine: null };
  }, []);

  // Bot AI - Simple but not too hard to beat
  const getBotMove = useCallback((board: Board): number => {
    const availableMoves = board.map((cell, index) => cell === null ? index : null).filter(val => val !== null) as number[];

    if (availableMoves.length === 0) return -1;

    const mistakeProbability = 0.5; // 50% chance of making a suboptimal move
    if (Math.random() < mistakeProbability) {
      // Make a random move instead of a smart one
      return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }

    // Check if bot can win
    for (const move of availableMoves) {
      const testBoard = [...board];
      testBoard[move] = 'O';
      const { winner } = checkWinner(testBoard);
      if (winner === 'O') return move;
    }

    // Check if bot needs to block player from winning
    for (const move of availableMoves) {
      const testBoard = [...board];
      testBoard[move] = 'X';
      const { winner } = checkWinner(testBoard);
      if (winner === 'X') return move;
    }

    // Take center if available (good strategy but not too aggressive)
    if (board[4] === null) return 4;

    // Take corners with some randomness (casual difficulty)
    const corners = [0, 2, 6, 8].filter(i => board[i] === null);
    if (corners.length > 0 && Math.random() > 0.3) {
      return corners[Math.floor(Math.random() * corners.length)];
    }

    // Otherwise, pick a random available move
    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
  }, [checkWinner]);

  // Make a move
  const makeMove = useCallback((index: number, player?: Player) => {
    if (!gameState.isPlaying || gameState.board[index] || gameState.gameOver) return;

    // In bot mode, only allow moves when it's player's turn (unless it's a bot move)
    if (gameState.gameMode === 'bot' && !gameState.isPlayerTurn && !player) return;

    setGameState(prev => {
      const newBoard = [...prev.board];
      const currentPlayer = player || prev.currentPlayer;
      newBoard[index] = currentPlayer;

      const { winner, winLine } = checkWinner(newBoard);
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

  // Start game with selected mode
  const startGame = useCallback((mode: GameMode) => {
    setHasEndedGame(false);
    setWinLine(null);
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
      isPlayerTurn: true, // Player always starts as X
    });
  }, []);

  // Reset to mode selection
  const resetToModeSelection = useCallback(() => {
    setHasEndedGame(false);
    setWinLine(null);
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
  }, []);

  // End game and record interaction
  const endGame = useCallback(async (winner: Player | 'tie' | null, moves: number) => {
    const gameDuration = Math.floor((Date.now() - gameState.gameStartTime) / 1000);

    try {
      // Record the game interaction
      if (blobbi && effectiveBlobbiId) {
        const score = winner === 'X' ? 100 : winner === 'O' ? 50 : winner === 'tie' ? 75 : 0;
        await playGame('tic-tac-toe', score, gameDuration, 10);
      }

      // Award coins based on outcome
      let coinsEarned = 0;
      let message = '';

      if (winner === 'X') {
        coinsEarned = 50; // Player X wins
        message = 'Player X wins! You earned 50 coins!';
      } else if (winner === 'O') {
        coinsEarned = 50; // Player O wins
        message = 'Player O wins! You earned 50 coins!';
      } else if (winner === 'tie') {
        coinsEarned = 25; // Tie game
        message = "It's a tie! You earned 25 coins!";
      } else {
        coinsEarned = 10; // Participation
        message = 'Game completed! You earned 10 coins!';
      }

      // Actually add the coins to the user's balance
      await addCoins(coinsEarned);

      toast({
        title: 'Game Over!',
        description: message,
      });
    } catch (error) {
      console.error('Failed to record game interaction:', error);
      // Still show game over message even if recording fails
      toast({
        title: 'Game Over!',
        description: winner === 'X' ? 'Player X wins!' : winner === 'O' ? 'Player O wins!' : winner === 'tie' ? "It's a tie!" : 'Game completed!',
      });
    }
  }, [effectiveBlobbiId, blobbi, playGame, toast, gameState.gameStartTime, addCoins]);

  // Handle bot moves
  useEffect(() => {
    if (gameState.gameMode === 'bot' &&
        gameState.isPlaying &&
        !gameState.isPlayerTurn &&
        !gameState.gameOver &&
        gameState.currentPlayer === 'O') {

      const timer = setTimeout(() => {
        const botMoveIndex = getBotMove(gameState.board);
        if (botMoveIndex !== -1) {
          makeMove(botMoveIndex, 'O');
        }
      }, 500); // Small delay to make bot move feel more natural

      return () => clearTimeout(timer);
    }
  }, [gameState.gameMode, gameState.isPlaying, gameState.isPlayerTurn, gameState.gameOver, gameState.currentPlayer, gameState.board, getBotMove, makeMove]);

  // Handle game over
  useEffect(() => {
    if (gameState.gameOver && !hasEndedGame) {
      setHasEndedGame(true);

      // Find and set win line for animation
      if (gameState.winner && gameState.winner !== 'tie') {
        const { winLine } = checkWinner(gameState.board);
        setWinLine(winLine);
      }

      // Delay end game to show win line animation
      setTimeout(() => {
        endGame(gameState.winner, gameState.moves);
      }, 1000);
    }
  }, [gameState.gameOver, gameState.winner, gameState.moves, gameState.board, endGame, hasEndedGame, checkWinner]);

  // Handle canvas click
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!gameState.isPlaying || !canvasRef.current) return;

    // In bot mode, only allow clicks when it's player's turn
    if (gameState.gameMode === 'bot' && !gameState.isPlayerTurn) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Calculate which cell was clicked
    const cellWidth = canvasRef.current.width / 3;
    const cellHeight = canvasRef.current.height / 3;
    const col = Math.floor(x / cellWidth);
    const row = Math.floor(y / cellHeight);
    const index = row * 3 + col;

    if (index >= 0 && index < 9) {
      makeMove(index);
    }
  }, [gameState.isPlaying, gameState.gameMode, gameState.isPlayerTurn, makeMove]);

  // Handle touch events for mobile
  const handleCanvasTouch = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (!gameState.isPlaying || !canvasRef.current) return;

    // In bot mode, only allow touches when it's player's turn
    if (gameState.gameMode === 'bot' && !gameState.isPlayerTurn) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const touch = event.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    // Calculate which cell was clicked
    const cellWidth = canvasRef.current.width / 3;
    const cellHeight = canvasRef.current.height / 3;
    const col = Math.floor(x / cellWidth);
    const row = Math.floor(y / cellHeight);
    const index = row * 3 + col;

    if (index >= 0 && index < 9) {
      makeMove(index);
    }
  }, [gameState.isPlaying, gameState.gameMode, gameState.isPlayerTurn, makeMove]);

  // Draw the game board
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cellWidth = canvas.width / 3;
      const cellHeight = canvas.height / 3;

      // Draw grid lines with playful colors
      ctx.strokeStyle = '#FF6B9D';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';

      // Vertical lines
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellWidth, 10);
        ctx.lineTo(i * cellWidth, canvas.height - 10);
        ctx.stroke();
      }

      // Horizontal lines
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(10, i * cellHeight);
        ctx.lineTo(canvas.width - 10, i * cellHeight);
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
          // Draw X with gradient
          const gradient = ctx.createLinearGradient(centerX - size, centerY - size, centerX + size, centerY + size);
          gradient.addColorStop(0, '#FF6B9D');
          gradient.addColorStop(1, '#C44569');

          ctx.strokeStyle = gradient;
          ctx.lineWidth = 8;
          ctx.lineCap = 'round';

          // Draw X
          ctx.beginPath();
          ctx.moveTo(centerX - size, centerY - size);
          ctx.lineTo(centerX + size, centerY + size);
          ctx.moveTo(centerX + size, centerY - size);
          ctx.lineTo(centerX - size, centerY + size);
          ctx.stroke();
        } else if (cell === 'O') {
          // Draw O with gradient
          const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, size);
          gradient.addColorStop(0, '#4ECDC4');
          gradient.addColorStop(1, '#26A69A');

          ctx.strokeStyle = gradient;
          ctx.lineWidth = 8;
          ctx.lineCap = 'round';

          // Draw O
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
      }
    };
  }, [gameState.board, winLine, gameState.gameOver]);

  // Resize canvas
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const container = canvasRef.current.parentElement;
        if (container) {
          const size = Math.min(container.clientWidth - 40, container.clientHeight - 40, 400);
          canvasRef.current.width = size;
          canvasRef.current.height = size;
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
                onClick={() => navigate(-1)}
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
                onClick={() => navigate(-1)}
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
                  <Button onClick={() => navigate(-1)} variant="outline">
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
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 hover:bg-purple-100 dark:hover:bg-purple-900/20"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelp(true)}
              className="flex items-center gap-2 hover:bg-purple-100 dark:hover:bg-purple-900/20"
            >
              <HelpCircle className="w-4 h-4" />
              Help
            </Button>
          </div>
        </div>

        {/* Game Stats */}
        <div className="flex justify-center gap-4 mb-4">
          <Card className="px-4 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {gameState.gameMode === 'bot' ? 'vs Bot' : gameState.gameMode === 'multiplayer' ? 'vs Player' : 'Tic-Tac-Toe'}
              </span>
            </div>
          </Card>

          <Card className="px-4 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-600" />
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {getGameStatusMessage()}
              </span>
            </div>
          </Card>
        </div>

        {/* Game Area */}
        <Card className="relative overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
          <CardContent className="p-0">
            <div className="relative w-full h-[600px] bg-gradient-to-t from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30">

              {/* Game Content */}
              {gameState.isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="flex flex-col items-center justify-center gap-8 w-full max-w-5xl">

                    {/* Game Board */}
                    <div className="flex flex-col items-center gap-6">
                      <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                        {getGameStatusMessage()}
                      </div>

                      {/* Canvas Game Board */}
                      <div className="relative">
                        <canvas
                          ref={canvasRef}
                          className="cursor-pointer bg-white/50 dark:bg-gray-800/50 rounded-lg shadow-lg border-2 border-purple-200 dark:border-purple-600"
                          onClick={handleCanvasClick}
                          onTouchStart={handleCanvasTouch}
                          style={{ touchAction: 'none' }}
                        />
                      </div>
                    </div>

                    {/* Blobbi Character */}
                    {blobbi && (
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative">
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

                        {/* Reset Button */}
                        <div className="flex gap-2">
                          <Button
                            onClick={() => gameState.gameMode && startGame(gameState.gameMode)}
                            className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Play Again
                          </Button>
                          <Button
                            onClick={resetToModeSelection}
                            variant="outline"
                            className="flex items-center gap-2 border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            Change Mode
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mode Selection Screen */}
              {!gameState.gameStarted && !gameState.gameOver && (
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="flex flex-col items-center justify-center gap-8 w-full max-w-2xl">
                    {/* Blobbi Character */}
                    {blobbi && (
                      <div className="flex flex-col items-center gap-6">
                        <div className="text-xl font-semibold text-gray-700 dark:text-gray-300">
                          Choose Your Game Mode
                        </div>
                        <div className="relative">
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
                                size="large"
                              />
                            ) : (
                              <BlobbiVisual
                                blobbi={blobbi}
                                size="large"
                              />
                            )}
                          </div>
                        </div>

                        {/* Game Mode Buttons */}
                        <div className="flex flex-col gap-4 w-full max-w-md">
                          <Button
                            onClick={() => startGame('bot')}
                            size="lg"
                            className="flex items-center gap-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-4 text-lg font-semibold shadow-lg"
                          >
                            <Play className="w-6 h-6" />
                            Play vs Bot
                          </Button>

                          <Button
                            onClick={() => {/* Multiplayer coming soon */}}
                            size="lg"
                            variant="outline"
                            disabled
                            className="flex items-center justify-between gap-3 border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 px-8 py-4 text-lg font-semibold opacity-60 cursor-not-allowed"
                          >
                            <div className="flex items-center gap-3">
                              <Users className="w-6 h-6" />
                              Play vs Another Blobbi/User
                            </div>
                            <span className="text-sm bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded">
                              Coming Soon
                            </span>
                          </Button>
                        </div>
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
                        gameState.winner === 'tie' ? 'text-yellow-600' : 'text-gray-900 dark:text-gray-100'
                      }`}>
                        {gameState.winner === 'tie' ? "It's a Tie!" : `Player ${gameState.winner} Wins!`}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-lg text-gray-900 dark:text-gray-100">
                        {gameState.winner === 'tie'
                          ? "Great game! Both players played well!"
                          : gameState.gameMode === 'bot'
                            ? (gameState.winner === 'X' ? "Congratulations! You beat the bot!" : "The bot won this time!")
                            : `Congratulations to Player ${gameState.winner}!`
                        }
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">
                        You earned {gameState.winner === 'tie' ? 25 : 50} coins!
                      </div>
                      <div className="flex gap-2 justify-center">
                        <Button
                          onClick={() => gameState.gameMode && startGame(gameState.gameMode)}
                          className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Play Again
                        </Button>
                        <Button
                          onClick={resetToModeSelection}
                          variant="outline"
                          className="border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                        >
                          Change Mode
                        </Button>
                        <Button variant="outline" onClick={() => navigate(-1)} className="border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20">
                          Back to Games
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

      {/* How to Play Modal */}
      <Dialog open={showHowToPlay} onOpenChange={setShowHowToPlay}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-600" />
              How to Play Tic-Tac-Toe
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              The classic strategy game for two players! Take turns and try to get three in a row.
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-pink-500 text-white text-sm flex items-center justify-center font-bold mt-0.5">X</div>
                <div>
                  <p className="font-medium">Player X goes first</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Click or tap any empty cell to place your X</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-teal-500 text-white text-sm flex items-center justify-center font-bold mt-0.5">O</div>
                <div>
                  <p className="font-medium">Player O goes second</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Take turns placing your symbols</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-yellow-500 text-white text-sm flex items-center justify-center font-bold mt-0.5">3</div>
                <div>
                  <p className="font-medium">Get three in a row</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Horizontally, vertically, or diagonally</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-purple-800 dark:text-purple-200">Game Rules:</h4>
              <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
                <li>• Players take turns placing X's and O's</li>
                <li>• First to get 3 in a row wins</li>
                <li>• If all 9 spaces are filled, it's a tie</li>
                <li>• Works on both desktop and mobile!</li>
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-blue-800 dark:text-blue-200">Game Modes:</h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• <strong>vs Bot:</strong> Play against a friendly AI opponent</li>
                <li>• <strong>vs Player:</strong> Multiplayer mode (coming soon!)</li>
                <li>• You always play as X and go first</li>
                <li>• The bot is casual difficulty - fun but beatable!</li>
              </ul>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">Rewards:</h4>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                <li>• Winner: 50 coins</li>
                <li>• Tie game: 25 coins each</li>
                <li>• Have fun and play again!</li>
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
              Need help with the controls?
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded border-2 border-purple-300 flex items-center justify-center">
                  <span className="text-xs">📱</span>
                </div>
                <div>
                  <p className="font-medium">Mobile & Touch</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Tap any empty cell to place your symbol</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded border-2 border-purple-300 flex items-center justify-center">
                  <span className="text-xs">🖱️</span>
                </div>
                <div>
                  <p className="font-medium">Desktop & Mouse</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Click any empty cell to place your symbol</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Strategy Tips:</h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Try to control the center square</li>
                <li>• Block your opponent's winning moves</li>
                <li>• Look for opportunities to create two ways to win</li>
                <li>• Have fun and don't take it too seriously!</li>
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