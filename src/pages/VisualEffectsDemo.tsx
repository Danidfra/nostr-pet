import { BlobbiVisualEffectsDemo } from '@/components/BlobbiVisualEffectsDemo';
import { SimpleNavBar } from '@/components/SimpleNavBar';

export default function VisualEffectsDemo() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
      <SimpleNavBar />
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
            Blobbi Visual Effects
          </h1>
          <p className="text-muted-foreground">
            Explore all the visual effects, patterns, and blessings that can appear on baby Blobbis.
            These effects are randomly assigned when a Blobbi hatches, based on the rarity system described in the documentation.
          </p>
        </div>
        
        <BlobbiVisualEffectsDemo />
      </div>
    </div>
  );
}