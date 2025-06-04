import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/useToast';
import { useRelayContext } from '@/contexts/RelayContext';
import { 
  Settings, 
  Wifi, 
  WifiOff, 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle,
  Globe,
  Zap
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { toast } = useToast();
  const { 
    relays, 
    isLoading, 
    toggleRelay, 
    addRelay, 
    removeRelay, 
    connectToAllEnabled, 
    addDefaultRelays 
  } = useRelayContext();
  const [newRelayUrl, setNewRelayUrl] = useState('');

  // No need for loadRelayInfo - relays come from context

  const handleToggleRelay = async (url: string, enabled: boolean) => {
    try {
      await toggleRelay(url, enabled);
      toast({
        title: enabled ? 'Relay enabled' : 'Relay disabled',
        description: `${enabled ? 'Enabled' : 'Disabled'} ${url}`,
      });
    } catch (error) {
      console.error('Failed to toggle relay:', error);
      toast({
        title: 'Error',
        description: `Failed to ${enabled ? 'enable' : 'disable'} relay`,
        variant: 'destructive',
      });
    }
  };

  const handleAddRelay = async () => {
    if (!newRelayUrl.trim()) return;

    try {
      const success = await addRelay(newRelayUrl.trim());
      setNewRelayUrl('');

      toast({
        title: 'Relay added',
        description: success 
          ? `Successfully connected to ${newRelayUrl}` 
          : `Added ${newRelayUrl} but connection failed`,
        variant: success ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Failed to add relay:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add relay',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveRelay = async (url: string) => {
    try {
      await removeRelay(url);
      
      toast({
        title: 'Relay removed',
        description: `Removed ${url} from your relay list`,
      });
    } catch (error) {
      console.error('Failed to remove relay:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove relay',
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (relay: { status: string }) => {
    switch (relay.status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'connecting':
        return <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <WifiOff className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = (relay: { status: string }) => {
    switch (relay.status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  const formatLastConnected = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const connectedCount = relays.filter(r => r.connected).length;
  const totalCount = relays.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="relays" className="w-full">
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
            <CardContent className="p-2">
              <TabsList className="grid w-full grid-cols-1 bg-purple-50/50 dark:bg-purple-900/20">
                <TabsTrigger 
                  value="relays" 
                  className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                >
                  <Globe className="w-4 h-4" />
                  Relay Management
                </TabsTrigger>
              </TabsList>
            </CardContent>
          </Card>

          <TabsContent value="relays" className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Relay Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Wifi className="w-5 h-5" />
                    Relay Status
                  </span>
                  <Badge variant={connectedCount > 0 ? 'default' : 'destructive'}>
                    {connectedCount}/{totalCount} Connected
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Relays are servers that store and distribute your Nostr events. 
                  Connect to multiple relays for better reliability and reach.
                </p>
              </CardContent>
            </Card>

            {/* Add New Relay */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Add New Relay
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="new-relay">Relay URL</Label>
                    <Input
                      id="new-relay"
                      placeholder="wss://relay.example.com"
                      value={newRelayUrl}
                      onChange={(e) => setNewRelayUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddRelay()}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAddRelay} disabled={!newRelayUrl.trim()}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Relay List */}
            <Card>
              <CardHeader>
                <CardTitle>Connected Relays</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-16 bg-muted rounded-lg"></div>
                      </div>
                    ))}
                  </div>
                ) : relays.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No relays configured. Add a relay to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {relays.map((relay) => (
                      <div
                        key={relay.url}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {getStatusIcon(relay)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{relay.url}</p>
                              <Badge 
                                variant={relay.connected ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {getStatusText(relay)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                              <span>Last: {formatLastConnected(relay.lastConnected)}</span>
                              {relay.messageCount !== undefined && (
                                <span>Messages: {relay.messageCount}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={relay.enabled}
                            onCheckedChange={(enabled) => handleToggleRelay(relay.url, enabled)}
                            disabled={relay.status === 'connecting'}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveRelay(relay.url)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const count = await addDefaultRelays();
                      toast({
                        title: 'Default relays added',
                        description: `Added ${count} popular relays`,
                      });
                    } catch (error) {
                      toast({
                        title: 'Info',
                        description: error instanceof Error ? error.message : 'All default relays are already added',
                      });
                    }
                  }}
                  className="w-full"
                >
                  Add Popular Relays
                </Button>
                
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await connectToAllEnabled();
                      toast({
                        title: 'Connecting to relays',
                        description: 'Attempting to connect to all enabled relays',
                      });
                    } catch (error) {
                      toast({
                        title: 'Error',
                        description: 'Failed to connect to some relays',
                        variant: 'destructive',
                      });
                    }
                  }}
                  className="w-full"
                  disabled={isLoading || relays.every(r => r.connected)}
                >
                  {isLoading ? 'Connecting...' : 'Connect All Relays'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Separator />
        
        <div className="flex justify-end">
          <Button onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}