import { useState } from 'react';
import { BlobbiVisual } from './blobbi/BlobbiVisual';
import { Blobbi } from '@/types/blobbi';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { getVisualEffectRarity } from '@/lib/blobbi-visual-tags';

export function BlobbiVisualEffectsDemo() {
  const [currentEffect, setCurrentEffect] = useState<string>('none');
  
  // Base Blobbi for demo
  const baseBlobbi: Blobbi = {
    id: 'demo-blobbi',
    ownerPubkey: 'demo',
    name: 'Demo Blobbi',
    birthTime: Date.now(),
    lastInteraction: Math.floor(Date.now() / 1000),
    lifeStage: 'baby',
    state: 'active',
    stats: {
      hunger: 80,
      happiness: 80,
      energy: 80,
      hygiene: 80,
      health: 100,
    },
    customization: {
      color: '#7C3AED',
      accessories: [],
    },
    experience: 0,
    coins: 100,
    inventory: [],
    evolutionProgress: {
      totalCareDays: 0,
      currentStreak: 0,
      lastCareDate: 0,
      careSessions: [],
      isEligibleForEvolution: false,
      nextEvolutionCheck: 0,
    },
    generation: 1,
    breedingReady: false,
    careStreak: 0,
    baseColor: '#ffcc99',
    eyeColor: '#6699ff',
  };

  // Visual effects to demo
  const manifestations = [
    'dot_center', 'oval_spots', 'side_bands', 'dot_speckle', 'light_dash',
    'freckle_patch', 'sparkle_trail', 'light_smoke', 'dusty_aura',
    'ring_mark', 'glow_ring', 'wavy_spots', 'mist_drift',
    'rune_top', 'shimmer_band', 'spirit_knot', 'crescent_moon', 'tiny_star',
    'wave_stroke', 'glow_blue', 'glimmer_gold', 'mist_wisp',
    'sigil_eye', 'glow_crack_pattern', 'ethereal_rune', 'leaf_stamp', 'divine_circle',
    'ancestral_knot', 'angel_halo', 'aurora_waves', 'radiant_line'
  ];

  const patterns = [
    'stripes', 'dots', 'gradient', 'soft_wave',
    'spiral_twist', 'galaxy_dust', 'crackled_lines',
    'nebula_bloom', 'sacred_geometry', 'shifting_rings'
  ];

  const blessings = [
    'telepathic', 'keen_sense', 'light_heal',
    'night_vision', 'inner_peace', 'sun_gifted',
    'eternal_grace', 'blessing_of_light', 'soul_touch'
  ];

  const getDemoBlobbi = (effectType: string, effectValue: string): Blobbi => {
    const blobbi = { ...baseBlobbi };
    
    if (effectType === 'manifestation') {
      blobbi.manifestation = effectValue;
    } else if (effectType === 'pattern') {
      blobbi.pattern = effectValue;
    } else if (effectType === 'blessing') {
      blobbi.blessing = effectValue;
    }
    
    return blobbi;
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-500';
      case 'uncommon': return 'bg-green-500';
      case 'rare': return 'bg-blue-500';
      case 'legendary': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Blobbi Visual Effects Demo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center min-h-[300px] p-8 bg-gradient-to-br from-purple-50/60 to-pink-50/60 rounded-lg border border-purple-100/50 mb-6">
            <BlobbiVisual 
              blobbi={currentEffect === 'none' ? baseBlobbi : getDemoBlobbi(
                currentEffect.split(':')[0], 
                currentEffect.split(':')[1]
              )} 
              size="large" 
            />
          </div>
          
          <div className="text-center mb-4">
            <p className="text-sm text-muted-foreground">
              Current Effect: <span className="font-semibold">{currentEffect === 'none' ? 'None' : currentEffect.split(':')[1]}</span>
              {currentEffect !== 'none' && (
                <Badge className={`ml-2 ${getRarityColor(getVisualEffectRarity(currentEffect.split(':')[1]))}`}>
                  {getVisualEffectRarity(currentEffect.split(':')[1])}
                </Badge>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Manifestations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Manifestations</CardTitle>
            <p className="text-sm text-muted-foreground">Visual traits that appear on the Blobbi's surface</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button
                variant={currentEffect === 'none' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentEffect('none')}
                className="w-full justify-start"
              >
                None
              </Button>
              {manifestations.map((manifestation) => (
                <Button
                  key={manifestation}
                  variant={currentEffect === `manifestation:${manifestation}` ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentEffect(`manifestation:${manifestation}`)}
                  className="w-full justify-between"
                >
                  <span>{manifestation.replace(/_/g, ' ')}</span>
                  <Badge className={`${getRarityColor(getVisualEffectRarity(manifestation))} text-white`}>
                    {getVisualEffectRarity(manifestation)}
                  </Badge>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Patterns */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Patterns</CardTitle>
            <p className="text-sm text-muted-foreground">Pattern overlays on the Blobbi's body</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {patterns.map((pattern) => (
                <Button
                  key={pattern}
                  variant={currentEffect === `pattern:${pattern}` ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentEffect(`pattern:${pattern}`)}
                  className="w-full justify-between"
                >
                  <span>{pattern.replace(/_/g, ' ')}</span>
                  <Badge className={`${getRarityColor(getVisualEffectRarity(pattern))} text-white`}>
                    {getVisualEffectRarity(pattern)}
                  </Badge>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Blessings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Blessings</CardTitle>
            <p className="text-sm text-muted-foreground">Magical effects that surround the Blobbi</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {blessings.map((blessing) => (
                <Button
                  key={blessing}
                  variant={currentEffect === `blessing:${blessing}` ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentEffect(`blessing:${blessing}`)}
                  className="w-full justify-between"
                >
                  <span>{blessing.replace(/_/g, ' ')}</span>
                  <Badge className={`${getRarityColor(getVisualEffectRarity(blessing))} text-white`}>
                    {getVisualEffectRarity(blessing)}
                  </Badge>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rarity System</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <Badge className="bg-gray-500 text-white mb-2">Common</Badge>
              <p className="text-sm text-muted-foreground">50-65% spawn chance</p>
            </div>
            <div className="text-center">
              <Badge className="bg-green-500 text-white mb-2">Uncommon</Badge>
              <p className="text-sm text-muted-foreground">30-35% spawn chance</p>
            </div>
            <div className="text-center">
              <Badge className="bg-blue-500 text-white mb-2">Rare</Badge>
              <p className="text-sm text-muted-foreground">15-20% spawn chance</p>
            </div>
            <div className="text-center">
              <Badge className="bg-purple-500 text-white mb-2">Legendary</Badge>
              <p className="text-sm text-muted-foreground">1-5% spawn chance</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}