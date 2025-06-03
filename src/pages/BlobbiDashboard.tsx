import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  Coins, 
  Trophy, 
  Calendar, 
  Heart, 
  Sparkles, 
  Filter,
  Search,
  TrendingUp,
  Clock,
  Star,
  Archive,
  Egg,
  Baby,
  Crown,
  Activity,
  BarChart3,
  Settings
} from 'lucide-react';
import { useBlobbis } from '@/hooks/useBlobbi';
import { useUserBlobbis } from '@/hooks/useUserBlobbis';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { useBlobbiIncubationSystem } from '@/hooks/useBlobbiIncubationSystem';
import { BlobbiVisual } from '@/components/blobbi/BlobbiVisual';
import { BlobbiEvolvedVisual } from '@/components/blobbi/BlobbiEvolvedVisual';
import { BlobbonautProfileCard } from '@/components/blobbi/BlobbonautProfileCard';
import { EditBlobbonautProfile } from '@/components/blobbi/EditBlobbonautProfile';
import { BlobbiIncubationDashboard } from '@/components/blobbi/BlobbiIncubationDashboard';
import { BlobbiLayout } from '@/components/BlobbiLayout';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { ThemeToggle } from '@/components/theme-toggle';
import { SettingsButton } from '@/components/SettingsButton';
import { formatDistanceToNow } from 'date-fns';
import { Blobbi, BlobbiLifeStage } from '@/types/blobbi';

type BlobbiFilter = 'all' | 'active' | 'incubating' | 'evolved' | 'archived';

