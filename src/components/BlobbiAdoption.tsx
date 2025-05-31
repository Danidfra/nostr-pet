import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBlobbiAdoption } from '@/hooks/useBlobbiAdoption';
import { Loader2, Heart, Sparkles } from 'lucide-react';

export function BlobbiAdoption() {
  const [petName, setPetName] = useState('');
  const [adoptionSuccess, setAdoptionSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const { user } = useCurrentUser();
  const { adoptBlobbi, isAdopting, error, reset, validatePetName } = useBlobbiAdoption();
  
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
      await adoptBlobbi({ petName: petName.trim() });
      setAdoptionSuccess(true);
      setPetName('');
    } catch (err) {
      console.error('Failed to adopt Blobbi:', err);
    }
  };
  
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPetName(e.target.value);
    setValidationError(null); // Clear validation error when user types
  };
  
  const handleReset = () => {
    setAdoptionSuccess(false);
    setValidationError(null);
    reset();
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
  
  if (adoptionSuccess) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <Sparkles className="h-5 w-5" />
            Adoption Successful!
          </CardTitle>
          <CardDescription>
            Your new Blobbi egg has been created and is ready for care
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border-2 border-dashed border-blue-200">
            <div className="text-6xl mb-2">🥚</div>
            <p className="text-sm text-gray-600">
              Your Blobbi egg is incubating and will need daily care for 4 days before hatching!
            </p>
          </div>
          
          <Alert>
            <AlertDescription>
              <strong>Care Instructions:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li>• Keep temperature above 70%</li>
                <li>• Maintain cleanliness above 70%</li>
                <li>• Provide emotional bonding daily</li>
                <li>• Monitor health (keep above 50%)</li>
              </ul>
            </AlertDescription>
          </Alert>
          
          <Button onClick={handleReset} className="w-full">
            Adopt Another Blobbi
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-pink-500" />
          Adopt a Blobbi
        </CardTitle>
        <CardDescription>
          Give a name to your new virtual pet and start your journey together
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg">
          <div className="text-6xl mb-2">🥚</div>
          <p className="text-sm text-gray-600">
            Your Blobbi will start as an egg that needs 4 days of care to hatch
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="petName">Pet Name</Label>
          <Input
            id="petName"
            type="text"
            placeholder="Enter a name for your Blobbi"
            value={petName}
            onChange={handleNameChange}
            disabled={isAdopting}
            maxLength={20}
          />
          <p className="text-xs text-gray-500">
            2-20 characters, letters, numbers, underscores, and hyphens only
          </p>
        </div>
        
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error.message || 'An error occurred'}</AlertDescription>
          </Alert>
        )}
        
        {validationError && (
          <Alert variant="destructive">
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}
        
        <Button 
          onClick={handleAdoption} 
          disabled={isAdopting || !petName.trim() || !!validationError}
          className="w-full"
        >
          {isAdopting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating your Blobbi...
            </>
          ) : (
            <>
              <Heart className="mr-2 h-4 w-4" />
              Adopt Blobbi
            </>
          )}
        </Button>
        
        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>What happens next:</strong></p>
          <ul className="space-y-1">
            <li>• A unique Blobbi egg will be created</li>
            <li>• You'll need to care for it daily for 4 days</li>
            <li>• After proper care, your Blobbi will hatch</li>
            <li>• It will then grow from baby to adult stage</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}