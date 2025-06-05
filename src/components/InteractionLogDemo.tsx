/**
 * Interaction Log Demo Component
 * 
 * A simple component to demonstrate and test the interaction logging system.
 * This can be temporarily added to any page to verify logging functionality.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BlobbiAction, BlobbiLifeStage } from '@/types/blobbi';
import { 
  logInteractionTriggered,
  logInteractionBlockedByCooldown,
  logInteractionBlockedUnavailable,
  logInteractionError,
  logCooldownSystemInit,
  logCooldownSync,
  InteractionLogger
} from '@/lib/interaction-logger';

export function InteractionLogDemo() {
  const [verboseMode, setVerboseMode] = React.useState(InteractionLogger.isVerbose());
  
  const demoActions: BlobbiAction[] = ['feed', 'play', 'clean', 'rest', 'warm', 'check', 'sing', 'talk', 'medicine', 'cruzar'];
  const demoStages: BlobbiLifeStage[] = ['egg', 'baby', 'adult'];
  const demoBlobbiId = 'demo-blobbi-12345';

  const handleToggleVerbose = () => {
    const newMode = !verboseMode;
    setVerboseMode(newMode);
    InteractionLogger.setVerbose(newMode);
  };

  const handleLogTriggered = (action: BlobbiAction, stage: BlobbiLifeStage) => {
    logInteractionTriggered(action, demoBlobbiId, stage, {
      statChanges: { hunger: 25, happiness: 15 },
      experienceGained: 10,
      itemUsed: 'premium_food',
      previousStats: { hunger: 45, happiness: 60, energy: 80, hygiene: 70, health: 90 },
      newStats: { hunger: 70, happiness: 75, energy: 80, hygiene: 70, health: 90 }
    });
  };

  const handleLogBlockedCooldown = (action: BlobbiAction, stage: BlobbiLifeStage) => {
    const cooldownTimes = [
      5 * 60 * 1000,    // 5 minutes
      30 * 60 * 1000,   // 30 minutes
      2 * 60 * 60 * 1000, // 2 hours
      24 * 60 * 60 * 1000 // 24 hours
    ];
    const randomCooldown = cooldownTimes[Math.floor(Math.random() * cooldownTimes.length)];
    logInteractionBlockedByCooldown(action, demoBlobbiId, stage, randomCooldown);
  };

  const handleLogBlockedUnavailable = (action: BlobbiAction, stage: BlobbiLifeStage) => {
    logInteractionBlockedUnavailable(action, demoBlobbiId, stage);
  };

  const handleLogError = (action: BlobbiAction, stage: BlobbiLifeStage) => {
    const errors = [
      'Network connection failed',
      'Insufficient coins',
      'Blobbi is sleeping',
      'Invalid item selected',
      'Server timeout'
    ];
    const randomError = errors[Math.floor(Math.random() * errors.length)];
    logInteractionError(action, demoBlobbiId, stage, randomError);
  };

  const handleLogSystemInit = () => {
    logCooldownSystemInit(demoBlobbiId);
  };

  const handleLogSync = () => {
    const syncedActions = ['feed', 'play', 'clean'];
    const sources: ('relay' | 'local')[] = ['relay', 'local'];
    const randomSource = sources[Math.floor(Math.random() * sources.length)];
    logCooldownSync(demoBlobbiId, syncedActions, randomSource);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          🎮 Interaction Logging Demo
          <div className="flex items-center gap-2">
            <Badge variant={verboseMode ? 'default' : 'secondary'}>
              {verboseMode ? 'Verbose ON' : 'Verbose OFF'}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleVerbose}
            >
              Toggle Verbose
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* System Controls */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">System Controls</h3>
          <div className="flex gap-2">
            <Button onClick={handleLogSystemInit} variant="outline">
              🔧 Log System Init
            </Button>
            <Button onClick={handleLogSync} variant="outline">
              🔄 Log Cooldown Sync
            </Button>
          </div>
        </div>

        {/* Interaction Types */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Test Interaction Logging</h3>
          <p className="text-sm text-muted-foreground">
            Click any button below to generate a demo log entry. Check the browser console to see the formatted output.
          </p>
          
          {demoStages.map(stage => (
            <div key={stage} className="space-y-3">
              <h4 className="font-medium capitalize">{stage} Stage</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {demoActions.map(action => (
                  <div key={`${stage}-${action}`} className="space-y-1">
                    <div className="text-xs font-medium text-center capitalize">{action}</div>
                    <div className="grid grid-cols-2 gap-1">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleLogTriggered(action, stage)}
                        className="text-xs h-8"
                      >
                        ✅ Success
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleLogBlockedCooldown(action, stage)}
                        className="text-xs h-8"
                      >
                        ⏱️ Cooldown
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLogBlockedUnavailable(action, stage)}
                        className="text-xs h-8"
                      >
                        🚫 Unavailable
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleLogError(action, stage)}
                        className="text-xs h-8"
                      >
                        ❌ Error
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Instructions */}
        <div className="space-y-2 p-4 bg-muted rounded-lg">
          <h3 className="font-semibold">How to Use</h3>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>Open your browser's Developer Tools (F12)</li>
            <li>Go to the Console tab</li>
            <li>Click any button above to generate log entries</li>
            <li>Observe the detailed, formatted console output</li>
            <li>Each log includes: action name, Blobbi ID, stage, timestamp, and interaction type</li>
            <li>Successful interactions show stat changes and experience gained</li>
            <li>Blocked interactions show cooldown times or unavailability reasons</li>
          </ul>
        </div>

        {/* Current Demo Settings */}
        <div className="space-y-2 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold">Demo Settings</h3>
          <div className="text-sm space-y-1">
            <div><strong>Demo Blobbi ID:</strong> {demoBlobbiId}</div>
            <div><strong>Verbose Logging:</strong> {verboseMode ? 'Enabled' : 'Disabled'}</div>
            <div><strong>Available Actions:</strong> {demoActions.join(', ')}</div>
            <div><strong>Available Stages:</strong> {demoStages.join(', ')}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}