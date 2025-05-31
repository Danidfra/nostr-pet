import { BlobbiAdoption } from '@/components/BlobbiAdoption';
import { LoginArea } from '@/components/auth/LoginArea';

export function BlobbiAdoptionPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Welcome to Blobbi World
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Adopt your very own virtual pet Blobbi and watch it grow from an egg to a fully evolved companion. 
            Each Blobbi is unique with its own personality, appearance, and traits.
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto grid gap-8 md:grid-cols-2 items-start">
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">How it Works</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold">1</div>
                  <div>
                    <h3 className="font-medium text-gray-800">Adopt Your Blobbi</h3>
                    <p className="text-sm text-gray-600">Choose a name and create your unique Blobbi egg</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-purple-100 text-purple-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold">2</div>
                  <div>
                    <h3 className="font-medium text-gray-800">Care for Your Egg</h3>
                    <p className="text-sm text-gray-600">Provide daily care for 4 days to help your Blobbi hatch</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-pink-100 text-pink-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold">3</div>
                  <div>
                    <h3 className="font-medium text-gray-800">Watch It Grow</h3>
                    <p className="text-sm text-gray-600">Your Blobbi will evolve from baby to adult with continued care</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">Features</h2>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
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
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <LoginArea />
            </div>
            
            <BlobbiAdoption />
          </div>
        </div>
      </div>
    </div>
  );
}