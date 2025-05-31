import { BlobbiAdoption } from '@/components/BlobbiAdoption';
import { LoginArea } from '@/components/auth/LoginArea';

export function BlobbiAdoptionPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-secondary">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Welcome to Blobbi World
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Adopt your very own virtual pet Blobbi and watch it grow from an egg to a fully evolved companion. 
            Each Blobbi is unique with its own personality, appearance, and traits.
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto grid gap-8 md:grid-cols-2 items-start">
          <div className="space-y-6">
            <div className="bg-card rounded-lg p-6 shadow-elegant border">
              <h2 className="text-2xl font-semibold mb-4 text-card-foreground">How it Works</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold">1</div>
                  <div>
                    <h3 className="font-medium text-card-foreground">Adopt Your Blobbi</h3>
                    <p className="text-sm text-muted-foreground">Choose a name and create your unique Blobbi egg</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-ring/10 text-ring rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold">2</div>
                  <div>
                    <h3 className="font-medium text-card-foreground">Care for Your Egg</h3>
                    <p className="text-sm text-muted-foreground">Provide daily care for 4 days to help your Blobbi hatch</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-destructive/10 text-destructive rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold">3</div>
                  <div>
                    <h3 className="font-medium text-card-foreground">Watch It Grow</h3>
                    <p className="text-sm text-muted-foreground">Your Blobbi will evolve from baby to adult with continued care</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-card rounded-lg p-6 shadow-elegant border">
              <h2 className="text-2xl font-semibold mb-4 text-card-foreground">Features</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="text-primary">✓</span>
                  Unique randomized appearance and traits
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Three life stages: Egg, Baby, Adult
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Daily care requirements and interactions
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Permanent records on the Nostr network
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Cross-client compatibility
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Social interactions and breeding (coming soon)
                </li>
              </ul>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-card rounded-lg p-6 shadow-elegant border">
              <LoginArea />
            </div>
            
            <BlobbiAdoption />
          </div>
        </div>
      </div>
    </div>
  );
}