import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Heart,
  Sparkles,
  Search,
  Archive,
  Egg,
  Activity,
} from 'lucide-react';
import { BlobbiCard } from '@/components/blobbi/BlobbiCard';
import { Blobbi } from '@/types/blobbi';

type BlobbiFilter = 'all' | 'active' | 'incubating' | 'evolved' | 'archived';

interface BlobbisTabProps {
  filteredBlobbis: Blobbi[];
  userBlobbis: Blobbi[];
  filter: BlobbiFilter;
  setFilter: (filter: BlobbiFilter) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  navigate: (path: string) => void;
}

export function BlobbisTab({
  filteredBlobbis,
  userBlobbis,
  filter,
  setFilter,
  searchQuery,
  setSearchQuery,
  navigate,
}: BlobbisTabProps) {
  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search your Blobbis..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/80 dark:bg-gray-700/80 border-purple-200 dark:border-purple-600 focus:border-purple-400 dark:focus:border-purple-500 focus:ring-purple-400/50 dark:focus:ring-purple-500/50 focus:bg-white dark:focus:bg-gray-700 placeholder:text-purple-400/60 dark:placeholder:text-purple-400/70 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
                className={filter === 'all' ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white' : 'border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'}
              >
                All
              </Button>
              <Button
                variant={filter === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('active')}
                className={filter === 'active' ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white' : 'border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'}
              >
                <Activity className="w-4 h-4 mr-1" />
                Active
              </Button>
              <Button
                variant={filter === 'incubating' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('incubating')}
                className={filter === 'incubating' ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white' : 'border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'}
              >
                <Egg className="w-4 h-4 mr-1" />
                Incubating
              </Button>
              <Button
                variant={filter === 'evolved' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('evolved')}
                className={filter === 'evolved' ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white' : 'border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'}
              >
                <Sparkles className="w-4 h-4 mr-1" />
                Evolved
              </Button>
              <Button
                variant={filter === 'archived' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('archived')}
                className={filter === 'archived' ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white' : 'border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'}
              >
                <Archive className="w-4 h-4 mr-1" />
                Archived
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Blobbis Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBlobbis.map((blobbi) => (
          <BlobbiCard
            key={blobbi.id}
            blobbi={blobbi}
            size="md"
            onClick={() => navigate(`/blobbi/${blobbi.id}`)}
            showStats={true}
            showStatus={true}
            showActions={true}
            onViewDetails={() => navigate(`/blobbi/${blobbi.id}`)}
            className="h-full"
          />
        ))}
      </div>

      {filteredBlobbis.length === 0 && (
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
          <CardContent className="py-12 text-center">
            <div className="text-gray-600 dark:text-gray-400 mb-4">
              {userBlobbis.length === 0
                ? "You don't have any Blobbis yet."
                : "No Blobbis match your current filter."
              }
            </div>
            {userBlobbis.length === 0 && (
              <Link to="/blobbi/adopt">
                <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
                  <Heart className="w-4 h-4 mr-2" />
                  Adopt Your First Blobbi
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}