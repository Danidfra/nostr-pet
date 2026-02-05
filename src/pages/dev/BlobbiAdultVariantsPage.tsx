import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BlobbiLayout } from '@/components/BlobbiLayout';
import { BlobbiEvolvedVisual } from '@/components/blobbi/BlobbiEvolvedVisual';
import { Blobbi, BlobbiEvolutionForm } from '@/types/blobbi';
import { Shuffle, ChevronRight, Copy, Home, Square } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

// All possible adult evolution forms (canonical list from types)
const ADULT_EVOLUTION_FORMS: BlobbiEvolutionForm[] = [
  'blobbi',
  'pandi',
  'owli',
  'catti',
  'froggi',
  'cloudi',
  'crysti',
  'bloomi',
  'starri',
  'flammi',
  'droppi',
  'breezy',
  'rocky',
  'cacti',
  'mushie',
  'leafy',
  'rosey',
];

// Filter out 'blobbi' since it's the base form, not an evolved adult
const EVOLVED_ADULT_FORMS = ADULT_EVOLUTION_FORMS.filter(form => form !== 'blobbi');

// Create a base adult Blobbi template
function createAdultBlobbi(evolutionForm: BlobbiEvolutionForm): Blobbi {
  return {
    id: 'preview-adult',
    name: `${evolutionForm.charAt(0).toUpperCase() + evolutionForm.slice(1)} Preview`,
    ownerPubkey: 'dev-preview',
    lifeStage: 'adult',
    state: 'active',
    stats: {
      hunger: 80,
      happiness: 90,
      health: 95,
      energy: 85,
      hygiene: 90,
    },
    experience: 1000,
    birthTime: Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 days ago
    lastInteraction: Date.now(),
    evolutionForm,
    evolutionTime: Date.now() - (10 * 24 * 60 * 60 * 1000), // 10 days ago
    evolutionProgress: {
      totalCareDays: 30,
      currentStreak: 20,
      lastCareDate: Date.now(),
      careSessions: [],
      isEligibleForEvolution: true,
      nextEvolutionCheck: Date.now() + (24 * 60 * 60 * 1000),
    },
    inventory: [],
    generation: 1,
    breedingReady: false,
    careStreak: 20,
    customization: {
      color: 'purple',
      accessories: [],
    },
    coins: 0,
    baseColor: 'purple',
    secondaryColor: 'pink',
    eyeColor: 'blue',
    themeVariant: 'default',
  };
}

