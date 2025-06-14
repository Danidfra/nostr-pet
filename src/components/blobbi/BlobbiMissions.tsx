import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  Trophy, 
  Coins, 
  CheckCircle, 
  Clock, 
  Star,
  Gift,
  Sparkles,
  Egg,
  Baby
} from 'lucide-react';
import { useBlobbonautProfile, useUpdateBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { useUserBlobbis } from '@/hooks/useUserBlobbis';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';

interface Mission {
  id: string;
  title: string;
  description: string;
  reward: number;
  icon: React.ReactNode;
  isCompleted: boolean;
  canComplete: boolean;
  completionText: string;
  tagName: string; // The tag name to add to the profile when completed
}

export function BlobbiMissions() {
  const { user } = useCurrentUser();
  const { data: profile } = useBlobbonautProfile();
  const { data: userBlobbis = [] } = useUserBlobbis();
  const { mutateAsync: updateProfile } = useUpdateBlobbonautProfile();
  const { toast } = useToast();
  
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [completedMission, setCompletedMission] = useState<Mission | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const hasHatchedFirstEgg = userBlobbis.some(blobbi => blobbi.lifeStage !== 'egg');
  const hasClaimedWelcomeMission = profile?.achievements.includes('welcome_mission') ?? false;


  // Define missions
  const missions: Mission[] = [
    {
      id: 'welcome_mission',
      title: 'First Hatch',
      description: 'Hatch your first Blobbi egg to complete this welcome mission and earn a special reward!',
      reward: 900,
      icon: <Baby className="w-6 h-6 text-blue-500" />,
      isCompleted: hasClaimedWelcomeMission,
      canComplete: hasHatchedFirstEgg && !hasClaimedWelcomeMission,
      completionText: 'Congratulations on hatching your first Blobbi!',
      tagName: 'welcome_mission'
    }
  ];

  // Filter missions to only show if they haven't been completed
  const availableMissions = missions.filter(mission => !mission.isCompleted);

  const handleCompleteMission = async (mission: Mission) => {
    if (!user || !profile || !mission.canComplete || isCompleting) {
      return;
    }

    setIsCompleting(true);

    try {
      if (mission.id === 'welcome_mission') {
        const updatedProfile = {
          ...profile,
          coins: profile.coins + mission.reward,
          achievements: [...profile.achievements, 'welcome_mission'],
        };
        await updateProfile(updatedProfile);
      } else {
        // Regular mission handling - add to achievements
        const updatedProfile = {
          ...profile,
          coins: profile.coins + mission.reward,
          achievements: [...profile.achievements, mission.tagName]
        };

        await updateProfile(updatedProfile);
      }

      // Show reward modal
      setCompletedMission(mission);
      setShowRewardModal(true);

      toast({
        title: "Mission Completed! 🎉",
        description: `You've earned ${mission.reward} coins for completing "${mission.title}"!`,
        duration: 5000,
      });

    } catch (error) {
      console.error('Failed to complete mission:', error);
      toast({
        title: "Mission Completion Failed",
        description: "There was an error completing your mission. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
    }
  };

  if (!user || !profile) {
    return (
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
        <CardContent className="p-8 text-center">
          <div className="text-gray-600 dark:text-gray-400">
            Please log in and create a profile to view missions.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Trophy className="w-6 h-6 text-yellow-500" />
              Missions
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300">
              Complete missions to earn coins and unlock special rewards
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Missions List */}
        {availableMissions.length > 0 ? (
          <div className="space-y-4">
            {availableMissions.map((mission) => (
              <Card 
                key={mission.id}
                className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border transition-all duration-300 ${
                  mission.canComplete 
                    ? 'border-green-300 dark:border-green-600 shadow-lg' 
                    : 'border-purple-200 dark:border-purple-600'
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Mission Icon */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                      mission.canComplete 
                        ? 'bg-green-100 dark:bg-green-900/30' 
                        : 'bg-purple-100 dark:bg-purple-900/30'
                    }`}>
                      {mission.icon}
                    </div>

                    {/* Mission Content */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {mission.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={`${
                              mission.canComplete 
                                ? 'border-green-200 dark:border-green-600 text-green-700 dark:text-green-300' 
                                : 'border-yellow-200 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300'
                            }`}
                          >
                            <Coins className="w-3 h-3 mr-1" />
                            {mission.reward} coins
                          </Badge>
                          {mission.canComplete && (
                            <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Ready!
                            </Badge>
                          )}
                          {!mission.canComplete && !mission.isCompleted && (
                            <Badge variant="outline" className="border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400">
                              <Clock className="w-3 h-3 mr-1" />
                              In Progress
                            </Badge>
                          )}
                        </div>
                      </div>

                      <p className="text-gray-600 dark:text-gray-300 mb-4">
                        {mission.description}
                      </p>

                      {/* Mission Progress */}
                      <div className="mb-4">
                        {mission.id === 'welcome_mission' && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Egg className="w-4 h-4" />
                            <span>
                              {hasHatchedFirstEgg
                                ? 'You have a hatched Blobbi! You can claim your reward.'
                                : 'Hatch an egg to claim this reward.'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Complete Mission Button */}
                      {mission.canComplete && (
                        <Button 
                          onClick={() => handleCompleteMission(mission)}
                          disabled={isCompleting}
                          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg"
                        >
                          {isCompleting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Completing...
                            </>
                          ) : (
                            <>
                              <Gift className="w-4 h-4 mr-2" />
                              Claim Reward ({mission.reward} coins)
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
            <CardContent className="p-8 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center mx-auto">
                  <Trophy className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    All Missions Completed!
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    You've completed all available missions. Check back later for new challenges!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Reward Modal */}
      <Dialog open={showRewardModal} onOpenChange={setShowRewardModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-center">
              <Trophy className="w-6 h-6 text-yellow-500" />
              Mission Completed!
            </DialogTitle>
            <DialogDescription className="text-center">
              Congratulations on completing your mission!
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Celebration Animation */}
            <div className="text-center">
              <div className="relative">
                <div className="absolute inset-0 animate-ping">
                  <div className="w-20 h-20 mx-auto bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full opacity-20"></div>
                </div>
                <div className="relative w-20 h-20 mx-auto bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-white animate-pulse" />
                </div>
              </div>
            </div>

            {/* Mission Details */}
            {completedMission && (
              <div className="text-center space-y-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {completedMission.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {completedMission.completionText}
                </p>
                
                {/* Reward Display */}
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 p-6 rounded-xl border border-yellow-200 dark:border-yellow-600">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Coins className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                      +{completedMission.reward} coins
                    </span>
                  </div>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    Reward added to your account
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-center">
              <Button 
                onClick={() => setShowRewardModal(false)}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
              >
                <Star className="w-4 h-4 mr-2" />
                Awesome!
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}