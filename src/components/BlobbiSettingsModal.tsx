
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useAudio } from "@/contexts/AudioContext";
import { BlobbiStats } from "./blobbi/BlobbiStats";
import { useBlobbiWithFakeStatus } from "@/hooks/useBlobbiWithFakeStatus";

interface BlobbiSettingsModalProps {
  blobbiId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function BlobbiSettingsModal({ blobbiId, isOpen, onOpenChange }: BlobbiSettingsModalProps) {
  const { volume, isMuted, setVolume, setIsMuted } = useAudio();
  const { blobbi } = useBlobbiWithFakeStatus(undefined, blobbiId);

  if (!blobbi) {
    return null; // Or a loading state
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
              <span className="text-white text-sm">⚙️</span>
            </div>
            Blobbi Settings
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="status">
          <div className="mb-6">
            <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-1 rounded-xl border border-purple-200/50 dark:border-purple-600/50">
              <TabsTrigger
                value="status"
                className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
              >
                Status
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-600 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
              >
                Settings
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="status">
            <BlobbiStats blobbi={blobbi} />
          </TabsContent>
          <TabsContent value="settings">
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="volume" className="text-sm font-medium">Volume</Label>
                  <span className="text-sm text-muted-foreground font-mono">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
                <Slider
                  id="volume"
                  min={0}
                  max={100}
                  step={1}
                  value={[Math.round(volume * 100)]}
                  onValueChange={(value) => setVolume(value[0] / 100)}
                  disabled={isMuted}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="mute" className="text-sm font-medium">Mute Audio</Label>
                <Switch
                  id="mute"
                  checked={isMuted}
                  onCheckedChange={setIsMuted}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