export default function BlobbiAdultVariantsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // DEV-ONLY: Check if in development and localhost
  const isDev = import.meta.env.DEV;
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  // State for current evolution form
  const [currentFormIndex, setCurrentFormIndex] = useState(0);
  
  // Shuffle state
  const [isShuffling, setIsShuffling] = useState(false);
  const shuffleIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const currentForm = EVOLVED_ADULT_FORMS[currentFormIndex];
  const currentBlobbi = createAdultBlobbi(currentForm);

  // Redirect to / if not in dev/localhost (safe redirect with useEffect)
  useEffect(() => {
    if (!isDev || !isLocalhost) {
      navigate('/');
    }
  }, [isDev, isLocalhost, navigate]);

  // Cleanup shuffle interval on unmount
  useEffect(() => {
    return () => {
      if (shuffleIntervalRef.current) {
        clearInterval(shuffleIntervalRef.current);
      }
    };
  }, []);

  // Toggle rapid shuffle
  const handleToggleShuffle = () => {
    if (isShuffling) {
      // Stop shuffling
      setIsShuffling(false);
      if (shuffleIntervalRef.current) {
        clearInterval(shuffleIntervalRef.current);
        shuffleIntervalRef.current = null;
      }
    } else {
      // Start shuffling
      setIsShuffling(true);
      
      // Rapid cycling: change form every 150ms
      shuffleIntervalRef.current = setInterval(() => {
        setCurrentFormIndex((prevIndex) => {
          let newIndex: number;
          do {
            newIndex = Math.floor(Math.random() * EVOLVED_ADULT_FORMS.length);
          } while (newIndex === prevIndex && EVOLVED_ADULT_FORMS.length > 1);
          return newIndex;
        });
      }, 150); // 150ms for rapid cycling
    }
  };

  // Stop shuffling when unmounting
  useEffect(() => {
    if (isShuffling) {
      return () => {
        if (shuffleIntervalRef.current) {
          clearInterval(shuffleIntervalRef.current);
          shuffleIntervalRef.current = null;
        }
      };
    }
  }, [isShuffling]);

  // Next form (sequential)
  const handleNext = () => {
    const newIndex = (currentFormIndex + 1) % EVOLVED_ADULT_FORMS.length;
    setCurrentFormIndex(newIndex);
  };

  // Copy JSON to clipboard
  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(currentBlobbi, null, 2));
      toast({
        title: "Copied!",
        description: "Blobbi JSON copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  // If not dev/localhost, show nothing while redirecting
  if (!isDev || !isLocalhost) {
    return null;
  }

  return (
    <BlobbiLayout>
      <div
        className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-t-2 border-t-purple-300 dark:border-t-purple-600 overflow-y-auto px-4 py-6"
        style={{ minHeight: 'calc(100dvh - var(--app-header-h))' }}
      >
        {/* Decorative gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/30 dark:to-pink-900/30" />
        
        {/* Real content wrapper */}
        <div className="relative z-10 container mx-auto max-w-4xl h-full flex flex-col">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">
                Adult Blobbi Variants
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                DEV ONLY - Preview all adult evolution forms
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Button>
          </div>

          {/* Main Content - Centered, no Card wrapper */}
          <div className="flex-1 flex flex-col items-center justify-center space-y-6 pb-8">
            
            {/* Title and Badge */}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-3">
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  {currentFormIndex + 1} / {EVOLVED_ADULT_FORMS.length}
                </Badge>
                {isShuffling && (
                  <Badge variant="outline" className="border-purple-400 dark:border-purple-500 text-purple-700 dark:text-purple-300 animate-pulse">
                    Shuffling...
                  </Badge>
                )}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-gray-100 capitalize">
                {currentForm}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Adult Evolution Form
              </p>
            </div>

            {/* Blobbi Visual - Centered and Large */}
            <div className="flex items-center justify-center">
              <div className="w-[280px] h-[280px] sm:w-[360px] sm:h-[360px]">
                <BlobbiEvolvedVisual
                  blobbi={currentBlobbi}
                  size="large"
                  className="w-full h-full"
                />
              </div>
            </div>

            {/* Controls - Below Blobbi */}
            <div className="w-full max-w-2xl space-y-4">
              {/* Primary Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  onClick={handleToggleShuffle}
                  className={cn(
                    "w-full text-white transition-all",
                    isShuffling
                      ? "bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
                      : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  )}
                  size="lg"
                >
                  {isShuffling ? (
                    <>
                      <Square className="mr-2 h-5 w-5" />
                      Stop Shuffle
                    </>
                  ) : (
                    <>
                      <Shuffle className="mr-2 h-5 w-5" />
                      Rapid Shuffle
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={handleNext}
                  variant="outline"
                  className="w-full"
                  size="lg"
                  disabled={isShuffling}
                >
                  <ChevronRight className="mr-2 h-5 w-5" />
                  Next
                </Button>
                
                <Button
                  onClick={handleCopyJson}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  <Copy className="mr-2 h-5 w-5" />
                  Copy JSON
                </Button>
              </div>

              {/* Quick Select - All Forms */}
              <div className="p-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg border border-purple-200 dark:border-purple-600">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 text-center">
                  Quick Select ({EVOLVED_ADULT_FORMS.length} forms)
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {EVOLVED_ADULT_FORMS.map((form, index) => (
                    <Button
                      key={form}
                      variant={index === currentFormIndex ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setCurrentFormIndex(index);
                        // Stop shuffling when manually selecting
                        if (isShuffling) {
                          setIsShuffling(false);
                          if (shuffleIntervalRef.current) {
                            clearInterval(shuffleIntervalRef.current);
                            shuffleIntervalRef.current = null;
                          }
                        }
                      }}
                      disabled={isShuffling}
                      className={cn(
                        "capitalize text-xs",
                        index === currentFormIndex && "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                      )}
                    >
                      {form}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </BlobbiLayout>
  );
}
