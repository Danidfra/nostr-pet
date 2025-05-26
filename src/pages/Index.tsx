import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Heart, Sparkles, Gamepad2, Users } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useCurrentUser();

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-end mb-8 gap-2">
          <ThemeToggle />
          <LoginArea />
        </div>
        
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Hero Section */}
          <div className="text-center space-y-6">
            <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Blobbi
            </h1>
            <p className="text-2xl text-gray-700">
              Your Virtual Pet on the Nostr Network
            </p>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Adopt and care for your own unique digital companion that lives forever on the decentralized web. 
              Each Nostr account can have one special Blobbi pet!
            </p>
            
            <div className="flex gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => navigate('/blobbi')}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {user ? 'Visit Your Blobbi' : 'Start Playing'}
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate('/blobbi/community')}
              >
                Explore Community
              </Button>
            </div>
          </div>

          {/* Blobbi Preview */}
          <div className="flex justify-center">
            <div className="relative">
              <svg
                viewBox="0 0 100 100"
                className="w-64 h-64 animate-bounce"
              >
                <ellipse
                  cx="50"
                  cy="95"
                  rx="25"
                  ry="3"
                  fill="rgba(0,0,0,0.2)"
                />
                <path
                  d="M 50 10 Q 75 25 75 50 Q 75 80 50 90 Q 25 80 25 50 Q 25 25 50 10"
                  fill="#7C3AED"
                  stroke="rgba(0,0,0,0.1)"
                  strokeWidth="2"
                />
                <text x="35" y="45" fontSize="12" textAnchor="middle" fill="#000">
                  ◉
                </text>
                <text x="65" y="45" fontSize="12" textAnchor="middle" fill="#000">
                  ◉
                </text>
                <path
                  d="M 35 60 Q 50 70 65 60"
                  fill="none"
                  stroke="#000"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="25" cy="50" r="5" fill="rgba(255,182,193,0.5)" />
                <circle cx="75" cy="50" r="5" fill="rgba(255,182,193,0.5)" />
              </svg>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6 text-center space-y-3">
                <Heart className="w-12 h-12 mx-auto text-red-500" />
                <h3 className="font-semibold text-lg">Care & Nurture</h3>
                <p className="text-sm text-gray-600">
                  Feed, clean, and play with your Blobbi to keep it happy and healthy
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center space-y-3">
                <Sparkles className="w-12 h-12 mx-auto text-purple-500" />
                <h3 className="font-semibold text-lg">Grow & Evolve</h3>
                <p className="text-sm text-gray-600">
                  Watch your pet grow through different life stages from baby to adult
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center space-y-3">
                <Gamepad2 className="w-12 h-12 mx-auto text-yellow-500" />
                <h3 className="font-semibold text-lg">Earn Rewards</h3>
                <p className="text-sm text-gray-600">
                  Gain experience and coins by taking good care of your pet
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center space-y-3">
                <Users className="w-12 h-12 mx-auto text-blue-500" />
                <h3 className="font-semibold text-lg">Join Community</h3>
                <p className="text-sm text-gray-600">
                  Discover other Blobbis and see how well they're being cared for
                </p>
              </CardContent>
            </Card>
          </div>

          {/* How it Works */}
          <Card>
            <CardContent className="p-8 space-y-6">
              <h2 className="text-2xl font-bold text-center">How It Works</h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold">Log in with Nostr</h3>
                    <p className="text-sm text-gray-600">
                      Use your Nostr key (npub) to access your unique pet
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold">Adopt Your Blobbi</h3>
                    <p className="text-sm text-gray-600">
                      Name your pet and start your journey together
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold">Care Daily</h3>
                    <p className="text-sm text-gray-600">
                      Feed, play, clean, and keep your Blobbi healthy
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold">Watch It Grow</h3>
                    <p className="text-sm text-gray-600">
                      Your pet evolves and gains experience over time
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-sm text-gray-600 pb-8">
            <p>
              Blobbi is a decentralized virtual pet game built on the Nostr protocol.
            </p>
            <p>
              Your pet data is stored permanently on the network and belongs to you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
