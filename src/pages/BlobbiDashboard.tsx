import { useState, useEffect } from 'react';
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
  Settings,
  Target
} from 'lucide-react';
import { useUserBlobbis } from '@/hooks/useUserBlobbis';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { useBlobbiIncubationSystem } from '@/hooks/useBlobbiIncubationSystem';
import { BlobbiCard } from '@/components/blobbi/BlobbiCard';
import { BlobbonautProfileCard } from '@/components/blobbi/BlobbonautProfileCard';

import { BlobbiIncubationDashboard } from '@/components/blobbi/BlobbiIncubationDashboard';
import { BlobbiMissions } from '@/components/blobbi/BlobbiMissions';
import { BlobbiLayout } from '@/components/BlobbiLayout';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { AppHeader } from '@/components/AppHeader';
import { formatDistanceToNow } from 'date-fns';
import { Blobbi, BlobbiLifeStage } from '@/types/blobbi';
import { CompanionSelector } from '@/components/CompanionSelector';
import { SetCompanionButton } from '@/components/SetCompanionButton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

type BlobbiFilter = 'all' | 'active' | 'incubating' | 'evolved' | 'archived';

export default function BlobbiDashboard() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { data: profile, isLoading: isProfileLoading } = useBlobbonautProfile();
  const { data: userBlobbis = [] } = useUserBlobbis();
  const { 
    eggTasks, 
    evolutionTasks, 
    progress,
    isReadyToHatch,
    isReadyToEvolve 
  } = useBlobbiIncubationSystem();
  

  const [filter, setFilter] = useState<BlobbiFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('blobbis');


  // Redirect to adoption page if user doesn't have a profile (kind 31125)
  useEffect(() => {
    if (user && !isProfileLoading && !profile) {
      navigate('/blobbi/adopt');
    }
  }, [user, profile, isProfileLoading, navigate]);
  
  if (!user) {
    return (
      <BlobbiLayout>
        <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
          <div className="container mx-auto py-8 px-4">
            <AppHeader 
              title="Blobbi Dashboard"
              subtitle="Log in with your Nostr account to access your Blobbi dashboard"
            />
            
            <Card className="max-w-2xl mx-auto bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-gray-100">Welcome to Blobbi!</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Log in with your Nostr account to access your Blobbi dashboard
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <div className="text-center space-y-2">
                  <p className="text-gray-600 dark:text-gray-300">
                    Manage your virtual pets, track their evolution, and explore the Blobbi community.
                  </p>
                </div>
                <LoginArea />
              </CardContent>
            </Card>
          </div>
        </div>
      </BlobbiLayout>
    );
  }

  // Show loading state while checking for profile
  if (user && isProfileLoading) {
    return (
      <BlobbiLayout>
        <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
          <div className="container mx-auto py-8 px-4">
            <AppHeader 
              title="Blobbi Dashboard"
              subtitle="Loading your profile..."
            />
            
            <Card className="max-w-2xl mx-auto bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
              <CardContent className="p-8">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </BlobbiLayout>
    );
  }

  // If user is logged in but has no profile, they will be redirected by useEffect
  // This prevents the dashboard from showing briefly before redirect
  if (user && !profile) {
    return (
      <BlobbiLayout>
        <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
          <div className="container mx-auto py-8 px-4">
            <Card className="max-w-2xl mx-auto bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
              <CardContent className="p-8">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                </div>
              </CardContent>
            </Card>
          </div>
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
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
        <div className="container mx-auto py-8 px-4">
          {/* Header */}
          <AppHeader 
            title="Blobbi Dashboard"
            subtitle="Manage your virtual pets and track their evolution"
            showLeftControls={true}
          />

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar - Profile & Quick Stats */}
        <div className="lg:col-span-1 space-y-4">
          <BlobbonautProfileCard />
          
          {/* Quick Stats */}
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
            <CardHeader>
              <CardTitle className="text-lg text-gray-900 dark:text-gray-100">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-pink-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Blobbis</span>
                </div>
                <Badge variant="outline" className="border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300">{stats.totalBlobbis}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Active</span>
                </div>
                <Badge variant="outline" className="border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300">{stats.activeBlobbis}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Egg className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Growing</span>
                </div>
                <Badge variant="outline" className="border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300">{stats.incubatingBlobbis}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Evolved</span>
                </div>
                <Badge variant="outline" className="border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300">{stats.evolvedBlobbis}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Coins</span>
                </div>
                <Badge variant="outline" className="border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300">{stats.totalCoins.toLocaleString()}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Achievements</span>
                </div>
                <Badge variant="outline" className="border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300">{stats.achievements}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Navigation Links */}
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
            <CardHeader>
              <CardTitle className="text-lg text-gray-900 dark:text-gray-100">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <CompanionSelector />
              <Link to="/blobbi/adopt">
                <Button variant="outline" className="w-full justify-start gap-2 border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20">
                  <Heart className="w-4 h-4" />
                  Adopt New Blobbi
                </Button>
              </Link>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 border-yellow-200 dark:border-yellow-600 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                onClick={() => setActiveTab('missions')}
              >
                <Target className="w-4 h-4" />
                View Missions
              </Button>
              {stats.incubatingBlobbis > 0 && (
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2 border-yellow-200 dark:border-yellow-600 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                  onClick={() => setActiveTab('incubation')}
                >
                  <Egg className="w-4 h-4" />
                  View Growth Hub ({stats.incubatingBlobbis})
                </Button>
              )}
              <Link to="/blobbi/evolution">
                <Button variant="outline" className="w-full justify-start gap-2 border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20">
                  <Sparkles className="w-4 h-4" />
                  Evolution Guide
                </Button>
              </Link>
              <Link to="/blobbi/community">
                <Button variant="outline" className="w-full justify-start gap-2 border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20">
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
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
              <CardContent className="p-2">
                <ScrollArea>
                  <TabsList className="grid w-full grid-cols-5 bg-purple-50/50 dark:bg-purple-900/20 ">
                    <TabsTrigger 
                      value="blobbis"
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                    >
                      My Blobbies
                    </TabsTrigger>
                    <TabsTrigger 
                      value="missions"
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                    >
                      Missions
                    </TabsTrigger>
                    <TabsTrigger 
                      value="incubation"
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                    >
                      Growth Hub
                    </TabsTrigger>
                    <TabsTrigger 
                      value="activity"
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                    >
                      Activity
                    </TabsTrigger>
                    <TabsTrigger 
                      value="stats"
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                    >
                      Statistics
                    </TabsTrigger>
                  </TabsList>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>

            {/* My Blobbies Tab */}
            <TabsContent value="blobbis" className="space-y-6">
              {/* Filters and Search */}
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search your Blobbis..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 bg-white/80 dark:bg-gray-700/80 border-purple-200 dark:border-purple-600 focus:border-purple-400 dark:focus:border-purple-500 focus:ring-purple-400/50 dark:focus:ring-purple-500/50 focus:bg-white dark:focus:bg-gray-700 placeholder:text-purple-400/60 dark:placeholder:text-purple-400/70 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={filter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('all')}
                        className={filter === 'all' ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white' : 'border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'}
                      >
                        All
                      </Button>
                      <Button
                        variant={filter === 'active' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('active')}
                        className={filter === 'active' ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white' : 'border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'}
                      >
                        <Activity className="w-4 h-4 mr-1" />
                        Active
                      </Button>
                      <Button
                        variant={filter === 'incubating' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('incubating')}
                        className={filter === 'incubating' ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white' : 'border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'}
                      >
                        <Egg className="w-4 h-4 mr-1" />
                        Incubating
                      </Button>
                      <Button
                        variant={filter === 'evolved' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('evolved')}
                        className={filter === 'evolved' ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white' : 'border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'}
                      >
                        <Sparkles className="w-4 h-4 mr-1" />
                        Evolved
                      </Button>
                      <Button
                        variant={filter === 'archived' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter('archived')}
                        className={filter === 'archived' ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white' : 'border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'}
                      >
                        <Archive className="w-4 h-4 mr-1" />
                        Archived
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Blobbis Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBlobbis.map((blobbi) => (
                  <BlobbiCard
                    key={blobbi.id}
                    blobbi={blobbi}
                    size="md"
                    onClick={() => navigate(`/blobbi/${blobbi.id}`)}
                    showStats={true}
                    showStatus={true}
                    showActions={true}
                    onViewDetails={() => navigate(`/blobbi/${blobbi.id}`)}
                    className="h-full"
                  />
                ))}
              </div>

              {filteredBlobbis.length === 0 && (
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                  <CardContent className="py-12 text-center">
                    <div className="text-gray-600 dark:text-gray-400 mb-4">
                      {userBlobbis.length === 0 
                        ? "You don't have any Blobbis yet."
                        : "No Blobbis match your current filter."
                      }
                    </div>
                    {userBlobbis.length === 0 && (
                      <Link to="/blobbi/adopt">
                        <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
                          <Heart className="w-4 h-4 mr-2" />
                          Adopt Your First Blobbi
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Missions Tab */}
            <TabsContent value="missions">
              <BlobbiMissions />
            </TabsContent>

            {/* Growth Hub Tab */}
            <TabsContent value="incubation">
              <BlobbiIncubationDashboard />
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="space-y-6">
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-gray-100">Activity Feed</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    Recent interactions and events with your Blobbis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentActivity.map(({ blobbi, lastActivity, type }) => (
                      <div key={blobbi.id} className="relative">
                        <BlobbiCard
                          blobbi={blobbi}
                          size="md"
                          onClick={() => navigate(`/blobbi/${blobbi.id}`)}
                          showStats={true}
                          showStatus={true}
                          showActions={true}
                          onViewDetails={() => navigate(`/blobbi/${blobbi.id}`)}
                          className="h-full"
                          footerContent={
                            <div className="text-xs text-gray-600 dark:text-gray-400 text-center bg-purple-50/50 dark:bg-purple-900/20 rounded-lg p-2">
                              Last activity: {formatDistanceToNow(lastActivity, { addSuffix: true })}
                            </div>
                          }
                        />
                        {/* Activity Overlay */}
                        <div className="absolute top-2 right-2 z-10">
                          <Badge 
                            variant="secondary" 
                            className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300 text-xs"
                          >
                            {type === 'incubating' ? 'Incubating' : 'Active'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  {recentActivity.length === 0 && (
                    <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                      No recent activity to show.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Statistics Tab */}
            <TabsContent value="stats" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                      <BarChart3 className="w-5 h-5" />
                      Blobbi Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total Blobbis</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{stats.totalBlobbis}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Active Blobbis</span>
                      <span className="font-bold text-green-600 dark:text-green-400">{stats.activeBlobbis}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Incubating</span>
                      <span className="font-bold text-yellow-600 dark:text-yellow-400">{stats.incubatingBlobbis}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Evolved</span>
                      <span className="font-bold text-purple-600 dark:text-purple-400">{stats.evolvedBlobbis}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total Experience</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{stats.totalExperience.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Care Streak</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">{stats.careStreak} days</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                      <Trophy className="w-5 h-5" />
                      Achievements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Total Achievements</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{stats.achievements}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Coins Earned</span>
                        <span className="font-bold text-yellow-600 dark:text-yellow-400">{stats.totalCoins.toLocaleString()}</span>
                      </div>
                      {profile?.achievements && profile.achievements.length > 0 && (
                        <div className="pt-2">
                          <div className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Recent Achievements:</div>
                          <div className="flex flex-wrap gap-1">
                            {profile.achievements.slice(0, 6).map((achievement, index) => (
                              <Badge key={index} variant="outline" className="text-xs border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300">
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
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-gray-100">Evolution Progress Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Egg Hatching Progress</h4>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                        {progress.egg.completed}/{progress.egg.total}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {progress.egg.percentage.toFixed(1)}% complete
                      </div>
                      {isReadyToHatch && (
                        <Badge className="mt-2 bg-green-600">Ready to Hatch!</Badge>
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Evolution Progress</h4>
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                        {progress.evolution.completed}/{progress.evolution.total}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
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


        </div>
      </div>
    </BlobbiLayout>
  );
}
