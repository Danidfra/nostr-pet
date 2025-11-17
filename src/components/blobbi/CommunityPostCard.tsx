import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Zap,
  MoreHorizontal
} from 'lucide-react';
import { CommunityPost } from '@/hooks/useBlobbiCommunityFeed';
import { formatPostTime, generateDisplayName, getAvatarUrl, getAvatarColor } from '@/hooks/useBlobbiCommunityFeed';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';

function filterMediaUrlFromContent(content: string, mediaUrl?: string): string {
  if (!mediaUrl) return content;

  // Remove the media URL from the content
  const escapedUrl = mediaUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const urlRegex = new RegExp(`\\b${escapedUrl}\\b`, 'gi');
  return content.replace(urlRegex, '').trim();
}

interface CommunityPostCardProps {
  post: CommunityPost;
  className?: string;
}

export function CommunityPostCard({ post, className }: CommunityPostCardProps) {
  const isMobile = useIsMobile();
  const avatarUrl = getAvatarUrl(post.author);
  const avatarColor = getAvatarColor(post.pubkey);
  const displayName = generateDisplayName(post.pubkey, post.author);
  const timeAgo = formatPostTime(post.createdAt);

  // Set max height based on device
  const maxImageHeight = isMobile ? 200 : 300;

  // Filter media URL from content
  const filteredContent = filterMediaUrlFromContent(post.content, post.mediaUrl);

  return (
    <Card className={cn(
      "bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600/50 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className={cn(avatarColor, "text-white font-medium")}>
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-foreground">
                  {displayName}
                </span>
                <Badge variant="secondary" className="text-xs px-2 py-0.5 h-5">
                  Blobbi
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {timeAgo}
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">More options</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Media Section */}
        {post.mediaUrl && (
          <div className="mb-4 px-3">
            <div className="relative overflow-hidden rounded-lg border border-purple-200 dark:border-purple-600 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
              {/* Blurred background for letterboxing effect */}
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-xl scale-110 opacity-30"
                style={{ backgroundImage: `url(${post.mediaUrl})` }}
              />

              {/* Main image container with constraints */}
              <div className="relative flex items-center justify-center p-3 min-h-[120px]" style={{ maxHeight: `${maxImageHeight}px` }}>
                {/* Inner padding container to prevent image from touching limits */}
                <div className="relative flex items-center justify-center p-4">
                  <img
                    src={post.mediaUrl}
                    alt={post.mediaAlt || "Blobbi community post image"}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                    style={{
                      maxHeight: `${maxImageHeight}px`,
                      maxWidth: '100%'
                    }}
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
            {post.mediaSummary && (
              <p className="text-xs text-muted-foreground mt-2 px-1">
                {post.mediaSummary}
              </p>
            )}
          </div>
        )}

        {/* Content Section */}
        <div className="mb-4">
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
            {filteredContent}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Heart className="h-4 w-4 mr-1" />
            <span className="text-xs">Like</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <MessageCircle className="h-4 w-4 mr-1" />
            <span className="text-xs">Reply</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
          >
            <Repeat2 className="h-4 w-4 mr-1" />
            <span className="text-xs">Repost</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
          >
            <Zap className="h-4 w-4 mr-1" />
            <span className="text-xs">Zap</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}