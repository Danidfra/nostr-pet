import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Globe2, Sparkles, Home, Users, Hash, Info } from 'lucide-react';
import { useBlobbiCommunityFeed } from '@/hooks/useBlobbiCommunityFeed';
import { CommunityPostCard } from '@/components/blobbi/CommunityPostCard';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function BlobbiCommunity() {
  const location = useLocation();
  const { data: posts, isLoading, error } = useBlobbiCommunityFeed(50);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
      <div className="container mx-auto py-6 px-2 sm:px-4">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] lg:grid-cols-[220px_1fr_280px] gap-4 md:gap-6">

          {/* LEFT: nav / community menu (md+ only) */}
          <aside className="hidden md:block">
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200/60 dark:border-purple-600/60">
              <CardContent className="py-4 space-y-2">
                <Link to="/">
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-3 text-sm",
                      location.pathname === "/" && "bg-purple-50 dark:bg-purple-900/20 text-foreground"
                    )}
                  >
                    <Home className="h-4 w-4" />
                    Home
                  </Button>
                </Link>
                <Link to="/blobbi/community">
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-3 text-sm",
                      location.pathname === "/blobbi/community" && "bg-purple-50 dark:bg-purple-900/20 text-foreground font-semibold"
                    )}
                  >
                    <Users className="h-4 w-4" />
                    Community
                  </Button>
                </Link>

                {/* Placeholder navigation items */}
                <div className="pt-4 mt-4 border-t border-border/50">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-sm text-muted-foreground"
                    disabled
                  >
                    <Hash className="h-4 w-4" />
                    Explore
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-sm text-muted-foreground"
                    disabled
                  >
                    <Info className="h-4 w-4" />
                    Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* CENTER: main feed */}
          <main className="space-y-4 max-w-2xl mx-auto w-full">
            {/* Subtle feed header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-foreground">Community Feed</span>
              <Badge variant="outline" className="text-[10px] font-mono">
                blobbi:ecosystem:v1
              </Badge>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Card key={i} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Error State */}
            {error && (
              <Card className="bg-red-50 dark:bg-red-900/20 backdrop-blur-sm border border-red-200 dark:border-red-600">
                <CardContent className="p-8 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                      <Sparkles className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">
                        Unable to load community posts
                      </h3>
                      <p className="text-sm text-red-600 dark:text-red-300">
                        {error instanceof Error ? error.message : 'An unexpected error occurred'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {!isLoading && !error && (!posts || posts.length === 0) && (
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600/50">
                <CardContent className="p-12 text-center">
                  <div className="flex flex-col items-center gap-6 max-w-sm mx-auto">
                    <div className="p-4 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full">
                      <Globe2 className="h-12 w-12 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-foreground mb-2">
                        No Blobbi ecosystem posts yet
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Be the first to share in the Blobbi community! Any Nostr kind:1 event with ["b", "blobbi:ecosystem:v1"] will appear here.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Feed List */}
            {!isLoading && !error && posts && posts.length > 0 && (
              <div className="space-y-4">
                {posts.map((post) => (
                  <CommunityPostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </main>

          {/* RIGHT: info / suggestions (lg+ only) */}
          <aside className="hidden lg:block space-y-4">
            {/* About Blobbi Ecosystem Card */}
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200/60 dark:border-purple-600/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  About Blobbi Ecosystem
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The Blobbi ecosystem connects virtual pet enthusiasts through Nostr. Posts tagged with
                  <code className="mx-1 px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded text-[10px] font-mono">
                    ["b", "blobbi:ecosystem:v1"]
                  </code>
                  and
                  <code className="mx-1 px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded text-[10px] font-mono">
                    ["t", "blobbi"]
                  </code>
                  appear in this community feed.
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono">
                    ["b", "blobbi:ecosystem:v1"]
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* How to Join Card */}
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200/60 dark:border-purple-600/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  How to appear here
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Any Nostr kind:1 post with both the
                  <code className="mx-1 px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded text-[10px] font-mono">
                    ["b", "blobbi:ecosystem:v1"]
                  </code>
                  and
                  <code className="mx-1 px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded text-[10px] font-mono">
                    ["t", "blobbi"]
                  </code>
                  tags will show up in the Blobbi Community feed.
                  Share your Blobbi experiences, tips, or connect with other owners!
                </p>
              </CardContent>
            </Card>

            {/* Placeholder for trending/featured content */}
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200/60 dark:border-purple-600/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Hash className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  Trending Topics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Trending Blobbi topics will appear here as the community grows.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}