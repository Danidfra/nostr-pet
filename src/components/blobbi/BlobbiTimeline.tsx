import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBlobbiTimeline } from '@/hooks/useBlobbiEvents';
import { BlobbiRecordData, BlobbiInteractionData } from '@/types/blobbi';
import { 
  Calendar, 
  Heart, 
  Sparkles, 
  Trophy, 
  Baby, 
  Egg, 
  Star,
  Gift,
  Gamepad2,
  Utensils,
  Bath,
  Bed,
  Stethoscope,
  Music,
  MessageCircle,
  Thermometer,
  Eye
} from 'lucide-react';

interface BlobbiTimelineProps {
  blobbiId: string;
}

// Icon mapping for different event types
const getRecordIcon = (recordType: string) => {
  switch (recordType) {
    case 'birth': return <Baby className="h-4 w-4" />;
    case 'hatched': return <Egg className="h-4 w-4" />;
    case 'evolution': return <Sparkles className="h-4 w-4" />;
    case 'memory': return <Star className="h-4 w-4" />;
    case 'adoption': return <Gift className="h-4 w-4" />;
    default: return <Calendar className="h-4 w-4" />;
  }
};

const getInteractionIcon = (action: string) => {
  switch (action) {
    case 'feed': return <Utensils className="h-4 w-4" />;
    case 'play': return <Gamepad2 className="h-4 w-4" />;
    case 'clean': return <Bath className="h-4 w-4" />;
    case 'rest': return <Bed className="h-4 w-4" />;
    case 'medicine': return <Stethoscope className="h-4 w-4" />;
    case 'singing': return <Music className="h-4 w-4" />;
    case 'talking': return <MessageCircle className="h-4 w-4" />;
    case 'warming': return <Thermometer className="h-4 w-4" />;
    case 'checking': return <Eye className="h-4 w-4" />;
    default: return <Heart className="h-4 w-4" />;
  }
};

// Format timestamp for display
const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - timestamp;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
};

// Component for rendering record events
const RecordEventItem: React.FC<{ record: BlobbiRecordData; timestamp: number }> = ({ record, timestamp }) => {
  const getRecordTitle = () => {
    switch (record.recordType) {
      case 'birth':
        return 'Born';
      case 'hatched':
        return 'Hatched';
      case 'evolution':
        return `Evolved to ${record.evolutionStage}`;
      case 'memory':
        return record.memoryTitle || 'New Memory';
      case 'adoption':
        return record.title ? `Earned Title: ${record.title}` : 'Adopted';
      default:
        return 'Record';
    }
  };

  const getRecordDescription = () => {
    switch (record.recordType) {
      case 'birth':
        return `Born in ${record.birthLocation || 'unknown location'} during ${record.weatherAtBirth || 'unknown weather'}`;
      case 'hatched':
        return `Hatched after ${record.incubationTime || 'unknown'} of incubation`;
      case 'evolution':
        return record.evolutionReason || 'Evolution milestone reached';
      case 'memory':
        return record.memoryDescription || 'A special moment was created';
      case 'adoption':
        return record.titleReason || 'Welcomed into a new home';
      default:
        return 'A significant event occurred';
    }
  };

  const getBadgeVariant = () => {
    switch (record.recordType) {
      case 'birth':
      case 'hatched':
        return 'default';
      case 'evolution':
        return 'secondary';
      case 'memory':
        return 'outline';
      case 'adoption':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <div className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50">
      <div className="flex-shrink-0 mt-1">
        {getRecordIcon(record.recordType)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">{getRecordTitle()}</h4>
          <Badge variant={getBadgeVariant()} className="text-xs">
            {record.recordType}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {getRecordDescription()}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatTimestamp(timestamp)}
        </p>
        
        {/* Show additional details for specific record types */}
        {record.recordType === 'birth' && record.initialTrait && record.initialTrait.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {record.initialTrait.map((trait, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {trait}
              </Badge>
            ))}
          </div>
        )}
        
        {record.recordType === 'memory' && record.achievement && (
          <div className="mt-2">
            <Badge variant="secondary" className="text-xs">
              <Trophy className="h-3 w-3 mr-1" />
              {record.achievement}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
};

// Component for rendering interaction events
const InteractionEventItem: React.FC<{ interaction: BlobbiInteractionData; timestamp: number }> = ({ interaction, timestamp }) => {
  const getInteractionTitle = () => {
    switch (interaction.action) {
      case 'feed':
        return `Fed ${interaction.itemUsed || 'food'}`;
      case 'play':
        return `Played ${interaction.gameType || 'a game'}`;
      case 'clean':
        return `Cleaned with ${interaction.cleaningType || 'soap'}`;
      case 'rest':
        return `Rested in ${interaction.bedType || 'bed'}`;
      case 'medicine':
        return 'Received medical care';
      case 'singing':
        return 'Enjoyed a lullaby';
      case 'talking':
        return 'Had a conversation';
      case 'warming':
        return 'Warmed up';
      case 'checking':
        return 'Health check';
      default:
        return `${interaction.action} interaction`;
    }
  };

  const getStatChangeText = () => {
    const [stat, change] = interaction.statChange;
    const changeNum = parseInt(change);
    const sign = changeNum > 0 ? '+' : '';
    return `${stat} ${sign}${change}`;
  };

  return (
    <div className="flex items-start space-x-3 p-3 rounded-lg bg-background border">
      <div className="flex-shrink-0 mt-1">
        {getInteractionIcon(interaction.action)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">{getInteractionTitle()}</h4>
          <Badge variant="outline" className="text-xs">
            {getStatChangeText()}
          </Badge>
        </div>
        
        {interaction.blobbiMoodAfter && (
          <p className="text-xs text-muted-foreground mt-1">
            Mood: {interaction.blobbiMoodAfter}
          </p>
        )}
        
        <p className="text-xs text-muted-foreground mt-1">
          {formatTimestamp(timestamp)}
        </p>
        
        {/* Show special events or achievements */}
        {interaction.achievementUnlocked && (
          <div className="mt-2">
            <Badge variant="secondary" className="text-xs">
              <Trophy className="h-3 w-3 mr-1" />
              {interaction.achievementUnlocked}
            </Badge>
          </div>
        )}
        
        {interaction.specialEvent && (
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              {interaction.specialEvent}
            </Badge>
          </div>
        )}
        
        {interaction.memoryCreated && (
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              <Star className="h-3 w-3 mr-1" />
              {interaction.memoryCreated}
            </Badge>
          </div>
        )}
        
        {interaction.carePoints && interaction.carePoints > 0 && (
          <div className="mt-2">
            <Badge variant="default" className="text-xs">
              +{interaction.carePoints} care points
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
};

export const BlobbiTimeline: React.FC<BlobbiTimelineProps> = ({ blobbiId }) => {
  const { timeline, isLoading } = useBlobbiTimeline(blobbiId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (timeline.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No events yet. Start interacting with your Blobbi!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Timeline
          <Badge variant="secondary" className="ml-auto">
            {timeline.length} events
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-96">
          <div className="p-4 space-y-4">
            {timeline.map((item, index) => (
              <div key={`${item.type}-${item.timestamp}-${index}`}>
                {item.type === 'record' ? (
                  <RecordEventItem 
                    record={item.data as BlobbiRecordData} 
                    timestamp={item.timestamp} 
                  />
                ) : (
                  <InteractionEventItem 
                    interaction={item.data as BlobbiInteractionData} 
                    timestamp={item.timestamp} 
                  />
                )}
                
                {index < timeline.length - 1 && (
                  <Separator className="my-4" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};