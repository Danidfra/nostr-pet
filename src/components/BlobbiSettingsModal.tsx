
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Blobbi Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="status">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
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
