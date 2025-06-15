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
  Crown
} from 'lucide-react';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';

interface BlobbonautProfileCardProps {
  profileId?: string;
}

export function BlobbonautProfileCard({ 
  profileId
}: BlobbonautProfileCardProps) {
  const { user } = useCurrentUser();
  const { data: profile, isLoading } = useBlobbonautProfile(profileId);
  const author = useAuthor(profile?.ownerPubkey);
  
  if (isLoading) {
    return (
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-purple-200 dark:bg-purple-700 rounded-full"></div>
              <div className="space-y-2">
                <div className="h-4 bg-purple-200 dark:bg-purple-700 rounded w-32"></div>
                <div className="h-3 bg-purple-200 dark:bg-purple-700 rounded w-24"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-purple-200 dark:bg-purple-700 rounded w-full"></div>
              <div className="h-3 bg-purple-200 dark:bg-purple-700 rounded w-3/4"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
        <CardContent className="p-4">
          <p className="text-gray-600 dark:text-gray-400">No Blobbanaut Profile found</p>
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
    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Avatar className="w-12 h-12 border-2 border-purple-200 dark:border-purple-600">
              <AvatarImage src={profileImage} alt={displayName} />
              <AvatarFallback className="text-lg bg-gradient-to-r from-purple-400 to-pink-400 text-white">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="flex items-center gap-2 text-base text-gray-900 dark:text-gray-100">
                {displayName}
                {profile.title && (
                  <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                    <Crown className="w-3 h-3 mr-1" />
                    {profile.title}
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Blobbanaut Level {Math.floor(profile.pettingLevel / 10) + 1}
              </p>
            </div>
          </div>

        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Coins className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{profile.coins.toLocaleString()}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Coins</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Heart className="w-5 h-5 text-pink-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{profile.pettingLevel}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Petting Level</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{profile.ownedBlobbis.length}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Current Blobbis</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{profile.lifetimeBlobbis}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Lifetime Blobbis</p>
            </div>
          </div>
        </div>

        {/* Achievements */}
        {profile.achievements.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Star className="w-4 h-4 text-amber-500" />
              Achievements
            </h4>
            <div className="flex flex-wrap gap-1">
              {profile.achievements.slice(0, 6).map((achievement, index) => (
                <Badge key={index} variant="outline" className="text-xs border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300">
                  {achievement.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
              ))}
              {profile.achievements.length > 6 && (
                <Badge variant="outline" className="text-xs border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300">
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
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Favorite Blobbi</p>
              <Badge variant="secondary" className="text-xs bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300">
                <Heart className="w-3 h-3 mr-1 text-pink-500" />
                {profile.favoriteBlobbi.replace('blobbi-', '')}
              </Badge>
            </div>
          )}
          
          {profile.starterBlobbi && (
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Starter Blobbi</p>
              <Badge variant="secondary" className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                <Star className="w-3 h-3 mr-1 text-amber-500" />
                {profile.starterBlobbi.replace('blobbi-', '')}
              </Badge>
            </div>
          )}
        </div>

        {/* Style & Background */}
        {(profile.style || profile.background) && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Palette className="w-4 h-4 text-purple-500" />
              Customization
            </h4>
            <div className="flex gap-2">
              {profile.style && (
                <Badge variant="outline" className="text-xs border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300">
                  Style: {profile.style}
                </Badge>
              )}
              {profile.background && (
                <Badge variant="outline" className="text-xs border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300">
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
      <div className="flex items-center space-x-3 p-3 rounded-lg border border-purple-200 dark:border-purple-600 bg-white/60 dark:bg-gray-700/60">
        <div className="w-10 h-10 bg-purple-200 dark:bg-purple-700 rounded-full animate-pulse"></div>
        <div className="space-y-1">
          <div className="h-3 bg-purple-200 dark:bg-purple-700 rounded w-20 animate-pulse"></div>
          <div className="h-2 bg-purple-200 dark:bg-purple-700 rounded w-16 animate-pulse"></div>
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
    <div className="flex items-center space-x-3 p-3 rounded-lg border border-purple-200 dark:border-purple-600 bg-white/60 dark:bg-gray-700/60 hover:bg-purple-50/80 dark:hover:bg-purple-900/20 transition-colors">
      <Avatar className="w-10 h-10 border-2 border-purple-200 dark:border-purple-600">
        <AvatarImage src={profileImage} alt={displayName} />
        <AvatarFallback className="text-sm bg-gradient-to-r from-purple-400 to-pink-400 text-white">
          {displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">{displayName}</p>
        <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Coins className="w-3 h-3 text-yellow-600" />
            {profile.coins}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3 text-blue-500" />
            {profile.ownedBlobbis.length}
          </span>
          <span className="flex items-center gap-1">
            <Trophy className="w-3 h-3 text-amber-500" />
            {profile.achievements.length}
          </span>
        </div>
      </div>
      {profile.title && (
        <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
          {profile.title}
        </Badge>
      )}
    </div>
  );
}