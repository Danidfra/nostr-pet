import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBlobbiAdoption, ADOPTION_FEE } from '@/hooks/useBlobbiAdoption';
import { useBlobbonautProfile, useCreateInitialProfile } from '@/hooks/useBlobbonautProfile';
import { useToast } from '@/hooks/useToast';
import { Loader2, Heart, Sparkles, User, CheckCircle, Star, Wand2, Baby, Gift, Coins, Info, ChevronDown } from 'lucide-react';
import { Blobbi } from '@/types/blobbi';
import { cn } from '@/lib/utils';

export function BlobbiAdoption() {
  // Profile creation state
  const [profileName, setProfileName] = useState('');
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [profileValidationError, setProfileValidationError] = useState<string | null>(null);
  const [profileCreated, setProfileCreated] = useState(false);

  // Adoption state
  const [petName, setPetName] = useState('');
  const [adoptionSuccess, setAdoptionSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [adoptedBlobbi, setAdoptedBlobbi] = useState<Blobbi | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { adoptBlobbi, isAdopting, error, reset, validatePetName } = useBlobbiAdoption();
  const { data: blobbonautProfile, isLoading: isLoadingProfile, refetch: refetchProfile } = useBlobbonautProfile();
  const { mutateAsync: createInitialProfile } = useCreateInitialProfile();

  // Profile validation function
  const validateProfileName = (name: string): { isValid: boolean; error?: string } => {
    if (!name.trim()) {
      return { isValid: false, error: 'Profile name is required' };
    }

    if (name.trim().length < 2) {
      return { isValid: false, error: 'Profile name must be at least 2 characters long' };
    }

    if (name.trim().length > 30) {
      return { isValid: false, error: 'Profile name must be 30 characters or less' };
    }

    // Allow letters, numbers, spaces, and common punctuation
    if (!/^[a-zA-Z0-9\s\-_'.]+$/.test(name.trim())) {
      return { isValid: false, error: 'Profile name can only contain letters, numbers, spaces, hyphens, underscores, apostrophes, and periods' };
    }

    return { isValid: true };
  };

  // Handle profile creation
  const handleCreateProfile = async () => {
    if (!user) {
      return;
    }

    const validation = validateProfileName(profileName);
    if (!validation.isValid) {
      setProfileValidationError(validation.error || 'Invalid profile name');
      return;
    }

    setProfileValidationError(null);
    setIsCreatingProfile(true);

    try {
      // Create the initial profile - this publishes the event and invalidates queries
      const createdProfile = await createInitialProfile({
        name: profileName.trim(),
        coins: 100,
        ownedBlobbis: [],
        pettingLevel: 0,
        lifetimeBlobbis: 0,
        achievements: [],
        storage: [],
      });

      // Profile was successfully created and published
      // The mutation's onSuccess callback already invalidated the queries
      // So the useBlobbonautProfile hook will automatically refetch

      setProfileCreated(true);
      toast({
        title: "Profile Created! 🎉",
        description: `Welcome to Blobbi World, ${profileName.trim()}! You can now adopt your first Blobbi.`,
        duration: 3000,
      });
      setProfileName(''); // Clear the form

      // Optionally trigger a manual refetch to ensure UI updates immediately
      // This is belt-and-suspenders since the invalidation should handle it
      refetchProfile();
    } catch (error) {
      console.error('Failed to create Blobbonaut profile:', error);
      toast({
        title: "Profile Creation Failed",
        description: error instanceof Error ? error.message : "There was an error creating your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingProfile(false);
    }
  };

  // Handle profile name input change
  const handleProfileNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileName(e.target.value);
    setProfileValidationError(null);
  };

  const handleAdoption = async () => {
    if (!user) {
      return;
    }

    const validation = validatePetName(petName);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid pet name');
      return;
    }

    setValidationError(null);

    try {
      const newBlobbi = await adoptBlobbi({ petName: petName.trim() });
      setAdoptedBlobbi(newBlobbi);
      setAdoptionSuccess(true);
      setPetName('');

      // Show success toast
      toast({
        title: "Adoption Successful! 🎉",
        description: `${newBlobbi.name} has been adopted and is ready for care!`,
        duration: 3000,
      });

      // Navigate to the new Blobbi's page after a short delay to show success message
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      console.error('Failed to adopt Blobbi:', err);
      toast({
        title: "Adoption Failed",
        description: "There was an error adopting your Blobbi. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPetName(e.target.value);
    setValidationError(null); // Clear validation error when user types
  };

  const handleReset = () => {
    setAdoptionSuccess(false);
    setValidationError(null);
    setAdoptedBlobbi(null);
    reset();
  };

  const handleGoToBlobbi = () => {
    navigate('/');
  };

  if (!user) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500" />
            Adopt a Blobbi
          </CardTitle>
          <CardDescription>
            You need to be logged in to adopt a Blobbi pet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Please log in to start your Blobbi adoption journey!
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Show loading state while checking for profile
  if (isLoadingProfile) {
    return (
      <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-t-2 border-t-purple-300 dark:border-t-purple-600 overflow-y-auto px-4 py-6"
        style={{ minHeight: 'calc(100dvh - var(--app-header-h))' }}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/30 dark:to-pink-900/30" />
        
        <div className="relative z-10 container mx-auto max-w-lg flex items-center justify-center" style={{ minHeight: 'calc(100dvh - var(--app-header-h) - 3rem)' }}>
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-600 dark:text-purple-400" />
            <p className="text-sm text-gray-600 dark:text-gray-300">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  const hasProfile = !!blobbonautProfile;
  const currentStep = hasProfile ? 2 : 1;
  const hasEnoughCoins = hasProfile && blobbonautProfile.coins >= ADOPTION_FEE;

  // Show adoption success screen
  if (adoptionSuccess) {
    return (
      <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-t-2 border-t-purple-300 dark:border-t-purple-600 overflow-y-auto px-4 py-6"
        style={{ minHeight: 'calc(100dvh - var(--app-header-h))' }}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/30 dark:to-pink-900/30" />
        
        <div className="relative z-10 container mx-auto max-w-lg flex items-center justify-center py-8">
          <Card className="w-full border-purple-200 dark:border-purple-600 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-xl">
            <CardContent className="p-6 sm:p-8">
              <div className="text-center space-y-6">
                {/* Success Animation */}
                <div className="relative">
                  <div className="absolute inset-0 animate-ping">
                    <div className="w-20 h-20 mx-auto bg-gradient-to-r from-pink-400 to-purple-400 rounded-full opacity-20"></div>
                  </div>
                  <div className="relative w-20 h-20 mx-auto bg-gradient-to-r from-pink-400 to-purple-400 rounded-full flex items-center justify-center">
                    <Sparkles className="h-10 w-10 text-white animate-pulse" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                    Adoption Complete!
                  </h1>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
                    Welcome to the magical world of Blobbi care!
                  </p>
                </div>

                {/* Egg Display */}
                <div className="relative p-6 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-pink-900/20 rounded-2xl border-2 border-dashed border-purple-200 dark:border-purple-600">
                  <div className="absolute top-2 right-2">
                    <Star className="h-4 w-4 text-yellow-400 animate-pulse" />
                  </div>
                  <div className="text-6xl sm:text-7xl mb-3 animate-bounce">🥚</div>
                  <h3 className="text-lg sm:text-xl font-semibold text-purple-700 dark:text-purple-300 mb-2">
                    {adoptedBlobbi?.name || 'Your Blobbi'}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                    Your precious egg is now ready! Give it love and care to help it grow.
                  </p>
                </div>

                {/* Care Guide */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-3 sm:p-4 rounded-xl border border-green-200 dark:border-green-700">
                  <h4 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2 flex items-center gap-2 justify-center">
                    <Heart className="h-4 w-4" />
                    Your Care Journey Begins
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-green-700 dark:text-green-300">
                    <div className="flex items-center gap-1">
                      <span>🌡️</span> <span className="hidden sm:inline">Keep warm (70%+)</span><span className="sm:hidden">Keep warm</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>✨</span> <span className="hidden sm:inline">Stay clean (70%+)</span><span className="sm:hidden">Stay clean</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>💝</span> Daily bonding
                    </div>
                    <div className="flex items-center gap-1">
                      <span>❤️</span> Monitor health
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button
                    onClick={handleGoToBlobbi}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg"
                    size="lg"
                  >
                    <Baby className="mr-2 h-5 w-5" />
                    Meet Your Blobbi
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    className="w-full border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  >
                    <Gift className="mr-2 h-4 w-4" />
                    Adopt Another Friend
                  </Button>
                </div>

                <div className="text-center pt-4 border-t border-purple-100 dark:border-purple-700">
                  <p className="text-xs sm:text-sm text-purple-600 dark:text-purple-400 font-medium">
                    Your magical journey has begun!
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Redirecting to your Blobbi in a moment...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-t-2 border-t-purple-300 dark:border-t-purple-600 overflow-y-auto px-4 py-6"
      style={{ minHeight: 'calc(100dvh - var(--app-header-h))' }}
    >
      {/* Decorative gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/30 dark:to-pink-900/30" />
      
      {/* Real content wrapper */}
      <div className="relative z-10 mx-auto w-full max-w-2xl px-0 space-y-2 sm:px-2">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">
              Adoption Center
            </h1>
            <Heart className="h-5 w-5 sm:h-6 sm:w-6 text-pink-600 dark:text-pink-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 max-w-md mx-auto">
            Begin your magical journey with a Blobbi companion
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-3 py-2">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all",
            currentStep === 1 ? "bg-purple-100 dark:bg-purple-900/30" : "bg-green-100 dark:bg-green-900/30"
          )}>
            {hasProfile ? (
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <User className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            )}
            <span className={cn(
              "text-xs sm:text-sm font-medium",
              hasProfile ? "text-green-700 dark:text-green-300" : "text-purple-700 dark:text-purple-300"
            )}>
              Step 1
            </span>
          </div>
          
          <div className={cn(
            "w-8 h-0.5 transition-colors",
            hasProfile ? "bg-purple-300 dark:bg-purple-600" : "bg-gray-300 dark:bg-gray-600"
          )} />
          
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all",
            currentStep === 2 ? "bg-pink-100 dark:bg-pink-900/30" : "bg-gray-100 dark:bg-gray-700/30"
          )}>
            <Heart className={cn(
              "h-4 w-4",
              currentStep === 2 ? "text-pink-600 dark:text-pink-400" : "text-gray-400 dark:text-gray-500"
            )} />
            <span className={cn(
              "text-xs sm:text-sm font-medium",
              currentStep === 2 ? "text-pink-700 dark:text-pink-300" : "text-gray-500 dark:text-gray-400"
            )}>
              Step 2
            </span>
          </div>
        </div>

        {/* Learn More Collapsible */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-sm"
            >
              <Info className="h-4 w-4 mr-2" />
              Learn about Blobbis
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-3">
            <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-purple-200 dark:border-purple-600">
              <div className="text-3xl mb-2">🥚</div>
              <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-1">Start as an Egg</h3>
              <p className="text-xs text-gray-600 dark:text-gray-300">Your Blobbi begins life as a magical egg that needs loving care</p>
            </div>
            <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-pink-200 dark:border-pink-600">
              <div className="text-3xl mb-2">🐣</div>
              <h3 className="text-sm font-semibold text-pink-700 dark:text-pink-300 mb-1">Hatch & Grow</h3>
              <p className="text-xs text-gray-600 dark:text-gray-300">With proper care, your egg hatches into a baby Blobbi</p>
            </div>
            <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-blue-200 dark:border-blue-600">
              <div className="text-3xl mb-2">🌟</div>
              <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">Evolve Together</h3>
              <p className="text-xs text-gray-600 dark:text-gray-300">Your Blobbi grows into a unique adult with special traits</p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Main Step Card - Show Only One at a Time */}
        {!hasProfile ? (
          /* Step 1: Profile Setup */
          <Card className={cn(
            "transition-all duration-300 border-purple-300 dark:border-purple-600 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-xl",
            !hasProfile && "animate-in fade-in slide-in-from-bottom-4"
          )}>
            <CardHeader className="text-center pb-4 space-y-3">
              <div className="w-12 h-12 mx-auto bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl text-purple-700 dark:text-purple-300">
                  Create Your Profile
                </CardTitle>
                <CardDescription className="text-sm mt-2">
                  Every great Blobbonaut needs a name to begin their magical journey
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-600">
                <Wand2 className="h-10 w-10 mx-auto text-purple-500 dark:text-purple-400 mb-2 animate-pulse" />
                <p className="text-sm text-purple-700 dark:text-purple-300 font-medium mb-1">Begin Your Magical Journey</p>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Choose a name that will represent you in the Blobbi world
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profileName" className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  Your Blobbonaut Name
                </Label>
                <Input
                  id="profileName"
                  type="text"
                  placeholder="Enter your magical name..."
                  value={profileName}
                  onChange={handleProfileNameChange}
                  disabled={isCreatingProfile}
                  maxLength={30}
                  className="text-center bg-white dark:bg-gray-700 border-purple-200 dark:border-purple-600 focus:border-purple-400 dark:focus:border-purple-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  2-30 characters, letters, numbers, and basic punctuation
                </p>
              </div>

              {profileValidationError && (
                <Alert variant="destructive" className="border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
                  <AlertDescription className="text-sm text-red-700 dark:text-red-300">{profileValidationError}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleCreateProfile}
                disabled={isCreatingProfile || !profileName.trim() || !!profileValidationError}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg"
                size="lg"
              >
                {isCreatingProfile ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Profile...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Begin My Journey
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Step 2: Blobbi Adoption */
          <Card className={cn(
            "transition-all duration-300 border-pink-300 dark:border-pink-600 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-xl",
            hasProfile && "animate-in fade-in slide-in-from-bottom-4"
          )}>
            <CardHeader className="text-center pb-4 space-y-3">
              <div className="w-12 h-12 mx-auto bg-gradient-to-r from-pink-400 to-blue-400 rounded-full flex items-center justify-center">
                <Heart className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl text-pink-700 dark:text-pink-300">
                  Adopt Your First Blobbi
                </CardTitle>
                <CardDescription className="text-sm mt-2">
                  Choose a special name for your new magical companion
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {!hasEnoughCoins && (
                <Alert variant="destructive" className="border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
                  <Coins className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertDescription className="text-sm text-red-700 dark:text-red-300">
                    <strong>Insufficient coins!</strong> You need {ADOPTION_FEE} coins but have {blobbonautProfile.coins}.
                  </AlertDescription>
                </Alert>
              )}

              {/* Blobbi Preview */}
              <div className="relative">
                <div className="text-center p-6 rounded-xl border-2 border-dashed bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-pink-900/20 border-pink-200 dark:border-pink-600">
                  <div className="absolute top-2 left-2">
                    <Star className="h-4 w-4 text-yellow-400 animate-pulse" />
                  </div>
                  <div className="absolute top-2 right-2">
                    <Sparkles className="h-4 w-4 text-purple-400 animate-pulse" />
                  </div>

                  <div className="text-6xl sm:text-7xl mb-3 animate-bounce">🥚</div>

                  <h3 className="text-lg font-semibold text-purple-700 dark:text-purple-300 mb-1">
                    {petName.trim() || 'Your Blobbi'}
                  </h3>

                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    A magical egg waiting to begin its journey
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="petName" className="text-sm font-medium text-pink-700 dark:text-pink-300">
                  Your Blobbi's Name
                </Label>
                <Input
                  id="petName"
                  type="text"
                  placeholder="Give your Blobbi a magical name..."
                  value={petName}
                  onChange={handleNameChange}
                  disabled={isAdopting}
                  maxLength={20}
                  className="text-center bg-white dark:bg-gray-700 border-pink-200 dark:border-pink-600 focus:border-pink-400 dark:focus:border-pink-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  This name will be cherished as your Blobbi grows
                </p>
              </div>

              {error && (
                <Alert variant="destructive" className="border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
                  <AlertDescription className="text-sm text-red-700 dark:text-red-300">{error.message || 'An error occurred'}</AlertDescription>
                </Alert>
              )}

              {validationError && (
                <Alert variant="destructive" className="border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
                  <AlertDescription className="text-sm text-red-700 dark:text-red-300">{validationError}</AlertDescription>
                </Alert>
              )}

              {/* Adoption Fee Information */}
              <div className={cn(
                "p-3 rounded-xl border transition-all",
                hasEnoughCoins
                  ? "bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-200 dark:border-emerald-600"
                  : "bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-200 dark:border-red-600"
              )}>
                <div className="flex items-center justify-between mb-1">
                  <h4 className={cn(
                    "text-sm font-semibold flex items-center gap-2",
                    hasEnoughCoins ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"
                  )}>
                    <Coins className="h-4 w-4" />
                    Adoption Fee
                  </h4>
                  <div className={cn(
                    "text-base font-bold",
                    hasEnoughCoins ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
                  )}>
                    {ADOPTION_FEE} coins
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className={hasEnoughCoins ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    Your balance: {blobbonautProfile.coins} coins
                  </span>
                  {hasEnoughCoins ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Ready
                    </span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      Need {ADOPTION_FEE - blobbonautProfile.coins} more
                    </span>
                  )}
                </div>
              </div>

              <Button
                onClick={handleAdoption}
                disabled={isAdopting || !petName.trim() || !!validationError || !hasEnoughCoins}
                className="w-full bg-gradient-to-r from-pink-500 to-blue-500 hover:from-pink-600 hover:to-blue-600 text-white shadow-lg"
                size="lg"
              >
                {isAdopting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Your Companion...
                  </>
                ) : (
                  <>
                    <Heart className="mr-2 h-5 w-5" />
                    Adopt {petName.trim() || 'My Blobbi'} ({ADOPTION_FEE} coins)
                  </>
                )}
              </Button>

              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-3 rounded-xl border border-blue-200 dark:border-blue-600">
                <h4 className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2 justify-center">
                  <Baby className="h-3 w-3" />
                  Your Journey Ahead
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-blue-700 dark:text-blue-300">
                  <div className="flex items-center gap-1">
                    <span>🥚</span> Egg creation
                  </div>
                  <div className="flex items-center gap-1">
                    <span>💝</span> Loving care
                  </div>
                  <div className="flex items-center gap-1">
                    <span>🐣</span> Hatching day
                  </div>
                  <div className="flex items-center gap-1">
                    <span>🌟</span> Evolution
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}