import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Coins, 
  Heart, 
  Trophy, 
  Star, 
  Users, 
  Palette,
  Crown,
  Settings
} from 'lucide-react';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';

interface BlobbonautProfileCardProps {
  profileId?: string;
  showEditButton?: boolean;
  onEdit?: () => void;
}

export function BlobbonautProfileCard({ 
  profileId, 
  showEditButton = false, 
  onEdit 
}: BlobbonautProfileCardProps) {
  const { user } = useCurrentUser();
  const { data: profile, isLoading } = useBlobbonautProfile(profileId);
  const author = useAuthor(profile?.ownerPubkey);
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-muted rounded-full"></div>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-32"></div>
                <div className="h-3 bg-muted rounded w-24"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-muted rounded w-full"></div>
              <div className="h-3 bg-muted rounded w-3/4"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No Blobbanaut Profile found</p>
        </CardContent>
      </Card>
    );
  }

  const isOwnProfile = user?.pubkey === profile.ownerPubkey;
  const displayName = profile.name || 
                     author.data?.metadata?.name || 
                     author.data?.metadata?.display_name || 
                     profile.ownerPubkey.slice(0, 8);
  const profileImage = author.data?.metadata?.picture;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={profileImage} alt={displayName} />
              <AvatarFallback className="text-lg">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="flex items-center gap-2">
                {displayName}
                {profile.title && (
                  <Badge variant="secondary" className="text-xs">
                    <Crown className="w-3 h-3 mr-1" />
                    {profile.title}
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Blobbanaut Level {Math.floor(profile.pettingLevel / 10) + 1}
              </p>
            </div>
          </div>
          {showEditButton && isOwnProfile && onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Settings className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Coins className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-sm font-medium">{profile.coins.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Coins</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Heart className="w-5 h-5 text-pink-500" />
            <div>
              <p className="text-sm font-medium">{profile.pettingLevel}</p>
              <p className="text-xs text-muted-foreground">Petting Level</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-sm font-medium">{profile.ownedBlobbis.length}</p>
              <p className="text-xs text-muted-foreground">Current Blobbis</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-sm font-medium">{profile.lifetimeBlobbis}</p>
              <p className="text-xs text-muted-foreground">Lifetime Blobbis</p>
            </div>
          </div>
        </div>

        {/* Achievements */}
        {profile.achievements.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Star className="w-4 h-4" />
              Achievements
            </h4>
            <div className="flex flex-wrap gap-1">
              {profile.achievements.slice(0, 6).map((achievement, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {achievement.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
              ))}
              {profile.achievements.length > 6 && (
                <Badge variant="outline" className="text-xs">
                  +{profile.achievements.length - 6} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Favorite & Starter Blobbi */}
        <div className="grid grid-cols-1 gap-3">
          {profile.favoriteBlobbi && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Favorite Blobbi</p>
              <Badge variant="secondary" className="text-xs">
                <Heart className="w-3 h-3 mr-1 text-pink-500" />
                {profile.favoriteBlobbi.replace('blobbi-', '')}
              </Badge>
            </div>
          )}
          
          {profile.starterBlobbi && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Starter Blobbi</p>
              <Badge variant="secondary" className="text-xs">
                <Star className="w-3 h-3 mr-1 text-amber-500" />
                {profile.starterBlobbi.replace('blobbi-', '')}
              </Badge>
            </div>
          )}
        </div>

        {/* Style & Background */}
        {(profile.style || profile.background) && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Customization
            </h4>
            <div className="flex gap-2">
              {profile.style && (
                <Badge variant="outline" className="text-xs">
                  Style: {profile.style}
                </Badge>
              )}
              {profile.background && (
                <Badge variant="outline" className="text-xs">
                  Theme: {profile.background}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Compact version for lists/grids
export function BlobbonautProfileCompact({ profileId }: { profileId: string }) {
  const { data: profile, isLoading } = useBlobbonautProfile(profileId);
  const author = useAuthor(profile?.ownerPubkey);
  
  if (isLoading || !profile) {
    return (
      <div className="flex items-center space-x-3 p-3 rounded-lg border">
        <div className="w-10 h-10 bg-muted rounded-full animate-pulse"></div>
        <div className="space-y-1">
          <div className="h-3 bg-muted rounded w-20 animate-pulse"></div>
          <div className="h-2 bg-muted rounded w-16 animate-pulse"></div>
        </div>
      </div>
    );
  }

  const displayName = profile.name || 
                     author.data?.metadata?.name || 
                     author.data?.metadata?.display_name || 
                     profile.ownerPubkey.slice(0, 8);
  const profileImage = author.data?.metadata?.picture;

  return (
    <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
      <Avatar className="w-10 h-10">
        <AvatarImage src={profileImage} alt={displayName} />
        <AvatarFallback className="text-sm">
          {displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{displayName}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Coins className="w-3 h-3" />
            {profile.coins}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {profile.ownedBlobbis.length}
          </span>
          <span className="flex items-center gap-1">
            <Trophy className="w-3 h-3" />
            {profile.achievements.length}
          </span>
        </div>
      </div>
      {profile.title && (
        <Badge variant="secondary" className="text-xs">
          {profile.title}
        </Badge>
      )}
    </div>
  );
}