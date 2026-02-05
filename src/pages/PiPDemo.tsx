import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Eye, EyeOff, MonitorPlay, Smartphone } from 'lucide-react';
import { useCurrentCompanion } from '@/hooks/useCurrentCompanion';

export default function PiPDemo() {
  const navigate = useNavigate();
  const { data: companionData } = useCurrentCompanion();
  const companion = companionData?.blobbi ?? null;
  const isPiPSupported = 'documentPictureInPicture' in window;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
              Picture-in-Picture Demo
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Test Blobbi's companion feature
            </p>
          </div>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MonitorPlay className="w-5 h-5" />
              PiP Status
            </CardTitle>
            <CardDescription>
              Current Picture-in-Picture configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm text-gray-600 dark:text-gray-400">Browser Support</div>
                <Badge variant={isPiPSupported ? "default" : "secondary"}>
                  {isPiPSupported ? "Native PiP Supported" : "Fallback Mode"}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-gray-600 dark:text-gray-400">Companion Status</div>
                <Badge variant={companion ? "default" : "secondary"}>
                  {companion ? `${companion.name} Active` : "No Companion"}
                </Badge>
              </div>
            </div>

            {companion && (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-xl">
                    {companion.name[0]}
                  </div>
                  <div>
                    <div className="font-semibold">{companion.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {companion.lifeStage} • {companion.evolutionForm || 'blobbi'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* How to Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              How to Test PiP
            </CardTitle>
            <CardDescription>
              Follow these steps to see Blobbi in action
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <div className="font-medium">Navigate to a Game Screen</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Go to your Blobbi dashboard or any game page
                  </div>
                  <div className="mt-2 space-x-2">
                    <Button size="sm" onClick={() => navigate('/')}>
                      Go to Dashboard
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => navigate('/games/bubble-pop')}>
                      Play Bubble Pop
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <div className="font-medium">Leave the Game Screen</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Navigate away or switch tabs to trigger PiP
                  </div>
                  <div className="mt-2 space-x-2">
                    <Button size="sm" onClick={() => navigate('/blobbi/community')}>
                      Go to Community
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => navigate('/blobbi/evolution')}>
                      View Evolution
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <div className="font-medium">Interact with Blobbi</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Click on Blobbi in the PiP window to get reactions
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  4
                </div>
                <div>
                  <div className="font-medium">Return to Game</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    PiP will automatically close when you return to game screens
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle>PiP Features</CardTitle>
            <CardDescription>
              What you can expect from the companion experience
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Automatic Activation
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 pl-4">
                  PiP appears when you leave game screens
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Interactive Messages
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 pl-4">
                  Click Blobbi for encouraging reactions
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Time Tracking
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 pl-4">
                  See how long you've been away
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Mood Changes
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 pl-4">
                  Blobbi's behavior adapts over time
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Draggable Window
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 pl-4">
                  Reposition anywhere on screen (fallback)
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Cross-Browser Support
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 pl-4">
                  Works everywhere with fallback mode
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Browser Compatibility */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Browser Compatibility
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant="default">Chrome 111+</Badge>
                  <span className="text-sm">Native PiP Support</span>
                </div>
                <Badge variant="outline">Recommended</Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Firefox</Badge>
                  <span className="text-sm">Fallback Mode</span>
                </div>
                <Badge variant="outline">Supported</Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Safari</Badge>
                  <span className="text-sm">Fallback Mode</span>
                </div>
                <Badge variant="outline">Supported</Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Edge</Badge>
                  <span className="text-sm">Fallback Mode</span>
                </div>
                <Badge variant="outline">Supported</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* No Companion Warning */}
        {!companion && (
          <Card className="border-orange-200 dark:border-orange-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <EyeOff className="w-5 h-5" />
                No Companion Set
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                You need to set a companion Blobbi to use the PiP feature.
              </p>
              <Button onClick={() => navigate('/')}>
                Set Companion
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