export default function BlobbiDashboard() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { data: profile } = useBlobbonautProfile();
  const { data: communityBlobbis } = useBlobbis(10);
  const { data: userBlobbis = [] } = useUserBlobbis();
  const { 
    eggTasks, 
    evolutionTasks, 
    progress,
    isReadyToHatch,
    isReadyToEvolve 
  } = useBlobbiIncubationSystem();
  
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [filter, setFilter] = useState<BlobbiFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  
  if (!user) {
    return (
      <BlobbiLayout>
        <div className="container mx-auto py-8 px-4">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold">Blobbi Dashboard</h1>
            <div className="flex items-center gap-2">
              <SettingsButton />
              <ThemeToggle />
            </div>
          </div>
          
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Welcome to Blobbi!</CardTitle>
              <CardDescription>
                Log in with your Nostr account to access your Blobbi dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="text-center space-y-2">
                <p className="text-muted-foreground">
                  Manage your virtual pets, track their evolution, and explore the Blobbi community.
                </p>
              </div>
              <LoginArea />
            </CardContent>
          </Card>
        </div>
      </BlobbiLayout>
    );
  }

  // Filter user's blobbis based on current filter
  const filteredBlobbis = userBlobbis.filter(blobbi => {
    if (filter === 'all') return true;
    if (filter === 'active') return blobbi.state === 'active' && blobbi.lifeStage !== 'egg';
    if (filter === 'incubating') return blobbi.lifeStage === 'egg';
    if (filter === 'evolved') return blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi';
    if (filter === 'archived') return blobbi.state === 'hibernating';
    return true;
  }).filter(blobbi => 
    searchQuery === '' || 
    blobbi.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate statistics
  const stats = {
    totalBlobbis: userBlobbis.length,
    activeBlobbis: userBlobbis.filter(b => b.state === 'active').length,
    incubatingBlobbis: userBlobbis.filter(b => b.lifeStage === 'egg').length,
    evolvedBlobbis: userBlobbis.filter(b => b.evolutionForm && b.evolutionForm !== 'blobbi').length,
    totalCoins: profile?.coins || 0,
    totalExperience: userBlobbis.reduce((sum, b) => sum + b.experience, 0),
    achievements: profile?.achievements.length || 0,
    careStreak: Math.max(...userBlobbis.map(b => b.careStreak || 0), 0),
  };

  // Get most liked/active blobbis (mock data for now)
  const mostLikedBlobbis = [...userBlobbis]
    .sort((a, b) => (b.experience || 0) - (a.experience || 0))
    .slice(0, 3);

  const recentActivity = userBlobbis
    .map(blobbi => ({
      blobbi,
      lastActivity: blobbi.lastInteraction * 1000,
      type: blobbi.lifeStage === 'egg' ? 'incubating' : 'interaction'
    }))
    .sort((a, b) => b.lastActivity - a.lastActivity)
    .slice(0, 5);

  return (
    <BlobbiLayout>
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold">Blobbi Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Manage your virtual pets and track their evolution
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SettingsButton />
            <ThemeToggle />
          </div>
        </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar - Profile & Quick Stats */}
        <div className="lg:col-span-1 space-y-4">
          <BlobbonautProfileCard 
            showEditButton={true}
            onEdit={() => setShowEditProfile(true)}
          />
          
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-pink-500" />
                  <span className="text-sm">Total Blobbis</span>
                </div>
                <Badge variant="outline">{stats.totalBlobbis}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Active</span>
                </div>
                <Badge variant="outline">{stats.activeBlobbis}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Egg className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm">Incubating</span>
                </div>
                <Badge variant="outline">{stats.incubatingBlobbis}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span className="text-sm">Evolved</span>
                </div>
                <Badge variant="outline">{stats.evolvedBlobbis}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm">Coins</span>
                </div>
                <Badge variant="outline">{stats.totalCoins.toLocaleString()}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="text-sm">Achievements</span>
                </div>
                <Badge variant="outline">{stats.achievements}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Navigation Links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/blobbi/adopt">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Heart className="w-4 h-4" />
                  Adopt New Blobbi
                </Button>
              </Link>
              <Link to="/blobbi/evolution">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Sparkles className="w-4 h-4" />
                  Evolution Guide
                </Button>
              </Link>
              <Link to="/blobbi/community">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Activity className="w-4 h-4" />
                  Community
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="blobbis">My Blobbis</TabsTrigger>
              <TabsTrigger value="incubation">Incubation</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="stats">Statistics</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Welcome Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-yellow-500" />
                    Welcome back, {profile?.ownerPubkey.slice(0, 8)}!
                  </CardTitle>
                  <CardDescription>
                    Here's what's happening with your Blobbis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{stats.activeBlobbis}</div>
                      <div className="text-sm text-muted-foreground">Active Blobbis</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">{stats.incubatingBlobbis}</div>
                      <div className="text-sm text-muted-foreground">Incubating</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{stats.evolvedBlobbis}</div>
                      <div className="text-sm text-muted-foreground">Evolved</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Most Liked Blobbis */}
              {mostLikedBlobbis.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Top Performing Blobbis
                    </CardTitle>
                    <CardDescription>
                      Your most experienced Blobbis
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-3 gap-4">
                      {mostLikedBlobbis.map((blobbi, index) => (
                        <div 
                          key={blobbi.id}
                          className="p-4 border rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => navigate(`/blobbi/${blobbi.id}`)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{blobbi.name}</h4>
                            {index === 0 && <Crown className="w-4 h-4 text-yellow-500" />}
                          </div>
                          <div className="flex justify-center mb-2">
                            {blobbi.evolutionForm ? (
                              <BlobbiEvolvedVisual blobbi={blobbi} size="small" />
                            ) : (
                              <BlobbiVisual blobbi={blobbi} size="small" />
                            )}
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-medium">{blobbi.experience} XP</div>
                            <div className="text-xs text-muted-foreground">
                              {blobbi.lifeStage} • {formatDistanceToNow(blobbi.lastInteraction * 1000, { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentActivity.map(({ blobbi, lastActivity, type }) => (
                      <div 
                        key={blobbi.id}
                        className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/blobbi/${blobbi.id}`)}
                      >
                        <div className="flex-shrink-0">
                          {blobbi.evolutionForm ? (
                            <BlobbiEvolvedVisual blobbi={blobbi} size="small" />
                          ) : (
                            <BlobbiVisual blobbi={blobbi} size="small" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{blobbi.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {type === 'incubating' ? 'Incubating' : 'Last interaction'} • {formatDistanceToNow(lastActivity, { addSuffix: true })}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {blobbi.lifeStage}
                        </Badge>
                      </div>
                    ))}
                    {recentActivity.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No recent activity. Adopt a Blobbi to get started!
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* My Blobbis Tab */}
            <TabsContent value="blobbis" className="space-y-6">
              {/* Filters and Search */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search your Blobbis..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 bg-white/80 border-purple-200 focus:border-purple-400 focus:ring-purple-400/50 focus:bg-white placeholder:text-purple-400/60"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={filter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('all')}
                      >
                        All
                      </Button>
                      <Button
                        variant={filter === 'active' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('active')}
                      >
                        <Activity className="w-4 h-4 mr-1" />
                        Active
                      </Button>
                      <Button
                        variant={filter === 'incubating' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('incubating')}
                      >
                        <Egg className="w-4 h-4 mr-1" />
                        Incubating
                      </Button>
                      <Button
                        variant={filter === 'evolved' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('evolved')}
                      >
                        <Sparkles className="w-4 h-4 mr-1" />
                        Evolved
                      </Button>
                      <Button
                        variant={filter === 'archived' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('archived')}
                      >
                        <Archive className="w-4 h-4 mr-1" />
                        Archived
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Blobbis Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBlobbis.map((blobbi) => (
                  <Card 
                    key={blobbi.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate(`/blobbi/${blobbi.id}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{blobbi.name}</CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {blobbi.lifeStage}
                        </Badge>
                      </div>
                      <CardDescription>
                        Born {formatDistanceToNow(blobbi.birthTime, { addSuffix: true })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-center mb-4">
                        {blobbi.evolutionForm ? (
                          <BlobbiEvolvedVisual blobbi={blobbi} size="medium" />
                        ) : (
                          <BlobbiVisual blobbi={blobbi} size="medium" />
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Experience</span>
                          <span className="font-medium">{blobbi.experience} XP</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">State</span>
                          <Badge variant={blobbi.state === 'active' ? 'default' : 'secondary'}>
                            {blobbi.state}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Last Care</span>
                          <span className="text-xs">
                            {formatDistanceToNow(blobbi.lastInteraction * 1000, { addSuffix: true })}
                          </span>
                        </div>
                        {blobbi.evolutionForm && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Evolution</span>
                            <Badge variant="default" className="gap-1">
                              <Sparkles className="w-3 h-3" />
                              {blobbi.evolutionForm}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredBlobbis.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <div className="text-muted-foreground mb-4">
                      {userBlobbis.length === 0 
                        ? "You don't have any Blobbis yet."
                        : "No Blobbis match your current filter."
                      }
                    </div>
                    {userBlobbis.length === 0 && (
                      <Link to="/blobbi/adopt">
                        <Button>
                          <Heart className="w-4 h-4 mr-2" />
                          Adopt Your First Blobbi
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Incubation Tab */}
            <TabsContent value="incubation">
              <BlobbiIncubationDashboard />
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Activity Feed</CardTitle>
                  <CardDescription>
                    Recent interactions and events with your Blobbis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivity.map(({ blobbi, lastActivity, type }) => (
                      <div key={blobbi.id} className="flex items-start gap-4 p-4 border rounded-lg">
                        <div className="flex-shrink-0">
                          {blobbi.evolutionForm ? (
                            <BlobbiEvolvedVisual blobbi={blobbi} size="small" />
                          ) : (
                            <BlobbiVisual blobbi={blobbi} size="small" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{blobbi.name}</div>
                          <div className="text-sm text-muted-foreground mb-2">
                            {type === 'incubating' ? 'Incubating in egg form' : 'Had an interaction'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(lastActivity, { addSuffix: true })}
                          </div>
                        </div>
                        <Badge variant="outline">
                          {blobbi.lifeStage}
                        </Badge>
                      </div>
                    ))}
                    {recentActivity.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No recent activity to show.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Statistics Tab */}
            <TabsContent value="stats" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Blobbi Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Total Blobbis</span>
                      <span className="font-bold">{stats.totalBlobbis}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Active Blobbis</span>
                      <span className="font-bold text-green-600">{stats.activeBlobbis}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Incubating</span>
                      <span className="font-bold text-yellow-600">{stats.incubatingBlobbis}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Evolved</span>
                      <span className="font-bold text-purple-600">{stats.evolvedBlobbis}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Total Experience</span>
                      <span className="font-bold">{stats.totalExperience.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Care Streak</span>
                      <span className="font-bold text-blue-600">{stats.careStreak} days</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="w-5 h-5" />
                      Achievements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span>Total Achievements</span>
                        <span className="font-bold">{stats.achievements}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Coins Earned</span>
                        <span className="font-bold text-yellow-600">{stats.totalCoins.toLocaleString()}</span>
                      </div>
                      {profile?.achievements && profile.achievements.length > 0 && (
                        <div className="pt-2">
                          <div className="text-sm font-medium mb-2">Recent Achievements:</div>
                          <div className="flex flex-wrap gap-1">
                            {profile.achievements.slice(0, 6).map((achievement, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {achievement.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Evolution Progress Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Evolution Progress Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-2">Egg Hatching Progress</h4>
                      <div className="text-2xl font-bold text-green-600 mb-1">
                        {progress.egg.completed}/{progress.egg.total}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {progress.egg.percentage.toFixed(1)}% complete
                      </div>
                      {isReadyToHatch && (
                        <Badge className="mt-2 bg-green-600">Ready to Hatch!</Badge>
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Evolution Progress</h4>
                      <div className="text-2xl font-bold text-purple-600 mb-1">
                        {progress.evolution.completed}/{progress.evolution.total}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {progress.evolution.percentage.toFixed(1)}% complete
                      </div>
                      {isReadyToEvolve && (
                        <Badge className="mt-2 bg-purple-600">Ready to Evolve!</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

        {/* Edit Profile Dialog */}
        <EditBlobbonautProfile 
          isOpen={showEditProfile}
          onClose={() => setShowEditProfile(false)}
        />
      </div>
    </BlobbiLayout>
  );
}