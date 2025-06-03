import { BlobbiAdoption } from '@/components/BlobbiAdoption';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function BlobbiAdoptionPage() {
  const { user } = useCurrentUser();

  // If user is not logged in, show a simple login prompt
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🌟</span>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
              Welcome to Blobbi World
            </h1>
            <p className="text-gray-600">
              Please log in to begin your magical journey with Blobbis
            </p>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-purple-200">
            <LoginArea />
          </div>
        </div>
      </div>
    );
  }

  // If user is logged in, show the full adoption experience
  return <BlobbiAdoption />;
}