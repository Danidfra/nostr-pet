import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Save, X, Plus } from 'lucide-react';
import { useBlobbonautProfile, useUpdateBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { BlobbonautProfile } from '@/types/blobbi';

interface EditBlobbonautProfileProps {
  isOpen: boolean;
  onClose: () => void;
  profileId?: string;
}

const STYLE_OPTIONS = [
  { value: 'classic', label: 'Classic' },
  { value: 'punk', label: 'Punk' },
  { value: 'kawaii', label: 'Kawaii' },
  { value: 'gothic', label: 'Gothic' },
  { value: 'cyberpunk', label: 'Cyberpunk' },
  { value: 'retro', label: 'Retro' },
  { value: 'minimalist', label: 'Minimalist' },
];

const BACKGROUND_OPTIONS = [
  { value: 'space-station', label: 'Space Station' },
  { value: 'enchanted-forest', label: 'Enchanted Forest' },
  { value: 'crystal-cave', label: 'Crystal Cave' },
  { value: 'floating-islands', label: 'Floating Islands' },
  { value: 'neon-city', label: 'Neon City' },
  { value: 'underwater-palace', label: 'Underwater Palace' },
  { value: 'cloud-kingdom', label: 'Cloud Kingdom' },
  { value: 'volcanic-realm', label: 'Volcanic Realm' },
];

const TITLE_OPTIONS = [
  'Space Caretaker',
  'Blobbi Whisperer',
  'Pet Master',
  'Guardian of Blobbis',
  'Cosmic Companion',
  'Digital Shepherd',
  'Blobbi Sage',
  'Creature Curator',
  'Virtual Veterinarian',
  'Blobbi Champion',
];

export function EditBlobbonautProfile({ isOpen, onClose, profileId }: EditBlobbonautProfileProps) {
  const { user } = useCurrentUser();
  const { data: currentProfile, isLoading } = useBlobbonautProfile(profileId);
  const { mutate: updateProfile, isPending: isUpdating } = useUpdateBlobbonautProfile();
  const { toast } = useToast();

  const [formData, setFormData] = useState<Partial<BlobbonautProfile>>({});
  const [newAchievement, setNewAchievement] = useState('');
  const [showAddAchievement, setShowAddAchievement] = useState(false);

  // Initialize form data when profile loads
  useEffect(() => {
    if (currentProfile) {
      setFormData({
        name: currentProfile.name || '',
        style: currentProfile.style || '',
        background: currentProfile.background || '',
        title: currentProfile.title || '',
        favoriteBlobbi: currentProfile.favoriteBlobbi || '',
      });
    }
  }, [currentProfile]);

  if (!user || !currentProfile) {
    return null;
  }

  const isOwnProfile = user.pubkey === currentProfile.ownerPubkey;
  if (!isOwnProfile) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Access Denied</DialogTitle>
            <DialogDescription>
              You can only edit your own Blobbonaut Profile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const handleSave = () => {
    const updatedProfile: BlobbonautProfile = {
      ...currentProfile,
      name: formData.name || undefined,
      style: formData.style || undefined,
      background: formData.background || undefined,
      title: formData.title || undefined,
      favoriteBlobbi: formData.favoriteBlobbi || undefined,
    };

    updateProfile(updatedProfile, {
      onSuccess: () => {
        toast({
          title: "Profile Updated",
          description: "Your Blobbonaut Profile has been successfully updated.",
        });
        onClose();
      },
      onError: (error) => {
        toast({
          title: "Update Failed",
          description: error instanceof Error ? error.message : "Failed to update profile.",
          variant: "destructive",
        });
      },
    });
  };

  const handleAddAchievement = () => {
    if (!newAchievement.trim()) return;

    const achievementId = newAchievement.toLowerCase().replace(/\s+/g, '-');
    if (currentProfile.achievements.includes(achievementId)) {
      toast({
        title: "Achievement Already Exists",
        description: "This achievement is already in your profile.",
        variant: "destructive",
      });
      return;
    }

    const updatedProfile: BlobbonautProfile = {
      ...currentProfile,
      achievements: [...currentProfile.achievements, achievementId],
    };

    updateProfile(updatedProfile, {
      onSuccess: () => {
        toast({
          title: "Achievement Added",
          description: `Added "${newAchievement}" to your achievements.`,
        });
        setNewAchievement('');
        setShowAddAchievement(false);
      },
      onError: (error) => {
        toast({
          title: "Failed to Add Achievement",
          description: error instanceof Error ? error.message : "Failed to add achievement.",
          variant: "destructive",
        });
      },
    });
  };

  const handleRemoveAchievement = (achievementId: string) => {
    const updatedProfile: BlobbonautProfile = {
      ...currentProfile,
      achievements: currentProfile.achievements.filter(id => id !== achievementId),
    };

    updateProfile(updatedProfile, {
      onSuccess: () => {
        toast({
          title: "Achievement Removed",
          description: "Achievement has been removed from your profile.",
        });
      },
      onError: (error) => {
        toast({
          title: "Failed to Remove Achievement",
          description: error instanceof Error ? error.message : "Failed to remove achievement.",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[85vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Edit Blobbonaut Profile</DialogTitle>
          <DialogDescription>
            Customize your Blobbonaut Profile appearance and information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Stats (Read-only) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Profile Stats</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Coins</Label>
                <p className="font-medium">{currentProfile.coins.toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Petting Level</Label>
                <p className="font-medium">{currentProfile.pettingLevel}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Current Blobbis</Label>
                <p className="font-medium">{currentProfile.ownedBlobbis.length}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Lifetime Blobbis</Label>
                <p className="font-medium">{currentProfile.lifetimeBlobbis}</p>
              </div>
            </CardContent>
          </Card>

          {/* Customization Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter your display name"
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This name will be shown on your profile and can be changed at any time.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="style">Style</Label>
                  <Select
                    value={formData.style || ''}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, style: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {STYLE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="background">Background</Label>
                  <Select
                    value={formData.background || ''}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, background: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a background" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {BACKGROUND_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="title">Title</Label>
                <Select
                  value={formData.title || ''}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, title: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a title" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {TITLE_OPTIONS.map(title => (
                      <SelectItem key={title} value={title}>
                        {title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="favoriteBlobbi">Favorite Blobbi</Label>
                <Select
                  value={formData.favoriteBlobbi || ''}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, favoriteBlobbi: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your favorite Blobbi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {currentProfile.ownedBlobbis.map(blobbiId => (
                      <SelectItem key={blobbiId} value={blobbiId}>
                        {blobbiId.replace('blobbi-', '')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                Achievements
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddAchievement(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {currentProfile.achievements.map((achievement, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => handleRemoveAchievement(achievement)}
                  >
                    {achievement.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
                {currentProfile.achievements.length === 0 && (
                  <p className="text-sm text-muted-foreground">No achievements yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isUpdating}>
            <Save className="w-4 h-4 mr-2" />
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Add Achievement Dialog */}
      <Dialog open={showAddAchievement} onOpenChange={setShowAddAchievement}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Achievement</DialogTitle>
            <DialogDescription>
              Add a new achievement to your profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newAchievement">Achievement Name</Label>
              <Input
                id="newAchievement"
                value={newAchievement}
                onChange={(e) => setNewAchievement(e.target.value)}
                placeholder="Enter achievement name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAchievement(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAchievement} disabled={!newAchievement.trim()}>
              Add Achievement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}