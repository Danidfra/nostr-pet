import React, { useState } from 'react';
import { nip19 } from 'nostr-tools';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { subscribeToPush } from '@/lib/push';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface EnablePushModalProps {
  open: boolean;
  onClose: () => void;
}

export function EnablePushModal({ open, onClose }: EnablePushModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useCurrentUser();

  const handleEnableNow = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get npub from app state or localStorage fallback
      let npub: string | undefined;

      if (user?.pubkey) {
        // Convert hex pubkey to npub format
        try {
          npub = nip19.npubEncode(user.pubkey);
        } catch (error) {
          console.warn("Failed to encode pubkey to npub:", error);
        }
      }

      // Fallback to localStorage if no user pubkey or encoding failed
      if (!npub) {
        npub = localStorage.getItem("npub") || undefined;
      }

      // Validate npub format
      const isValidNpub = typeof npub === "string" && /^npub1[0-9a-z]+$/.test(npub);

      if (isValidNpub) {
        console.log("npub attached");
      } else {
        console.log("invalid npub, skipping");
        npub = undefined;
      }

      // Call subscribeToPush with appropriate parameters
      await subscribeToPush(
        npub,
        "web",
        import.meta.env.MODE === "development" ? "dev" : "prod"
      );

      // On success, set enabled flag and close modal
      localStorage.setItem("blobbiPushEnabledAt", new Date().toISOString());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enable notifications");
    } finally {
      setLoading(false);
    }
  };

  const handleDontAskAgain = () => {
    localStorage.setItem("blobbiPushDontAskAgain", "1");
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enable notifications?</DialogTitle>
          <DialogDescription>
            Turn on push so we can alert you when your Blobbies need attention.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleDontAskAgain}
              disabled={loading}
              className="sm:w-auto w-full"
            >
              Don&apos;t ask again
            </Button>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="sm:w-auto w-full"
            >
              Close
            </Button>
            <Button
              onClick={handleEnableNow}
              disabled={loading}
              className="sm:w-auto w-full"
            >
              {loading ? "Enabling..." : "Enable now"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}