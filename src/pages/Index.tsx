import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Heart, Sparkles, Gamepad2, Users } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useCurrentUser();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
      <div className="container mx-auto px-4 py-8">
        <AppHeader />
        
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Hero Section */}
          <div className="text-center space-y-6">
            <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
              Blobbi
            </h1>
            <p className="text-2xl text-gray-700 dark:text-gray-200">
              Your Virtual Pet on the Nostr Network
            </p>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Adopt and care for your own unique digital companion that lives forever on the decentralized web. 
              Each Nostr account can have one special Blobbi pet!
            </p>
            
            <div className="flex gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => navigate(user ? '/blobbi' : '/blobbi/adopt')}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg"
              >
                {user ? 'Visit Your Blobbi' : 'Adopt a Blobbi'}
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate('/blobbi/community')}
                className="border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                Explore Community
              </Button>
            </div>
          </div>

          {/* Blobbi Preview */}
          <div className="flex justify-center">
            <div className="relative w-64 h-64">
              {/* Fixed shadow that scales */}
              <svg
                viewBox="0 0 100 20"
                className="absolute bottom-0 left-0 w-full animate-blobbi-shadow"
                style={{ transformOrigin: 'center bottom' }}
              >
                <ellipse
                  cx="50"
                  cy="10"
                  rx="25"
                  ry="3"
                  fill="currentColor"
                  className="text-black/25 dark:text-black/35"
                />
              </svg>
              
              {/* Bouncing Blobbi */}
              <svg
                viewBox="0 0 100 100"
                className="absolute inset-0 w-full h-full animate-blobbi-jump"
              >
                {/* Main body - cute water droplet shape */}
                <path
                  d="M 50 15 Q 50 10 50 15 Q 72 25 75 55 Q 75 80 50 88 Q 25 80 25 55 Q 28 25 50 15"
                  fill="hsl(var(--primary))"
                  className="transition-colors duration-300"
                />
                
                {/* Subtle inner glow for softness */}
                <ellipse
                  cx="50"
                  cy="45"
                  rx="15"
                  ry="20"
                  fill="white"
                  opacity="0.15"
                />
                
                {/* Eyes - simple with single highlight */}
                <g id="left-eye">
                  <ellipse cx="38" cy="45" rx="8" ry="10" fill="white" />
                  <circle cx="38" cy="46" r="6" fill="#1e293b" />
                  {/* Single eye shine */}
                  <circle cx="40" cy="44" r="2" fill="white" />
                </g>
                <g id="right-eye">
                  <ellipse cx="62" cy="45" rx="8" ry="10" fill="white" />
                  <circle cx="62" cy="46" r="6" fill="#1e293b" />
                  {/* Single eye shine */}
                  <circle cx="64" cy="44" r="2" fill="white" />
                </g>
                
                {/* Happy mouth */}
                <path 
                  d="M 42 62 Q 50 68 58 62" 
                  stroke="#1e293b" 
                  strokeWidth="2.5" 
                  fill="none" 
                  strokeLinecap="round" 
                />
                
                {/* Blush for cuteness */}
                <ellipse cx="22" cy="55" rx="6" ry="4" fill="rgba(255,182,193,0.4)" />
                <ellipse cx="78" cy="55" rx="6" ry="4" fill="rgba(255,182,193,0.4)" />
              </svg>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
              <CardContent className="p-6 text-center space-y-3">
                <Heart className="w-12 h-12 mx-auto text-red-500" />
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Care & Nurture</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Feed, clean, and play with your Blobbi to keep it happy and healthy
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-pink-200 dark:border-pink-600">
              <CardContent className="p-6 text-center space-y-3">
                <Sparkles className="w-12 h-12 mx-auto text-purple-500" />
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Grow & Evolve</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Watch your pet grow through different life stages from baby to adult
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-yellow-200 dark:border-yellow-600">
              <CardContent className="p-6 text-center space-y-3">
                <Gamepad2 className="w-12 h-12 mx-auto text-yellow-500" />
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Earn Rewards</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Gain experience and coins by taking good care of your pet
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-blue-200 dark:border-blue-600">
              <CardContent className="p-6 text-center space-y-3">
                <Users className="w-12 h-12 mx-auto text-blue-500" />
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Join Community</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Discover other Blobbis and see how well they're being cared for
                </p>
              </CardContent>
            </Card>
          </div>

          {/* How it Works */}
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
            <CardContent className="p-8 space-y-6">
              <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">How It Works</h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Log in with Nostr</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Use your Nostr key (npub) to access your unique pet
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Adopt Your Blobbi</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Name your pet and start your journey together
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Care Daily</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Feed, play, clean, and keep your Blobbi healthy
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full flex items-center justify-center font-bold">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Watch It Grow</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Your pet evolves and gains experience over time
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-sm text-gray-600 dark:text-gray-400 pb-8">
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
