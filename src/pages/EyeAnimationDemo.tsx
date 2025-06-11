import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BlobbiVisual } from '@/components/blobbi/BlobbiVisual';
import { BlobbiEvolvedVisual } from '@/components/blobbi/BlobbiEvolvedVisual';
import { Blobbi } from '@/types/blobbi';

// Sample Blobbi data for demonstration
const sampleBaby: Blobbi = {
  id: 'demo-baby',
  ownerPubkey: 'demo-pubkey',
  name: 'Demo Baby',
  birthTime: Date.now(),
  lastInteraction: Math.floor(Date.now() / 1000),
  lifeStage: 'baby',
  state: 'active',
  stats: {
    happiness: 80,
    health: 90,
    energy: 70,
    hygiene: 85,
    hunger: 60,
  },
  customization: {
    color: '#8b5cf6',
    accessories: [],
    pattern: undefined,
  },
  experience: 150,
  coins: 50,
  inventory: [],
  generation: 1,
  breedingReady: false,
  careStreak: 3,
  baseColor: '#8b5cf6',
  secondaryColor: '#7c3aed',
  eyeColor: '#374151',
  size: 'medium',
  evolutionProgress: {
    totalCareDays: 0,
    currentStreak: 0,
    lastCareDate: Date.now(),
    careSessions: [],
    isEligibleForEvolution: false,
    nextEvolutionCheck: Date.now() + 86400000,
  },
};

const sampleAdult: Blobbi = {
  id: 'demo-adult',
  ownerPubkey: 'demo-pubkey',
  name: 'Demo Adult',
  birthTime: Date.now() - 2592000000, // 30 days ago
  lastInteraction: Math.floor(Date.now() / 1000),
  lifeStage: 'adult',
  evolutionForm: 'pandi',
  state: 'active',
  stats: {
    happiness: 85,
    health: 95,
    energy: 80,
    hygiene: 90,
    hunger: 70,
  },
  customization: {
    color: '#22c55e',
    accessories: [],
    pattern: undefined,
  },
  experience: 1500,
  coins: 250,
  inventory: [],
  generation: 1,
  breedingReady: true,
  careStreak: 15,
  baseColor: '#22c55e',
  secondaryColor: '#16a34a',
  eyeColor: '#374151',
  size: 'medium',
  evolutionTime: Date.now() - 1296000000, // 15 days ago
  evolutionProgress: {
    totalCareDays: 30,
    currentStreak: 15,
    lastCareDate: Date.now(),
    careSessions: [],
    isEligibleForEvolution: true,
    nextEvolutionCheck: Date.now() + 86400000,
  },
};

export default function EyeAnimationDemo() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Blobbi Eye Animation Demo</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Watch the Blobbi eyes come to life! They blink naturally every 3-6 seconds and follow your mouse cursor around the screen.
          Move your mouse around to see the pupils track your movement.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Baby Blobbi</CardTitle>
            <CardDescription>
              The baby stage Blobbi with animated eyes that blink and track mouse movement
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <BlobbiVisual 
              blobbi={sampleBaby} 
              size="large"
              className="hover:scale-110 transition-transform duration-300"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Adult Blobbi (Pandi)</CardTitle>
            <CardDescription>
              The evolved adult Blobbi with enhanced eye animations and mouse tracking
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <BlobbiEvolvedVisual 
              blobbi={sampleAdult} 
              size="large"
              className="hover:scale-110 transition-transform duration-300"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Animation Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h3 className="font-semibold mb-2">🎯 Mouse Tracking</h3>
              <p className="text-sm text-muted-foreground">
                The pupils follow your mouse cursor with smooth animations. The white highlights move with the pupils to maintain realistic eye appearance.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">👁️ Natural Blinking</h3>
              <p className="text-sm text-muted-foreground">
                Eyes blink automatically every 3-6 seconds with a smooth animation that makes the Blobbi feel alive.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">⚡ Performance Optimized</h3>
              <p className="text-sm text-muted-foreground">
                Uses requestAnimationFrame for smooth 60fps animations and CSS transitions for optimal performance.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">📱 Device Adaptive</h3>
              <p className="text-sm text-muted-foreground">
                Mouse tracking only activates on devices with mouse support, preserving battery on touch devices.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">✨ Realistic Highlights</h3>
              <p className="text-sm text-muted-foreground">
                White highlight circles automatically move with the pupils, maintaining proper positioning for realistic eye reflections.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          The eye animations work for both the companion SVGs (fetched from external sources) and the built-in React SVG components.
        </p>
      </div>
    </div>
  );
}