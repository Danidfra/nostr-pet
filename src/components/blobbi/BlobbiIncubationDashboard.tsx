import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  CheckCircle, 
  Circle, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight,
  Info,
  Egg,
  Sparkles,
  Clock,
  Users
} from 'lucide-react';
import { useBlobbiIncubationSystem } from '@/hooks/useBlobbiIncubationSystem';

interface BlobbiIncubationDashboardProps {
  className?: string;
}

export function BlobbiIncubationDashboard({ className }: BlobbiIncubationDashboardProps) {
  const {
    blobbis,
    isLoadingBlobbis,
    blobbiError,
    eggTasks,
    evolutionTasks,
    progress,
    isReadyToHatch,
    isReadyToEvolve,
    metadataSubscriptionActive,
    taskSubscriptionActive,
    isListening,
    refetchMetadata,
    debugInfo,
  } = useBlobbiIncubationSystem();

  const [showEggTasks, setShowEggTasks] = React.useState(true);
  const [showEvolutionTasks, setShowEvolutionTasks] = React.useState(false);
  const [showDebugInfo, setShowDebugInfo] = React.useState(false);

  // Show loading state
  if (isLoadingBlobbis) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading Blobbi Incubation System...
          </CardTitle>
          <CardDescription>
            Fetching your Blobbi metadata and setting up task tracking...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Show error state
  if (blobbiError) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Circle className="h-5 w-5" />
            Error Loading Blobbi System
          </CardTitle>
          <CardDescription>
            {blobbiError.message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={refetchMetadata} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show no Blobbis state
  if (blobbis.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Egg className="h-5 w-5" />
            No Blobbis Found
          </CardTitle>
          <CardDescription>
            You don't have any Blobbis yet. Adopt one to start the incubation process!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="text-sm text-blue-600 dark:text-blue-300 space-y-1">
              <div>📡 Metadata Subscription: {metadataSubscriptionActive ? '✅ Active' : '❌ Inactive'}</div>
              <div>🎯 Task Subscription: {taskSubscriptionActive ? '✅ Active' : '❌ Inactive'}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Blobbi Incubation System
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={metadataSubscriptionActive ? 'default' : 'secondary'} className="flex items-center gap-1">
                {metadataSubscriptionActive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                Metadata
              </Badge>
              <Badge variant={taskSubscriptionActive ? 'default' : 'secondary'} className="flex items-center gap-1">
                {taskSubscriptionActive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                Tasks
              </Badge>
              <Button size="sm" variant="outline" onClick={refetchMetadata}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Tracking {blobbis.length} Blobbi{blobbis.length !== 1 ? 's' : ''} with persistent Nostr subscriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {blobbis.map((blobbi) => (
              <div key={blobbi.id} className="p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-sm font-medium">{blobbi.name}</div>
                  <Badge variant="outline" className="text-xs">
                    {blobbi.lifeStage}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Born: {new Date(blobbi.birthTime).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Egg Hatching Progress */}
      <Card>
        <Collapsible open={showEggTasks} onOpenChange={setShowEggTasks}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {showEggTasks ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Egg className="h-5 w-5" />
                  Egg Hatching Progress
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {progress.egg.completed}/{progress.egg.total}
                  </Badge>
                  {isReadyToHatch && (
                    <Badge variant="default" className="bg-green-600">
                      Ready to Hatch!
                    </Badge>
                  )}
                </div>
              </CardTitle>
              <CardDescription>
                Complete these 4 Nostr interactions to hatch your egg
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{progress.egg.completed}/{progress.egg.total} tasks</span>
                </div>
                <Progress value={progress.egg.percentage} className="h-2" />
              </div>

              {/* Task List */}
              <div className="space-y-3">
                {eggTasks.map((task, index) => (
                  <div
                    key={task.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      task.completed
                        ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                        : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <div className="mt-0.5">
                      {task.completed ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-medium ${task.completed ? 'text-green-800 dark:text-green-200' : ''}`}>
                          {task.name}
                        </h4>
                        {task.completed && (
                          <Badge variant="secondary" className="text-xs">
                            Completed
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {task.description}
                      </p>
                      {task.completed && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          ✅ Task confirmed on Nostr
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Evolution Progress */}
      <Card>
        <Collapsible open={showEvolutionTasks} onOpenChange={setShowEvolutionTasks}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {showEvolutionTasks ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Sparkles className="h-5 w-5" />
                  Evolution Progress
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {progress.evolution.completed}/{progress.evolution.total}
                  </Badge>
                  {isReadyToEvolve && (
                    <Badge variant="default" className="bg-purple-600">
                      Ready to Evolve!
                    </Badge>
                  )}
                </div>
              </CardTitle>
              <CardDescription>
                Complete these 14 Nostr interactions to evolve to adult
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{progress.evolution.completed}/{progress.evolution.total} tasks</span>
                </div>
                <Progress value={progress.evolution.percentage} className="h-2" />
              </div>

              {/* Task List */}
              <div className="space-y-3">
                {evolutionTasks.map((task, index) => (
                  <div
                    key={task.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      task.completed
                        ? 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800'
                        : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <div className="mt-0.5">
                      {task.completed ? (
                        <CheckCircle className="h-5 w-5 text-purple-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-medium ${task.completed ? 'text-purple-800 dark:text-purple-200' : ''}`}>
                          {task.name}
                        </h4>
                        {task.completed && (
                          <Badge variant="secondary" className="text-xs">
                            Completed
                          </Badge>
                        )}
                        {'progress' in task && task.target && (
                          <Badge variant="outline" className="text-xs">
                            {task.progress || 0}/{task.target}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {task.description}
                      </p>
                      {task.completed && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                          ✅ Task confirmed on Nostr
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Debug Information */}
      <Card>
        <Collapsible open={showDebugInfo} onOpenChange={setShowDebugInfo}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900">
              <CardTitle className="flex items-center gap-2 text-sm">
                {showDebugInfo ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Info className="h-4 w-4" />
                Debug Information
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Subscription Status */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Subscription Status</h4>
                <div className="text-sm text-blue-600 dark:text-blue-300 space-y-1">
                  <div>📡 Metadata (kind:31124): {debugInfo.subscriptionStatus.metadata ? '✅ Active' : '❌ Inactive'}</div>
                  <div>🎯 Tasks (kinds:[1,3,6,7,9735]): {debugInfo.subscriptionStatus.tasks ? '✅ Active' : '❌ Inactive'}</div>
                  <div>🔊 Listening: {isListening ? '✅ Yes' : '❌ No'}</div>
                </div>
              </div>

              {/* Timing Information */}
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">Timing Information</h4>
                <div className="text-sm text-green-600 dark:text-green-300 space-y-1">
                  <div>🕐 Blobbi Creation: {debugInfo.blobbiCreationDate}</div>
                  <div>📅 Last Event: {debugInfo.lastEventDate || 'None'}</div>
                  <div>👤 User: {debugInfo.userPubkey?.slice(0, 8)}...{debugInfo.userPubkey?.slice(-8)}</div>
                </div>
              </div>

              {/* Statistics */}
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Statistics</h4>
                <div className="text-sm text-yellow-600 dark:text-yellow-300 space-y-1">
                  <div>👥 Unique Likers: {debugInfo.uniqueLikersCount}</div>
                  <div>🎭 Blobbis Tracked: {blobbis.length}</div>
                  <div>📊 Egg Progress: {progress.egg.percentage.toFixed(1)}%</div>
                  <div>🧬 Evolution Progress: {progress.evolution.percentage.toFixed(1)}%</div>
                </div>
              </div>

              {/* System Information */}
              <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">System Information</h4>
                <div className="text-sm text-purple-600 dark:text-purple-300 space-y-1">
                  <div>🔄 Implementation: Single REQ + Persistent Subscriptions</div>
                  <div>📡 Filter: kinds:[1,3,6,7,9735], authors:[user], #p:[user]</div>
                  <div>⚡ Real-time: Event processing as they arrive</div>
                  <div>🚫 No REQ+CLOSE cycles: Connections remain open</div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Recommended Clients */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Recommended Nostr Clients
          </CardTitle>
          <CardDescription>
            Use these clients to complete your interaction tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="https://ditto.pub"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <h4 className="font-semibold">Ditto</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">ditto.pub</p>
            </a>
            <a
              href="https://gleasonator.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <h4 className="font-semibold">Gleasonator</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">gleasonator.dev</p>
            </a>
            <a
              href="https://cobrafuma.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <h4 className="font-semibold">Cobrafuma</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">cobrafuma.com</p>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}