import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBlobbiAdoption } from '@/hooks/useBlobbiAdoption';
import { useBlobbonautProfile, useCreateInitialProfile } from '@/hooks/useBlobbonautProfile';
import { useToast } from '@/hooks/useToast';
import { Loader2, Heart, Sparkles, User, CheckCircle, Star, Wand2, Baby, ArrowRight, Gift } from 'lucide-react';
import { Blobbi } from '@/types/blobbi';

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
      await createInitialProfile({
        name: profileName.trim(),
        coins: 100,
        ownedBlobbis: [],
        pettingLevel: 0,
        lifetimeBlobbis: 0,
        achievements: [],
        storage: [],
      });
      
      // Wait a moment for the event to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refetch the profile to check if it was created successfully
      const { data: updatedProfile } = await refetchProfile();
      
      if (updatedProfile) {
        setProfileCreated(true);
        toast({
          title: "Profile Created! 🎉",
          description: `Welcome to Blobbi World, ${profileName.trim()}! You can now adopt your first Blobbi.`,
          duration: 3000,
        });
        setProfileName(''); // Clear the form
      } else {
        throw new Error('Profile creation verification failed');
      }
    } catch (error) {
      console.error('Failed to create Blobganaut profile:', error);
      toast({
        title: "Profile Creation Failed",
        description: "There was an error creating your profile. Please try again.",
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
        navigate('/blobbi');
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
    navigate('/blobbi');
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
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500" />
            Adopt a Blobbi
          </CardTitle>
          <CardDescription>
            Loading your profile...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const hasProfile = !!blobbonautProfile;
  const currentStep = hasProfile ? 2 : 1;
  
  // Show adoption success screen
  if (adoptionSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg mx-auto">
          <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm">
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                {/* Success Animation */}
                <div className="relative">
                  <div className="absolute inset-0 animate-ping">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-r from-pink-400 to-purple-400 rounded-full opacity-20"></div>
                  </div>
                  <div className="relative w-24 h-24 mx-auto bg-gradient-to-r from-pink-400 to-purple-400 rounded-full flex items-center justify-center">
                    <Sparkles className="h-12 w-12 text-white animate-pulse" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    🎉 Adoption Complete!
                  </h1>
                  <p className="text-lg text-gray-600">
                    Welcome to the magical world of Blobbi care!
                  </p>
                </div>

                {/* Egg Display */}
                <div className="relative p-8 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-2xl border-2 border-dashed border-purple-200">
                  <div className="absolute top-2 right-2">
                    <Star className="h-4 w-4 text-yellow-400 animate-pulse" />
                  </div>
                  <div className="text-8xl mb-4 animate-bounce">🥚</div>
                  <h3 className="text-xl font-semibold text-purple-700 mb-2">
                    {adoptedBlobbi?.name || 'Your Blobbi'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Your precious egg is now incubating! Give it love and care for 4 magical days.
                  </p>
                </div>

                {/* Care Guide */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Your Care Journey Begins
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-green-700">
                    <div className="flex items-center gap-1">
                      <span>🌡️</span> Keep warm (70%+)
                    </div>
                    <div className="flex items-center gap-1">
                      <span>✨</span> Stay clean (70%+)
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
                    className="w-full border-purple-200 text-purple-600 hover:bg-purple-50"
                  >
                    <Gift className="mr-2 h-4 w-4" />
                    Adopt Another Friend
                  </Button>
                </div>

                <div className="text-center pt-4 border-t border-purple-100">
                  <p className="text-sm text-purple-600 font-medium">
                    🌟 Your magical journey has begun!
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
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
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100">
      {/* Header Section */}
      <div className="text-center py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Blobbi Adoption Center
            </h1>
            <div className="w-12 h-12 bg-gradient-to-r from-pink-400 to-blue-400 rounded-full flex items-center justify-center">
              <Heart className="h-6 w-6 text-white" />
            </div>
          </div>
          
          <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Welcome to the magical world of Blobbis! These adorable digital creatures are waiting for a loving home. 
            Each Blobbi is unique, with its own personality and needs special care to grow and thrive.
          </p>

          {/* What is a Blobbi Section */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-purple-200">
              <div className="text-4xl mb-3">🥚</div>
              <h3 className="font-semibold text-purple-700 mb-2">Start as an Egg</h3>
              <p className="text-sm text-gray-600">Your Blobbi begins life as a magical egg that needs 4 days of loving care</p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-pink-200">
              <div className="text-4xl mb-3">🐣</div>
              <h3 className="font-semibold text-pink-700 mb-2">Hatch & Grow</h3>
              <p className="text-sm text-gray-600">With proper care, your egg hatches into a baby Blobbi ready to explore</p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-blue-200">
              <div className="text-4xl mb-3">🌟</div>
              <h3 className="font-semibold text-blue-700 mb-2">Evolve Together</h3>
              <p className="text-sm text-gray-600">Your Blobbi grows into a unique adult with special traits and abilities</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-2xl mx-auto px-4 mb-8">
        <div className="flex items-center justify-center space-x-4">
          {/* Step 1 */}
          <div className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
              currentStep >= 1 
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' 
                : 'bg-gray-200 text-gray-400'
            }`}>
              {hasProfile ? <CheckCircle className="h-5 w-5" /> : <User className="h-5 w-5" />}
            </div>
            <span className={`ml-2 font-medium transition-colors duration-300 ${
              currentStep >= 1 ? 'text-purple-600' : 'text-gray-400'
            }`}>
              Create Profile
            </span>
          </div>
          
          {/* Arrow */}
          <ArrowRight className={`h-5 w-5 transition-colors duration-300 ${
            hasProfile ? 'text-purple-400' : 'text-gray-300'
          }`} />
          
          {/* Step 2 */}
          <div className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
              currentStep >= 2 
                ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white shadow-lg' 
                : 'bg-gray-200 text-gray-400'
            }`}>
              <Heart className="h-5 w-5" />
            </div>
            <span className={`ml-2 font-medium transition-colors duration-300 ${
              currentStep >= 2 ? 'text-pink-600' : 'text-gray-400'
            }`}>
              Adopt Blobbi
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 pb-12">
        <div className="space-y-8">
          
          {/* Step 1: Profile Setup */}
          <Card className={`transition-all duration-500 transform ${
            hasProfile 
              ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg scale-95' 
              : 'border-purple-300 bg-white/80 backdrop-blur-sm shadow-xl scale-100'
          }`}>
            <CardHeader className="text-center pb-4">
              <div className="flex items-center justify-center gap-3 mb-2">
                {hasProfile ? (
                  <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-white" />
                  </div>
                )}
                <Badge variant={hasProfile ? "default" : "secondary"} className={
                  hasProfile 
                    ? "bg-green-100 text-green-700 border-green-200" 
                    : "bg-purple-100 text-purple-700 border-purple-200"
                }>
                  Step 1
                </Badge>
              </div>
              <CardTitle className={`text-2xl ${hasProfile ? 'text-green-700' : 'text-purple-700'}`}>
                {hasProfile ? '✨ Profile Complete!' : '🌟 Create Your Blobganaut Profile'}
              </CardTitle>
              <CardDescription className="text-base">
                {hasProfile 
                  ? 'Your magical journey profile is ready for adventure!'
                  : 'Every great Blobganaut needs a name to begin their magical journey'
                }
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {hasProfile ? (
                <div className="space-y-4">
                  <div className="bg-white/80 rounded-xl p-4 border border-green-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-2xl mb-1">👤</div>
                        <p className="text-sm font-medium text-green-700">Blobganaut</p>
                        <p className="text-xs text-gray-600">{blobbonautProfile.name || 'Anonymous'}</p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl mb-1">🪙</div>
                        <p className="text-sm font-medium text-green-700">Starting Coins</p>
                        <p className="text-xs text-gray-600">{blobbonautProfile.coins}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-center p-3 bg-green-100 rounded-lg border border-green-200">
                    <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
                    <p className="text-sm text-green-700 font-medium">Ready for Blobbi adoption!</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-dashed border-purple-200">
                    <Wand2 className="h-12 w-12 mx-auto text-purple-500 mb-3 animate-pulse" />
                    <p className="text-purple-700 font-medium mb-2">Begin Your Magical Journey</p>
                    <p className="text-sm text-gray-600">
                      Choose a special name that will represent you in the Blobbi world
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <Label htmlFor="profileName" className="text-base font-medium text-purple-700">
                      Your Blobganaut Name
                    </Label>
                    <Input
                      id="profileName"
                      type="text"
                      placeholder="Enter your magical name..."
                      value={profileName}
                      onChange={handleProfileNameChange}
                      disabled={isCreatingProfile}
                      maxLength={30}
                      className="text-center text-lg border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                    />
                    <p className="text-xs text-gray-500 text-center">
                      Choose wisely! This name will be known throughout the Blobbi realm
                    </p>
                  </div>
                  
                  {profileValidationError && (
                    <Alert variant="destructive" className="border-red-200 bg-red-50">
                      <AlertDescription className="text-red-700">{profileValidationError}</AlertDescription>
                    </Alert>
                  )}
                  
                  <Button 
                    onClick={handleCreateProfile} 
                    disabled={isCreatingProfile || !profileName.trim() || !!profileValidationError}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg text-lg py-6"
                  >
                    {isCreatingProfile ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Creating Your Profile...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Begin My Journey
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Blobbi Adoption */}
          <Card className={`transition-all duration-500 transform ${
            hasProfile 
              ? 'border-pink-300 bg-white/80 backdrop-blur-sm shadow-xl scale-100' 
              : 'border-gray-200 bg-gray-50/50 opacity-60 scale-95 pointer-events-none'
          }`}>
            <CardHeader className="text-center pb-4">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  hasProfile 
                    ? 'bg-gradient-to-r from-pink-400 to-blue-400' 
                    : 'bg-gray-300'
                }`}>
                  <Heart className="h-6 w-6 text-white" />
                </div>
                <Badge variant={hasProfile ? "default" : "secondary"} className={
                  hasProfile 
                    ? "bg-pink-100 text-pink-700 border-pink-200" 
                    : "bg-gray-100 text-gray-500 border-gray-200"
                }>
                  Step 2
                </Badge>
              </div>
              <CardTitle className={`text-2xl ${hasProfile ? 'text-pink-700' : 'text-gray-500'}`}>
                💝 Adopt Your First Blobbi
              </CardTitle>
              <CardDescription className="text-base">
                {hasProfile 
                  ? 'Choose a special name for your new magical companion'
                  : 'Complete your profile first to unlock this magical step'
                }
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {!hasProfile && (
                <Alert className="border-amber-200 bg-amber-50">
                  <Star className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700">
                    <strong>Almost there!</strong> Complete your Blobganaut profile above to unlock Blobbi adoption.
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Blobbi Preview */}
              <div className="relative">
                <div className={`text-center p-8 rounded-2xl border-2 border-dashed transition-all duration-300 ${
                  hasProfile 
                    ? 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 border-pink-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="absolute top-3 left-3">
                    <Star className={`h-4 w-4 ${hasProfile ? 'text-yellow-400 animate-pulse' : 'text-gray-300'}`} />
                  </div>
                  <div className="absolute top-3 right-3">
                    <Sparkles className={`h-4 w-4 ${hasProfile ? 'text-purple-400 animate-pulse' : 'text-gray-300'}`} />
                  </div>
                  
                  <div className={`text-8xl mb-4 transition-all duration-300 ${
                    hasProfile ? 'animate-bounce' : 'grayscale'
                  }`}>
                    🥚
                  </div>
                  
                  <h3 className={`text-xl font-semibold mb-2 ${
                    hasProfile ? 'text-purple-700' : 'text-gray-500'
                  }`}>
                    {petName.trim() || 'Your Blobbi'}
                  </h3>
                  
                  <p className={`text-sm ${hasProfile ? 'text-gray-600' : 'text-gray-400'}`}>
                    A magical egg waiting to begin its journey of growth and friendship
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="petName" className={`text-base font-medium ${
                  hasProfile ? 'text-pink-700' : 'text-gray-400'
                }`}>
                  Your Blobbi's Name
                </Label>
                <Input
                  id="petName"
                  type="text"
                  placeholder="Give your Blobbi a magical name..."
                  value={petName}
                  onChange={handleNameChange}
                  disabled={isAdopting || !hasProfile}
                  maxLength={20}
                  className="text-center text-lg border-pink-200 focus:border-pink-400 focus:ring-pink-400"
                />
                <p className={`text-xs text-center ${hasProfile ? 'text-gray-500' : 'text-gray-400'}`}>
                  This name will be cherished as your Blobbi grows and evolves
                </p>
              </div>
              
              {error && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{error.message || 'An error occurred'}</AlertDescription>
                </Alert>
              )}
              
              {validationError && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{validationError}</AlertDescription>
                </Alert>
              )}
              
              <Button 
                onClick={handleAdoption} 
                disabled={isAdopting || !petName.trim() || !!validationError || !hasProfile}
                className="w-full bg-gradient-to-r from-pink-500 to-blue-500 hover:from-pink-600 hover:to-blue-600 text-white shadow-lg text-lg py-6"
              >
                {isAdopting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Your Magical Companion...
                  </>
                ) : (
                  <>
                    <Heart className="mr-2 h-5 w-5" />
                    Adopt {petName.trim() || 'My Blobbi'}
                  </>
                )}
              </Button>
              
              {hasProfile && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-xl border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <Baby className="h-4 w-4" />
                    Your Adoption Journey
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                    <div className="flex items-center gap-1">
                      <span>🥚</span> Magical egg creation
                    </div>
                    <div className="flex items-center gap-1">
                      <span>💝</span> Days of loving care
                    </div>
                    <div className="flex items-center gap-1">
                      <span>🐣</span> Hatching celebration
                    </div>
                    <div className="flex items-center gap-1">
                      <span>🌟</span> Growth & evolution
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}