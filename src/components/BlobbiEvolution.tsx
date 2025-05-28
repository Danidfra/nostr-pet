import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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

  const renderBlobbi = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Base blob shape */}
      <ellipse cx="100" cy="110" rx="60" ry="70" fill="#e0e7ff" />
      
      {/* Soft shading */}
      <ellipse cx="100" cy="110" rx="60" ry="70" fill="url(#blobbiGradient)" opacity="0.3" />
      
      {/* Eyes */}
      <circle cx="80" cy="100" r="8" fill="#1e293b" />
      <circle cx="120" cy="100" r="8" fill="#1e293b" />
      <circle cx="82" cy="98" r="3" fill="white" />
      <circle cx="122" cy="98" r="3" fill="white" />
      
      {/* Cute mouth */}
      <path d="M 90 120 Q 100 130 110 120" stroke="#1e293b" strokeWidth="3" fill="none" strokeLinecap="round" />
      
      {/* Optional accessory - simple hat */}
      {showAccessory && (
        <g>
          <rect x="70" y="50" width="60" height="10" fill="#f59e0b" rx="2" />
          <rect x="80" y="30" width="40" height="30" fill="#f59e0b" rx="5" />
        </g>
      )}
      
      <defs>
        <radialGradient id="blobbiGradient">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#c7d2fe" />
        </radialGradient>
      </defs>
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
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Blobbi Evolution System</CardTitle>
          <CardDescription>
            After your first care action (feed, play, or clean), your Blobbi will randomly evolve into one of four adorable forms!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Original Blobbi</h3>
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8">
                <div className="w-48 h-48 mx-auto">
                  {renderBlobbi()}
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Your cute blob companion awaiting evolution
              </p>
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAccessory(!showAccessory)}
                >
                  {showAccessory ? 'Remove' : 'Add'} Accessories
                </Button>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Evolution Preview</h3>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 min-h-[256px] flex items-center justify-center">
                {selectedForm !== null ? (
                  <div className="w-48 h-48">
                    {renderPet(selectedForm)}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Select an evolution form below</p>
                )}
              </div>
              {selectedForm !== null && (
                <div className="text-center space-y-2">
                  <h4 className="font-semibold text-lg">{petForms[selectedForm].name}</h4>
                  <Badge variant="secondary">{petForms[selectedForm].personality}</Badge>
                  <p className="text-sm text-muted-foreground">{petForms[selectedForm].description}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-4 gap-4">
        {petForms.map((form, index) => (
          <Card 
            key={form.name}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedForm === index ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedForm(index)}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{form.name}</CardTitle>
              <Badge variant="outline" className="w-fit text-xs">
                {form.personality}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="w-32 h-32 mx-auto mb-3">
                {renderPet(index)}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {form.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">Design Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>✨ <strong>Soft, minimal aesthetic</strong> with flat colors and gentle gradients</p>
          <p>🎨 <strong>Simple geometric shapes</strong> for easy animation and recognition</p>
          <p>😊 <strong>Expressive personalities</strong> through facial features and body language</p>
          <p>🎩 <strong>Accessory support</strong> for customization (hats, glasses, collars, etc.)</p>
          <p>🎲 <strong>Random evolution</strong> after first care action - each Blobbi's destiny is a surprise!</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BlobbiEvolution;