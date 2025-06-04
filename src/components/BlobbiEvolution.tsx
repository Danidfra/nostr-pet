import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreateBlobbiDialog } from '@/components/blobbi/CreateBlobbiDialog';
import { useBlobbi } from '@/hooks/useBlobbi';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface PetForm {
  name: string;
  personality: string;
  color: string;
  description: string;
}

const petForms: PetForm[] = [
  {
    name: 'Pengui',
    personality: 'Shy & Adorable',
    color: '#374151',
    description: 'A cute penguin that loves cold environments and waddles slowly'
  },
  {
    name: 'Owli',
    personality: 'Wise & Nocturnal',
    color: '#a8a29e',
    description: 'A wise little owl with big curious eyes'
  },
  {
    name: 'Catti',
    personality: 'Independent & Curious',
    color: '#f97316',
    description: 'A minimalist cat with a playful attitude'
  },
  {
    name: 'Froggi',
    personality: 'Silly & Energetic',
    color: '#22c55e',
    description: 'A bouncy frog with pop-out eyes'
  }
];

const BlobbiEvolution: React.FC = () => {
  const [selectedForm, setSelectedForm] = useState<number | null>(null);
  const [showAccessory, setShowAccessory] = useState(false);
  const { user } = useCurrentUser();
  const { blobbi } = useBlobbi();

  const renderBlobbi = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Shadow */}
      <ellipse
        cx="100"
        cy="190"
        rx="50"
        ry="6"
        fill="rgba(0,0,0,0.2)"
      />
      
      {/* Main body - cute water droplet shape */}
      <path
        d="M 100 30 Q 100 20 100 30 Q 144 50 150 110 Q 150 160 100 176 Q 50 160 50 110 Q 56 50 100 30"
        fill="#7C3AED"
        className="transition-colors duration-300"
      />
      
      {/* Subtle inner glow for softness */}
      <ellipse
        cx="100"
        cy="90"
        rx="30"
        ry="40"
        fill="white"
        opacity="0.15"
      />
      
      {/* Eyes - simple with single highlight */}
      <g id="left-eye">
        <ellipse cx="76" cy="90" rx="16" ry="20" fill="white" />
        <circle cx="76" cy="92" r="12" fill="#1e293b" />
        {/* Single eye shine */}
        <circle cx="80" cy="88" r="4" fill="white" />
      </g>
      <g id="right-eye">
        <ellipse cx="124" cy="90" rx="16" ry="20" fill="white" />
        <circle cx="124" cy="92" r="12" fill="#1e293b" />
        {/* Single eye shine */}
        <circle cx="128" cy="88" r="4" fill="white" />
      </g>
      
      {/* Happy mouth */}
      <path 
        d="M 84 124 Q 100 136 116 124" 
        stroke="#1e293b" 
        strokeWidth="5" 
        fill="none" 
        strokeLinecap="round" 
      />
      
      {/* Blush for cuteness */}
      <ellipse cx="44" cy="110" rx="12" ry="8" fill="rgba(255,182,193,0.4)" />
      <ellipse cx="156" cy="110" rx="12" ry="8" fill="rgba(255,182,193,0.4)" />
      
      {/* Optional accessory - simple hat */}
      {showAccessory && (
        <g>
          <rect x="70" y="50" width="60" height="10" fill="#f59e0b" rx="2" />
          <rect x="80" y="30" width="40" height="30" fill="#f59e0b" rx="5" />
        </g>
      )}
    </svg>
  );

  const renderPengui = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Body - rounder, more egg-shaped */}
      <ellipse cx="100" cy="115" rx="55" ry="65" fill="#374151" />
      <ellipse cx="100" cy="115" rx="55" ry="65" fill="url(#penguiBodyGradient)" opacity="0.3" />
      
      {/* White belly - larger and rounder */}
      <ellipse cx="100" cy="120" rx="40" ry="45" fill="#f9fafb" />
      <ellipse cx="100" cy="120" rx="40" ry="45" fill="url(#penguiBellyGradient)" opacity="0.5" />
      
      {/* Wings - smaller and cuter */}
      <ellipse cx="50" cy="115" rx="15" ry="25" fill="#374151" transform="rotate(-15 50 115)" />
      <ellipse cx="150" cy="115" rx="15" ry="25" fill="#374151" transform="rotate(15 150 115)" />
      
      {/* Eyes - bigger and more expressive */}
      <ellipse cx="85" cy="85" rx="12" ry="14" fill="#ffffff" />
      <ellipse cx="115" cy="85" rx="12" ry="14" fill="#ffffff" />
      <circle cx="85" cy="87" r="8" fill="#1e293b" />
      <circle cx="115" cy="87" r="8" fill="#1e293b" />
      <circle cx="88" cy="84" r="3" fill="white" />
      <circle cx="118" cy="84" r="3" fill="white" />
      <circle cx="83" cy="89" r="1.5" fill="white" />
      <circle cx="113" cy="89" r="1.5" fill="white" />
      
      {/* Beak - rounder and friendlier */}
      <ellipse cx="100" cy="105" rx="8" ry="6" fill="#fb923c" />
      <ellipse cx="100" cy="103" rx="6" ry="4" fill="#fed7aa" opacity="0.6" />
      
      {/* Rosy cheeks */}
      <ellipse cx="60" cy="95" rx="10" ry="8" fill="#fbbf24" opacity="0.3" />
      <ellipse cx="140" cy="95" rx="10" ry="8" fill="#fbbf24" opacity="0.3" />
      
      {/* Feet - more rounded */}
      <ellipse cx="85" cy="175" rx="15" ry="8" fill="#fb923c" />
      <ellipse cx="115" cy="175" rx="15" ry="8" fill="#fb923c" />
      <ellipse cx="85" cy="173" rx="12" ry="5" fill="#fed7aa" opacity="0.5" />
      <ellipse cx="115" cy="173" rx="12" ry="5" fill="#fed7aa" opacity="0.5" />
      
      {/* Shy smile */}
      <path d="M 92 110 Q 100 113 108 110" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />
      
      {/* Optional accessory - winter hat */}
      {showAccessory && (
        <g>
          <ellipse cx="100" cy="45" rx="40" ry="30" fill="#60a5fa" />
          <rect x="60" y="40" width="80" height="25" fill="#3b82f6" rx="3" />
          <circle cx="100" cy="30" r="10" fill="#ffffff" />
          <circle cx="100" cy="30" r="7" fill="#dbeafe" />
        </g>
      )}
      
      <defs>
        <radialGradient id="penguiBodyGradient">
          <stop offset="0%" stopColor="#6b7280" />
          <stop offset="100%" stopColor="#1f2937" />
        </radialGradient>
        <radialGradient id="penguiBellyGradient">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f3f4f6" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderOwli = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Round body */}
      <circle cx="100" cy="110" r="60" fill="#a8a29e" />
      <circle cx="100" cy="110" r="60" fill="url(#owliGradient)" opacity="0.3" />
      
      {/* Triangle ears */}
      <path d="M 60 70 L 70 50 L 80 70 Z" fill="#a8a29e" />
      <path d="M 120 70 L 130 50 L 140 70 Z" fill="#a8a29e" />
      
      {/* Large circular eyes */}
      <circle cx="80" cy="100" r="20" fill="#f5f5f4" />
      <circle cx="120" cy="100" r="20" fill="#f5f5f4" />
      <circle cx="80" cy="100" r="12" fill="#1e293b" />
      <circle cx="120" cy="100" r="12" fill="#1e293b" />
      <circle cx="83" cy="97" r="4" fill="white" />
      <circle cx="123" cy="97" r="4" fill="white" />
      
      {/* Small beak */}
      <path d="M 100 110 L 95 120 L 100 125 L 105 120 Z" fill="#f59e0b" />
      
      {/* Minimal wings */}
      <ellipse cx="50" cy="110" rx="15" ry="30" fill="#78716c" transform="rotate(-20 50 110)" />
      <ellipse cx="150" cy="110" rx="15" ry="30" fill="#78716c" transform="rotate(20 150 110)" />
      
      {/* Optional accessory - tiny bow tie */}
      {showAccessory && (
        <g>
          <path d="M 85 140 L 100 135 L 115 140 L 115 150 L 100 145 L 85 150 Z" fill="#dc2626" />
          <rect x="95" y="135" width="10" height="15" fill="#991b1b" />
        </g>
      )}
      
      <defs>
        <radialGradient id="owliGradient">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#78716c" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderCatti = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Oval upright body */}
      <ellipse cx="100" cy="120" rx="45" ry="60" fill="#f97316" />
      <ellipse cx="100" cy="120" rx="45" ry="60" fill="url(#cattiGradient)" opacity="0.3" />
      
      {/* Triangle ears */}
      <path d="M 70 70 L 60 50 L 80 60 Z" fill="#f97316" />
      <path d="M 130 70 L 140 50 L 120 60 Z" fill="#f97316" />
      <path d="M 70 60 L 65 52 L 75 57 Z" fill="#fb923c" />
      <path d="M 130 60 L 135 52 L 125 57 Z" fill="#fb923c" />
      
      {/* Expressive eyes */}
      <ellipse cx="85" cy="100" rx="8" ry="12" fill="#1e293b" />
      <ellipse cx="115" cy="100" rx="8" ry="12" fill="#1e293b" />
      <ellipse cx="87" cy="98" rx="3" ry="4" fill="white" />
      <ellipse cx="117" cy="98" rx="3" ry="4" fill="white" />
      
      {/* Cat nose and mouth */}
      <path d="M 95 115 L 100 120 L 105 115 Z" fill="#1e293b" />
      <path d="M 100 120 Q 90 125 85 120" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M 100 120 Q 110 125 115 120" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />
      
      {/* Curved tail */}
      <path d="M 145 140 Q 160 120 155 100 Q 150 80 160 70" stroke="#f97316" strokeWidth="20" fill="none" strokeLinecap="round" />
      
      {/* Whiskers */}
      <line x1="50" y1="110" x2="70" y2="108" stroke="#1e293b" strokeWidth="1.5" />
      <line x1="50" y1="120" x2="70" y2="118" stroke="#1e293b" strokeWidth="1.5" />
      <line x1="130" y1="108" x2="150" y2="110" stroke="#1e293b" strokeWidth="1.5" />
      <line x1="130" y1="118" x2="150" y2="120" stroke="#1e293b" strokeWidth="1.5" />
      
      {/* Optional accessory - collar with bell */}
      {showAccessory && (
        <g>
          <rect x="55" y="145" width="90" height="8" fill="#dc2626" rx="4" />
          <circle cx="100" cy="155" r="6" fill="#fbbf24" />
          <line x1="100" y1="155" x2="100" y2="159" stroke="#1e293b" strokeWidth="1" />
        </g>
      )}
      
      <defs>
        <radialGradient id="cattiGradient">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#ea580c" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderFroggi = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Flattened oval body */}
      <ellipse cx="100" cy="120" rx="70" ry="50" fill="#22c55e" />
      <ellipse cx="100" cy="120" rx="70" ry="50" fill="url(#froggiGradient)" opacity="0.3" />
      
      {/* Big circular pop-out eyes */}
      <circle cx="70" cy="80" r="25" fill="#22c55e" />
      <circle cx="130" cy="80" r="25" fill="#22c55e" />
      <circle cx="70" cy="80" r="20" fill="#f5f5f4" />
      <circle cx="130" cy="80" r="20" fill="#f5f5f4" />
      <circle cx="70" cy="80" r="15" fill="#1e293b" />
      <circle cx="130" cy="80" r="15" fill="#1e293b" />
      <circle cx="73" cy="77" r="5" fill="white" />
      <circle cx="133" cy="77" r="5" fill="white" />
      
      {/* Wide silly smile */}
      <path d="M 50 120 Q 100 140 150 120" stroke="#1e293b" strokeWidth="4" fill="none" strokeLinecap="round" />
      
      {/* Nostrils */}
      <ellipse cx="90" cy="110" rx="3" ry="5" fill="#16a34a" />
      <ellipse cx="110" cy="110" rx="3" ry="5" fill="#16a34a" />
      
      {/* Little webbed feet */}
      <ellipse cx="60" cy="160" rx="20" ry="10" fill="#22c55e" />
      <ellipse cx="140" cy="160" rx="20" ry="10" fill="#22c55e" />
      <path d="M 45 160 L 50 155 M 55 160 L 55 155 M 65 160 L 70 155" stroke="#16a34a" strokeWidth="2" />
      <path d="M 125 160 L 130 155 M 135 160 L 135 155 M 145 160 L 150 155" stroke="#16a34a" strokeWidth="2" />
      
      {/* Optional accessory - tiny crown */}
      {showAccessory && (
        <g>
          <path d="M 80 50 L 85 40 L 90 50 L 100 40 L 110 50 L 115 40 L 120 50 L 120 60 L 80 60 Z" fill="#fbbf24" />
          <circle cx="100" cy="45" r="3" fill="#dc2626" />
        </g>
      )}
      
      <defs>
        <radialGradient id="froggiGradient">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderPet = (index: number) => {
    switch (index) {
      case 0: return renderPengui();
      case 1: return renderOwli();
      case 2: return renderCatti();
      case 3: return renderFroggi();
      default: return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">Evolution System</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300 mt-2">
                After 4 full days of consistent care, your Blobbi will evolve into one of four adorable forms! 
                Care for your Blobbi at least 3 times per day to maintain your care streak.
              </CardDescription>
            </div>
            {user && !blobbi && (
              <CreateBlobbiDialog>
                <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
                  Create Your First Blobbi
                </Button>
              </CreateBlobbiDialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Original Blobbi</h3>
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-8 border border-blue-200 dark:border-blue-600">
                <div className="w-48 h-48 mx-auto">
                  {renderBlobbi()}
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
                Your cute blob companion awaiting evolution
              </p>
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAccessory(!showAccessory)}
                  className="border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                >
                  {showAccessory ? 'Remove' : 'Add'} Accessories
                </Button>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Evolution Preview</h3>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50 rounded-2xl p-8 min-h-[256px] flex items-center justify-center border border-gray-200 dark:border-gray-600">
                {selectedForm !== null ? (
                  <div className="w-48 h-48">
                    {renderPet(selectedForm)}
                  </div>
                ) : (
                  <p className="text-gray-600 dark:text-gray-300">Select an evolution form below</p>
                )}
              </div>
              {selectedForm !== null && (
                <div className="text-center space-y-2">
                  <h4 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{petForms[selectedForm].name}</h4>
                  <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                    {petForms[selectedForm].personality}
                  </Badge>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{petForms[selectedForm].description}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-4 gap-6">
        {petForms.map((form, index) => (
          <Card 
            key={form.name}
            className={`cursor-pointer transition-all hover:shadow-lg bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border ${
              selectedForm === index 
                ? 'ring-2 ring-purple-500 border-purple-300 dark:border-purple-500' 
                : 'border-purple-200 dark:border-purple-600 hover:border-purple-300 dark:hover:border-purple-500'
            }`}
            onClick={() => setSelectedForm(index)}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-gray-900 dark:text-gray-100">{form.name}</CardTitle>
              <Badge variant="outline" className="w-fit text-xs border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400">
                {form.personality}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="w-32 h-32 mx-auto mb-3">
                {renderPet(index)}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 text-center">
                {form.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-yellow-200 dark:border-yellow-600">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span className="text-yellow-500">✨</span>
            Design Features
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-3">
            <span className="text-purple-500">✨</span>
            <div>
              <strong className="text-gray-900 dark:text-gray-100">Soft, minimal aesthetic</strong>
              <span className="text-gray-600 dark:text-gray-300"> with flat colors and gentle gradients</span>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-pink-500">🎨</span>
            <div>
              <strong className="text-gray-900 dark:text-gray-100">Simple geometric shapes</strong>
              <span className="text-gray-600 dark:text-gray-300"> for easy animation and recognition</span>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-yellow-500">😊</span>
            <div>
              <strong className="text-gray-900 dark:text-gray-100">Expressive personalities</strong>
              <span className="text-gray-600 dark:text-gray-300"> through facial features and body language</span>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-blue-500">🎩</span>
            <div>
              <strong className="text-gray-900 dark:text-gray-100">Accessory support</strong>
              <span className="text-gray-600 dark:text-gray-300"> for customization (hats, glasses, collars, etc.)</span>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-green-500">🎲</span>
            <div>
              <strong className="text-gray-900 dark:text-gray-100">Evolution after 4 days</strong>
              <span className="text-gray-600 dark:text-gray-300"> of consistent care - each Blobbi's form is determined by your care patterns!</span>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-red-500">📅</span>
            <div>
              <strong className="text-gray-900 dark:text-gray-100">Daily care requirement</strong>
              <span className="text-gray-600 dark:text-gray-300"> - perform at least 3 care actions per day to maintain your streak</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BlobbiEvolution;