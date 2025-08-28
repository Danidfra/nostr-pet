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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/useToast';
import { useRelayContext } from '@/contexts/RelayContext';
import { useIsMobile } from '@/hooks/useIsMobile';
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
  const isMobile = useIsMobile();
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
      <DialogContent className={`
        ${isMobile
          ? 'w-[calc(100vw-2rem)] max-w-none h-[calc(100vh-2rem)] max-h-none'
          : 'w-[calc(100vw-2rem)] max-w-5xl max-h-[85vh]'
        }
        flex flex-col overflow-hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm
        border border-purple-200/50 dark:border-purple-600/50
        ${isMobile ? 'rounded-lg' : 'rounded-2xl'}
      `}>
        <DialogHeader className={`${isMobile ? 'pb-2' : 'pb-4'}`}>
          <DialogTitle className={`flex items-center gap-2 ${isMobile ? 'text-lg' : 'text-xl'} font-semibold text-gray-900 dark:text-gray-100`}>
            <div className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} rounded-full bg-gradient-to-r from-gray-500 to-slate-500 flex items-center justify-center`}>
              <Settings className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} text-white`} />
            </div>
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="relays" className="w-full flex flex-col min-h-0">
          <div className={`${isMobile ? 'mb-3' : 'mb-6'}`}>
            <TabsList className="grid w-full grid-cols-1 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-1 rounded-xl border border-purple-200/50 dark:border-purple-600/50">
              <TabsTrigger
                value="relays"
                className={`flex items-center gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200 ${isMobile ? 'text-sm py-2' : ''}`}
              >
                <Globe className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
                Relay Management
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="relays" className={`flex-1 min-h-0 ${isMobile ? 'space-y-3' : 'space-y-4'}`}>
            <ScrollArea className={`${isMobile ? 'h-[calc(100vh-16rem)]' : 'h-[350px]'} ${isMobile ? 'pr-1' : 'pr-2'}`}>
            {/* Relay Overview */}
            <Card className={`bg-white/80 mb-4 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 ${isMobile ? 'rounded-lg' : 'rounded-xl'}`}>
              <CardHeader className={isMobile ? 'pb-3' : ''}>
                <CardTitle className={`flex items-center justify-between text-gray-900 dark:text-gray-100 ${isMobile ? 'text-base' : ''}`}>
                  <span className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} rounded-full bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 flex items-center justify-center flex-shrink-0`}>
                      <Wifi className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} text-green-600`} />
                    </div>
                    <span className={`${isMobile ? 'text-sm' : ''} truncate`}>Relay Status</span>
                  </span>
                  <Badge
                    variant={connectedCount > 0 ? 'default' : 'destructive'}
                    className={`${connectedCount > 0
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700'
                      : ''
                    } ${isMobile ? 'text-xs px-2 py-1' : ''} flex-shrink-0`}
                  >
                    {connectedCount}/{totalCount} Connected
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className={isMobile ? 'pt-0' : ''}>
                <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600 dark:text-gray-400`}>
                  Relays are servers that store and distribute your Nostr events.
                  Connect to multiple relays for better reliability and reach.
                </p>
              </CardContent>
            </Card>

            {/* Add New Relay */}
            <Card className={`bg-white/80 mb-4 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 ${isMobile ? 'rounded-lg' : 'rounded-xl'}`}>
              <CardHeader className={isMobile ? 'pb-3' : ''}>
                <CardTitle className={`flex items-center gap-2 text-gray-900 dark:text-gray-100 ${isMobile ? 'text-base' : ''}`}>
                  <div className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} rounded-full bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 flex items-center justify-center flex-shrink-0`}>
                    <Plus className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} text-blue-600`} />
                  </div>
                  <span className={isMobile ? 'text-sm' : ''}>Add New Relay</span>
                </CardTitle>
              </CardHeader>
              <CardContent className={`${isMobile ? 'space-y-3 pt-0' : 'space-y-4'}`}>
                <div className={`${isMobile ? 'flex flex-col gap-3' : 'flex gap-3'}`}>
                  <div className="flex-1">
                    <Label htmlFor="new-relay" className={`text-gray-700 dark:text-gray-300 ${isMobile ? 'text-sm' : ''}`}>Relay URL</Label>
                    <Input
                      id="new-relay"
                      placeholder="wss://relay.example.com"
                      value={newRelayUrl}
                      onChange={(e) => setNewRelayUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddRelay()}
                      className={`mt-1 border-purple-200 dark:border-purple-600 focus:border-purple-400 focus:ring-purple-400/50 ${isMobile ? 'text-sm' : ''}`}
                    />
                  </div>
                  <div className={`flex ${isMobile ? 'justify-stretch' : 'items-end'}`}>
                    <Button
                      onClick={handleAddRelay}
                      disabled={!newRelayUrl.trim()}
                      className={`bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-0 ${isMobile ? 'w-full' : ''}`}
                      size={isMobile ? 'sm' : 'default'}
                    >
                      <Plus className={`${isMobile ? 'w-3 h-3 mr-1' : 'w-4 h-4 mr-2'}`} />
                      Add
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Relay List */}
            <Card className={`bg-white/80 mb-4 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 ${isMobile ? 'rounded-lg' : 'rounded-xl'}`}>
              <CardHeader className={isMobile ? 'pb-3' : ''}>
                <CardTitle className={`text-gray-900 dark:text-gray-100 ${isMobile ? 'text-base' : ''}`}>Connected Relays</CardTitle>
              </CardHeader>
              <CardContent className={isMobile ? 'pt-0' : ''}>
                {isLoading ? (
                  <div className={isMobile ? 'space-y-2' : 'space-y-3'}>
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className={`${isMobile ? 'h-12' : 'h-16'} bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 ${isMobile ? 'rounded-lg' : 'rounded-xl'}`}></div>
                      </div>
                    ))}
                  </div>
                ) : relays.length === 0 ? (
                  <div className={`text-center ${isMobile ? 'py-8' : 'py-12'}`}>
                    <div className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center`}>
                      <Globe className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} text-gray-400`} />
                    </div>
                    <p className={`text-gray-600 dark:text-gray-400 ${isMobile ? 'text-sm' : ''}`}>No relays configured. Add a relay to get started.</p>
                  </div>
                ) : (
                  <div className={isMobile ? 'space-y-2' : 'space-y-3'}>
                    {relays.map((relay) => (
                      <div
                        key={relay.url}
                        className={`flex items-center justify-between ${isMobile ? 'p-3' : 'p-4'} border border-purple-200/50 dark:border-purple-600/50 ${isMobile ? 'rounded-lg' : 'rounded-xl'} bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 hover:shadow-md transition-all duration-200`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="flex-shrink-0">
                            {getStatusIcon(relay)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`flex items-center gap-2 ${isMobile ? 'flex-col items-start' : ''}`}>
                              <p className={`font-medium text-gray-900 dark:text-gray-100 ${isMobile ? 'text-sm max-w-[160px] truncate overflow-hidden' : ''}`}>{relay.url}</p>
                              <Badge
                                variant={relay.connected ? 'default' : 'secondary'}
                                className={`${isMobile ? 'text-xs px-1 py-0' : 'text-xs'} ${
                                  relay.connected
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                } ${isMobile ? 'self-start' : ''}`}
                              >
                                {getStatusText(relay)}
                              </Badge>
                            </div>
                            <div className={`flex items-center gap-2 ${isMobile ? 'text-xs' : 'text-xs'} text-gray-500 dark:text-gray-400 mt-1 ${isMobile ? 'flex-wrap' : 'gap-4'}`}>
                              <span>Last: {formatLastConnected(relay.lastConnected)}</span>
                              {relay.messageCount !== undefined && (
                                <span>Messages: {relay.messageCount}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className={`flex items-center ${isMobile ? 'gap-2 flex-col' : 'gap-3'}`}>
                          <Switch
                            checked={relay.enabled}
                            onCheckedChange={(enabled) => handleToggleRelay(relay.url, enabled)}
                            disabled={relay.status === 'connecting'}
                            className={isMobile ? 'scale-90' : ''}
                          />
                          <Button
                            variant="ghost"
                            size={isMobile ? 'sm' : 'sm'}
                            onClick={() => handleRemoveRelay(relay.url)}
                            className={`text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 ${isMobile ? 'h-6 w-6 p-0' : ''}`}
                          >
                            <Trash2 className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 ${isMobile ? 'rounded-lg' : 'rounded-xl'}`}>
              <CardHeader className={isMobile ? 'pb-3' : ''}>
                <CardTitle className={`text-gray-900 dark:text-gray-100 ${isMobile ? 'text-base' : ''}`}>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className={`${isMobile ? 'space-y-2 pt-0' : 'space-y-3'}`}>
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
                  className={`w-full border-purple-200 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-900 dark:text-gray-100 ${isMobile ? 'text-sm h-9' : ''}`}
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
                  className={`w-full border-purple-200 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-900 dark:text-gray-100 ${isMobile ? 'text-sm h-9' : ''}`}
                  disabled={isLoading || relays.every(r => r.connected)}
                >
                  {isLoading ? 'Connecting...' : 'Connect All Relays'}
                </Button>
              </CardContent>
            </Card>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className={`border-t border-purple-200/50 dark:border-purple-600/50 ${isMobile ? 'pt-3' : 'pt-6'} flex-shrink-0`}>
          <div className="flex justify-end">
            <Button
              onClick={onClose}
              className={`bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 ${isMobile ? 'w-full text-sm h-9' : ''}`}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}