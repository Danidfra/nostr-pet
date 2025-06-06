import React, { useState, useEffect } from 'react';
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
  Users,
  ExternalLink,
  ArrowRight,
  Target,
  Zap
} from 'lucide-react';
import { useBlobbiIncubationSystem } from '@/hooks/useBlobbiIncubationSystem';
import { EggGraphic } from './EggGraphic';
import { BlobbiVisual } from './BlobbiVisual';
import { BlobbiEvolvedVisual } from './BlobbiEvolvedVisual';
import { formatDistanceToNow } from 'date-fns';

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
    isBlobbiReadyToHatch,
    metadataSubscriptionActive,
    taskSubscriptionActive,
    isListening,
    selectedEggId,
    incubationStartTime,
    selectEgg,
    startIncubation,
    stopIncubation,
    hatchBlobbi,
    refetchMetadata,
    debugInfo,
  } = useBlobbiIncubationSystem();

  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [showEggList, setShowEggList] = useState(true);
  const [showEvolvedList, setShowEvolvedList] = useState(true);

  // Filter eggs and evolved blobbis
  const eggBlobbis = blobbis.filter(blobbi => blobbi.lifeStage === 'egg');
  const evolvedBlobbis = blobbis.filter(blobbi => blobbi.lifeStage !== 'egg');
  const selectedBlobbi = selectedEggId ? blobbis.find(b => b.id === selectedEggId) : null;

  // Clear selection when relevant section is collapsed
  useEffect(() => {
    if (selectedBlobbi) {
      if (selectedBlobbi.lifeStage === 'egg' && !showEggList) {
        selectEgg(null);
      } else if (selectedBlobbi.lifeStage !== 'egg' && !showEvolvedList) {
        selectEgg(null);
      }
    }
  }, [showEggList, showEvolvedList, selectedBlobbi, selectEgg]);

  // Show loading state
  if (isLoadingBlobbis) {
    return (
      <Card className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <RefreshCw className="h-5 w-5 animate-spin text-purple-500" />
            Loading Blobbi Incubation System...
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300">
            Fetching your Blobbi metadata and setting up task tracking...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Show error state
  if (blobbiError) {
    return (
      <Card className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <Circle className="h-5 w-5" />
            Error Loading Blobbi System
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300">
            {blobbiError.message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={refetchMetadata} 
            variant="outline"
            className="border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
          >
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
      <Card className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Egg className="h-5 w-5 text-yellow-500" />
            No Blobbis Found
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300">
            You don't have any Blobbis yet. Adopt one to start the incubation process!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-purple-50/50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-600">
            <div className="text-sm text-purple-600 dark:text-purple-300 space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${metadataSubscriptionActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>Metadata Subscription: {metadataSubscriptionActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${taskSubscriptionActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>Task Subscription: {taskSubscriptionActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* System Status */}
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Blobbi Incubation System
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                variant={metadataSubscriptionActive ? 'default' : 'secondary'} 
                className={`flex items-center gap-1 ${
                  metadataSubscriptionActive 
                    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {metadataSubscriptionActive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                Metadata
              </Badge>
              <Badge 
                variant={taskSubscriptionActive ? 'default' : 'secondary'} 
                className={`flex items-center gap-1 ${
                  taskSubscriptionActive 
                    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {taskSubscriptionActive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                Tasks
              </Badge>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={refetchMetadata}
                className="border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300">
            Tracking {blobbis.length} Blobbi{blobbis.length !== 1 ? 's' : ''} with persistent Nostr subscriptions
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Eggs Section */}
      {eggBlobbis.length > 0 && (
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
          <Collapsible open={showEggList} onOpenChange={setShowEggList}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-colors">
                <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                  <div className="flex items-center gap-2">
                    <Egg className="h-5 w-5 text-yellow-500" />
                    Incubating Eggs ({eggBlobbis.length})
                    {!showEggList && eggBlobbis.some(blobbi => isBlobbiReadyToHatch(blobbi)) && (
                      <Button 
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white text-xs"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent collapsible toggle
                          // Find the first ready-to-hatch egg and hatch it
                          const readyEgg = eggBlobbis.find(blobbi => isBlobbiReadyToHatch(blobbi));
                          if (readyEgg) {
                            hatchBlobbi(readyEgg.id);
                          }
                        }}
                      >
                        <Zap className="w-3 h-3 mr-1" />
                        Hatch Ready Egg
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {showEggList ? (
                      <ChevronDown className="h-4 w-4 text-purple-500 transition-transform duration-200" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-purple-500 transition-transform duration-200" />
                    )}
                  </div>
                </CardTitle>
                {showEggList && (
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    Click on an egg to view its detailed incubation progress
                  </CardDescription>
                )}
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {eggBlobbis.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                    <Egg className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>No eggs are currently incubating.</p>
                    <p className="text-sm mt-2">Adopt a new Blobbi to start the incubation process!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {eggBlobbis.map((blobbi) => (
                      <div
                        key={blobbi.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-105 ${
                          selectedEggId === blobbi.id
                            ? 'border-purple-400 dark:border-purple-500 bg-purple-50/50 dark:bg-purple-900/20 shadow-md scale-105 ring-2 ring-purple-200 dark:ring-purple-600'
                            : 'border-purple-200 dark:border-purple-600 bg-white/60 dark:bg-gray-700/60 hover:border-purple-300 dark:hover:border-purple-500'
                        }`}
                        onClick={() => selectEgg(selectedEggId === blobbi.id ? null : blobbi.id)}
                      >
                        <div className="flex flex-col items-center space-y-3">
                          <div className="relative">
                            <EggGraphic 
                              blobbi={blobbi} // Pass the full blobbi object for unique characteristics
                              size="medium" 
                              animated={true}
                              warmth={blobbi.eggTemperature || (60 + (progress.egg.percentage * 0.4))} // Use blobbi's specific temperature or fallback
                            />
                            {selectedEggId === blobbi.id && (
                              <div className="absolute -top-1 -right-1">
                                <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse">
                                  <div className="absolute inset-0 w-3 h-3 bg-purple-400 rounded-full animate-ping"></div>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="text-center space-y-1">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">{blobbi.name}</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Incubating for {formatDistanceToNow(blobbi.birthTime)}
                            </p>
                          </div>

                          <div className="w-full space-y-2">
                            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                              <span>Hatching Progress</span>
                              <span>{progress.egg.completed}/{progress.egg.total}</span>
                            </div>
                            <Progress value={progress.egg.percentage} className="h-2" />
                            {isBlobbiReadyToHatch(blobbi) ? (
                              <Button 
                                className="w-full bg-green-600 hover:bg-green-700 text-white"
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent card selection when clicking button
                                  hatchBlobbi(blobbi.id);
                                }}
                              >
                                <Zap className="w-3 h-3 mr-1" />
                                Hatch {blobbi.name}
                              </Button>
                            ) : (
                              <Badge className="w-full justify-center bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                <Clock className="w-3 h-3 mr-1" />
                                Incubating...
                              </Badge>
                            )}
                          </div>

                          {selectedEggId === blobbi.id && (
                            <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                              <ArrowRight className="w-3 h-3" />
                              <span>View details below</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Helpful message when no egg is selected */}
      {eggBlobbis.length > 0 && showEggList && !selectedBlobbi && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-600">
          <CardContent className="py-8 text-center">
            <Target className="w-8 h-8 mx-auto mb-3 text-purple-500" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Select an Egg to View Progress
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Click on any egg above to see its detailed incubation progress and required tasks.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Selected Egg Details */}
      {selectedBlobbi && selectedBlobbi.lifeStage === 'egg' && showEggList && (
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-400 dark:border-purple-500 shadow-lg animate-in slide-in-from-top-4 duration-500">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-500" />
                {selectedBlobbi.name} - Hatching Progress
              </div>
              {!taskSubscriptionActive && !incubationStartTime && (
                <Button 
                  onClick={startIncubation}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Egg className="w-4 h-4 mr-2" />
                  Start Incubation
                </Button>
              )}
              {taskSubscriptionActive && (
                <Badge className="bg-green-600 text-white">
                  <Wifi className="w-3 h-3 mr-1" />
                  Listening for events...
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300">
              {!incubationStartTime 
                ? "Click 'Start Incubation' to begin tracking your Nostr interactions"
                : "Complete these 4 Nostr interactions to hatch your egg"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Progress</span>
                <span>{progress.egg.completed}/{progress.egg.total} tasks</span>
              </div>
              <Progress value={progress.egg.percentage} className="h-3" />
            </div>

            {/* Task List */}
            <div className="space-y-3">
              {eggTasks.map((task, index) => (
                <div
                  key={task.id}
                  className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                    task.completed
                      ? 'bg-green-50/80 dark:bg-green-950/50 border-green-200 dark:border-green-800'
                      : 'bg-gray-50/80 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
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
                      <h4 className={`font-medium ${task.completed ? 'text-green-800 dark:text-green-200' : 'text-gray-900 dark:text-gray-100'}`}>
                        {task.name}
                      </h4>
                      {task.completed && (
                        <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                          Completed
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {task.description}
                    </p>
                    {task.completed && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Task confirmed on Nostr
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evolved Blobbis Section */}
      {evolvedBlobbis.length > 0 && (
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
          <Collapsible open={showEvolvedList} onOpenChange={setShowEvolvedList}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-colors">
                <CardTitle className="flex items-center justify-between text-gray-900 dark:text-gray-100">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    Evolved Blobbis ({evolvedBlobbis.length})
                    {!showEvolvedList && isReadyToEvolve && (
                      <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-xs">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Ready!
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {showEvolvedList ? (
                      <ChevronDown className="h-4 w-4 text-purple-500 transition-transform duration-200" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-purple-500 transition-transform duration-200" />
                    )}
                  </div>
                </CardTitle>
                {showEvolvedList && (
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    Click on a Blobbi to view its evolution progress
                  </CardDescription>
                )}
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {evolvedBlobbis.map((blobbi) => (
                    <div
                      key={blobbi.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-105 ${
                        selectedEggId === blobbi.id
                          ? 'border-purple-400 dark:border-purple-500 bg-purple-50/50 dark:bg-purple-900/20 shadow-md scale-105 ring-2 ring-purple-200 dark:ring-purple-600'
                          : 'border-purple-200 dark:border-purple-600 bg-white/60 dark:bg-gray-700/60 hover:border-purple-300 dark:hover:border-purple-500'
                      }`}
                      onClick={() => selectEgg(selectedEggId === blobbi.id ? null : blobbi.id)}
                    >
                      <div className="flex flex-col items-center space-y-3">
                        <div className="relative">
                          {blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi' ? (
                            <BlobbiEvolvedVisual blobbi={blobbi} size="medium" />
                          ) : (
                            <BlobbiVisual blobbi={blobbi} size="medium" />
                          )}
                          {selectedEggId === blobbi.id && (
                            <div className="absolute -top-1 -right-1">
                              <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse">
                                <div className="absolute inset-0 w-3 h-3 bg-purple-400 rounded-full animate-ping"></div>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="text-center space-y-1">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">{blobbi.name}</h4>
                          <Badge variant="outline" className="text-xs border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300">
                            {blobbi.lifeStage}
                          </Badge>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Born {formatDistanceToNow(blobbi.birthTime, { addSuffix: true })}
                          </p>
                        </div>

                        <div className="w-full space-y-2">
                          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                            <span>Evolution Progress</span>
                            <span>{progress.evolution.completed}/{progress.evolution.total}</span>
                          </div>
                          <Progress value={progress.evolution.percentage} className="h-2" />
                          {isReadyToEvolve && (
                            <Badge className="w-full justify-center bg-purple-600 hover:bg-purple-700 text-white">
                              <Sparkles className="w-3 h-3 mr-1" />
                              Ready to Evolve!
                            </Badge>
                          )}
                        </div>

                        {selectedEggId === blobbi.id && (
                          <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                            <ArrowRight className="w-3 h-3" />
                            <span>View details below</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Helpful message when no evolved Blobbi is selected */}
      {evolvedBlobbis.length > 0 && showEvolvedList && (!selectedBlobbi || selectedBlobbi.lifeStage === 'egg') && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-600">
          <CardContent className="py-8 text-center">
            <Sparkles className="w-8 h-8 mx-auto mb-3 text-purple-500" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Select a Blobbi to View Evolution Progress
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Click on any evolved Blobbi above to see its detailed evolution progress and required tasks.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Selected Evolved Blobbi Details */}
      {selectedBlobbi && selectedBlobbi.lifeStage !== 'egg' && showEvolvedList && (
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-400 dark:border-purple-500 shadow-lg animate-in slide-in-from-top-4 duration-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {selectedBlobbi.name} - Evolution Progress
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300">
              Complete these 14 Nostr interactions to evolve to adult
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Progress</span>
                <span>{progress.evolution.completed}/{progress.evolution.total} tasks</span>
              </div>
              <Progress value={progress.evolution.percentage} className="h-3" />
            </div>

            {/* Task List */}
            <div className="space-y-3">
              {evolutionTasks.map((task, index) => (
                <div
                  key={task.id}
                  className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                    task.completed
                      ? 'bg-purple-50/80 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800'
                      : 'bg-gray-50/80 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
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
                      <h4 className={`font-medium ${task.completed ? 'text-purple-800 dark:text-purple-200' : 'text-gray-900 dark:text-gray-100'}`}>
                        {task.name}
                      </h4>
                      {task.completed && (
                        <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                          Completed
                        </Badge>
                      )}
                      {'progress' in task && task.target && (
                        <Badge variant="outline" className="text-xs border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300">
                          {task.progress || 0}/{task.target}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {task.description}
                    </p>
                    {task.completed && (
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Task confirmed on Nostr
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug Information */}
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
        <Collapsible open={showDebugInfo} onOpenChange={setShowDebugInfo}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-colors">
              <CardTitle className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                {showDebugInfo ? <ChevronDown className="h-4 w-4 text-purple-500" /> : <ChevronRight className="h-4 w-4 text-purple-500" />}
                <Info className="h-4 w-4 text-purple-500" />
                Debug Information
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Subscription Status */}
              <div className="p-4 bg-blue-50/80 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  Subscription Status
                </h4>
                <div className="text-sm text-blue-600 dark:text-blue-300 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${debugInfo.subscriptionStatus.metadata ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span>Metadata (kind:31124): {debugInfo.subscriptionStatus.metadata ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${debugInfo.subscriptionStatus.tasks ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span>Tasks (kinds:[0,1,3,6,7,9735] with #p + authors filters): {debugInfo.subscriptionStatus.tasks ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span>Listening: {isListening ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>

              {/* Timing Information */}
              <div className="p-4 bg-green-50/80 dark:bg-green-950/50 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="font-semibold text-green-800 dark:text-green-200 mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timing Information
                </h4>
                <div className="text-sm text-green-600 dark:text-green-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Blobbi Creation:</span>
                    <span className="font-mono text-xs">{debugInfo.blobbiCreationDate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Last Event:</span>
                    <span className="font-mono text-xs">{debugInfo.lastEventDate || 'None'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>User:</span>
                    <span className="font-mono text-xs">{debugInfo.userPubkey?.slice(0, 8)}...{debugInfo.userPubkey?.slice(-8)}</span>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="p-4 bg-yellow-50/80 dark:bg-yellow-950/50 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Statistics
                </h4>
                <div className="text-sm text-yellow-600 dark:text-yellow-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Unique Likers:</span>
                    <Badge variant="outline" className="border-yellow-200 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300">
                      {debugInfo.uniqueLikersCount}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Blobbis Tracked:</span>
                    <Badge variant="outline" className="border-yellow-200 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300">
                      {blobbis.length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Egg Progress:</span>
                    <Badge variant="outline" className="border-yellow-200 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300">
                      {progress.egg.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Evolution Progress:</span>
                    <Badge variant="outline" className="border-yellow-200 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300">
                      {progress.evolution.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </div>

              {/* System Information */}
              <div className="p-4 bg-purple-50/80 dark:bg-purple-950/50 rounded-lg border border-purple-200 dark:border-purple-800">
                <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  System Information
                </h4>
                <div className="text-sm text-purple-600 dark:text-purple-300 space-y-2">
                  <div>🔄 Implementation: Single REQ + Persistent Subscriptions</div>
                  <div>📡 Filters: kinds:[0,1,3,6,7,9735] with #p:[user] + authors:[user] (events mentioning user AND events authored by user)</div>
                  <div>⚡ Real-time: Event processing as they arrive</div>
                  <div>🚫 No REQ+CLOSE cycles: Connections remain open</div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Recommended Clients */}
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Users className="h-5 w-5 text-purple-500" />
            Recommended Nostr Clients
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300">
            Use these clients to complete your interaction tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="https://ditto.pub"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 border border-purple-200 dark:border-purple-600 rounded-lg hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-colors group"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Ditto</h4>
                <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-purple-500 transition-colors" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">ditto.pub</p>
            </a>
            <a
              href="https://gleasonator.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 border border-purple-200 dark:border-purple-600 rounded-lg hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-colors group"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Gleasonator</h4>
                <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-purple-500 transition-colors" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">gleasonator.dev</p>
            </a>
            <a
              href="https://cobrafuma.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 border border-purple-200 dark:border-purple-600 rounded-lg hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-colors group"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Cobrafuma</h4>
                <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-purple-500 transition-colors" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">cobrafuma.com</p>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}