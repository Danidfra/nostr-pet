/**
 * BlobbiDashboardSkeleton - Layout-accurate loading skeleton
 * Matches the exact structure, spacing, and positioning of the real BlobbiDashboard
 * to prevent layout jumps during boot
 */

export function BlobbiDashboardSkeleton() {
  return (
    <div className="relative flex-1 min-h-0">
      {/* Match the exact structure: Growth Hub + Quick Actions + Content */}
      <div className="relative h-full flex flex-col min-h-0">
        {/* Left Growth Hub skeleton button */}
        <div className="absolute -left-8 z-20 p-2 h-8 w-8 rounded-full backdrop-blur-sm border border-purple-200 dark:border-purple-600 bg-white/80 dark:bg-gray-800/80 animate-pulse" />

        {/* Right quick-action rail skeleton */}
        <div className="absolute -right-8 sm:right-3 z-20 flex flex-col gap-2">
          {/* PiP button skeleton */}
          <div className="p-2 h-8 w-8 rounded-full backdrop-blur-sm border border-purple-200 dark:border-purple-600 bg-white/80 dark:bg-gray-800/80 animate-pulse" />
          
          {/* Companion button skeleton */}
          <div className="p-2 h-8 w-8 rounded-full backdrop-blur-sm border border-purple-200 dark:border-purple-600 bg-white/80 dark:bg-gray-800/80 animate-pulse" />
          
          {/* Camera button skeleton */}
          <div className="p-2 h-8 w-8 rounded-full backdrop-blur-sm border border-purple-200 dark:border-purple-600 bg-white/80 dark:bg-gray-800/80 animate-pulse" />
          
          {/* Community button skeleton */}
          <div className="p-2 h-8 w-8 rounded-full backdrop-blur-sm border border-purple-200 dark:border-purple-600 bg-white/80 dark:bg-gray-800/80 animate-pulse" />
          
          {/* Settings button skeleton */}
          <div className="p-2 h-8 w-8 rounded-full backdrop-blur-sm border border-purple-200 dark:border-purple-600 bg-white/80 dark:bg-gray-800/80 animate-pulse" />
        </div>

        {/* Content column - matches real dashboard structure */}
        <div className="h-full flex flex-col">
          {/* Name header skeleton - Fixed height header */}
          <div className="text-center mb-3 flex-shrink-0">
            <div className="relative inline-block">
              {/* Name skeleton matching text-3xl sm:text-4xl height */}
              <div className="h-9 sm:h-10 w-40 sm:w-48 bg-gradient-to-r from-purple-200 to-pink-200 dark:from-purple-700 dark:to-pink-700 rounded-lg animate-pulse mx-auto" />
              
              {/* Info icon skeleton */}
              <div className="absolute -right-10 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 animate-pulse" />
            </div>
          </div>

          {/* CircularStatusIndicators skeleton - Fixed height */}
          <div className="flex-shrink-0 mb-3">
            <div className="flex items-center justify-center gap-4 sm:gap-6">
              {/* 4 circular stat ring skeletons */}
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  {/* Circular ring skeleton matching w-12 h-12 sm:w-14 sm:h-14 */}
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-purple-200 to-pink-200 dark:from-purple-700 dark:to-pink-700 animate-pulse" />
                  
                  {/* Label skeleton */}
                  <div className="h-2 w-10 sm:w-12 bg-purple-100 dark:bg-purple-800 rounded animate-pulse mt-0.5" />
                </div>
              ))}
            </div>
          </div>

          {/* Blobbi Visual skeleton - Takes remaining vertical space */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-[220px] gap-4">
            {/* Main Blobbi visual placeholder - matches default size */}
            <div className="mx-auto aspect-square max-w-full w-[220px] sm:w-[260px]">
              {/* Blob-shaped placeholder with soft rounded edges */}
              <div className="w-full h-full rounded-[40%] bg-gradient-to-br from-purple-200 via-pink-200 to-purple-300 dark:from-purple-700 dark:via-pink-700 dark:to-purple-800 animate-pulse relative overflow-hidden">
                {/* Inner highlight for depth */}
                <div className="absolute inset-[20%] rounded-[40%] bg-white/20 dark:bg-white/10" />
                <div className="absolute inset-[40%] rounded-[40%] bg-white/10 dark:bg-white/5" />
              </div>
            </div>
            
            {/* Loading text */}
            <div className="text-center">
              <p className="text-sm text-purple-600 dark:text-purple-400 animate-pulse">
                Loading your Blobbi...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
