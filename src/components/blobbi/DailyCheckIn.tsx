import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Flame, Gift, TrendingUp } from 'lucide-react';
import { useDailyCheckIn } from '@/hooks/useDailyCheckIn';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

export function DailyCheckIn() {
  const { 
    checkInData, 
    isLoading, 
    canCheckIn, 
    isStreakActive, 
    checkIn, 
    isCheckingIn 
  } = useDailyCheckIn();
  const { toast } = useToast();
  
  const handleCheckIn = () => {
    checkIn(undefined, {
      onSuccess: (data) => {
        toast({
          title: "Daily Check-in Complete!",
          description: `You earned ${data.coinReward} coins! ${data.checkInData.streak > 1 ? `${data.checkInData.streak} day streak!` : ''}`,
        });
      },
      onError: () => {
        toast({
          title: "Check-in Failed",
          description: "Please try again later.",
          variant: "destructive",
        });
      },
    });
  };
  
  if (isLoading || !checkInData) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-8 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Daily Check-in
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Streak Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className={cn(
              "w-5 h-5",
              isStreakActive && checkInData.streak > 0 ? "text-orange-500" : "text-muted-foreground"
            )} />
            <span className="text-sm font-medium">Current Streak</span>
          </div>
          <Badge variant={isStreakActive && checkInData.streak > 0 ? "default" : "secondary"}>
            {checkInData.streak} {checkInData.streak === 1 ? 'day' : 'days'}
          </Badge>
        </div>
        
        {/* Total Check-ins */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium">Total Check-ins</span>
          </div>
          <span className="text-sm font-semibold">{checkInData.totalCheckIns}</span>
        </div>
        
        {/* Check-in Button */}
        <Button 
          className="w-full" 
          onClick={handleCheckIn}
          disabled={!canCheckIn || isCheckingIn}
          variant={canCheckIn ? "default" : "secondary"}
        >
          {isCheckingIn ? (
            "Checking in..."
          ) : canCheckIn ? (
            <>
              <Gift className="w-4 h-4 mr-2" />
              Check In Today
            </>
          ) : (
            "Already Checked In Today"
          )}
        </Button>
        
        {/* Streak Bonuses Info */}
        {canCheckIn && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Daily check-in: 10 coins</p>
            {checkInData.streak >= 6 && (
              <p>• 7-day streak bonus: +20 coins</p>
            )}
            {checkInData.streak >= 29 && (
              <p>• 30-day streak bonus: +50 coins</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}