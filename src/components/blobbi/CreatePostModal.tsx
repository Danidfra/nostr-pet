import React, { useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Send, Hash } from 'lucide-react';

export interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  onPostPublished?: () => void;
}

export function CreatePostModal({ open, onClose, onPostPublished }: CreatePostModalProps) {
  const [content, setContent] = useState('Hello Nostr');
  const [isPublishing, setIsPublishing] = useState(false);
  const { user } = useCurrentUser();
  const { mutate: publishEvent } = useNostrPublish();
  const { toast } = useToast();

  const handlePublish = async () => {
    if (!user) return;

    // Ensure #Blobbi hashtag is included
    const finalContent = content.includes('#Blobbi') || content.includes('#blobbi') 
      ? content 
      : `${content} #Blobbi`;

    setIsPublishing(true);
    
    try {
      // Create tags for the post
      const tags: string[][] = [];
      
      // Add #Blobbi tag if not already in content
      if (!content.includes('#Blobbi') && !content.includes('#blobbi')) {
        tags.push(['t', 'blobbi']);
      }

      // Extract any other hashtags from content
      const hashtagRegex = /#(\w+)/g;
      const matches = finalContent.matchAll(hashtagRegex);
      const foundHashtags = new Set<string>();
      
      for (const match of matches) {
        const hashtag = match[1].toLowerCase();
        if (hashtag !== 'blobbi' && !foundHashtags.has(hashtag)) {
          tags.push(['t', hashtag]);
          foundHashtags.add(hashtag);
        }
      }

      await publishEvent({
        kind: 1,
        content: finalContent,
        tags,
      });

      toast({
        title: "✅ Post Published!",
        description: "Your post has been published to Nostr successfully.",
        variant: "default",
      });

      // Reset form and close modal
      setContent('Hello Nostr');
      onClose();
      
      // Callback for parent component
      if (onPostPublished) {
        onPostPublished();
      }
    } catch (error) {
      console.error('Failed to publish post:', error);
      toast({
        title: "❌ Publication Failed",
        description: "There was an error publishing your post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleClose = () => {
    if (!isPublishing) {
      setContent('Hello Nostr');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-purple-500" />
            Create Post
          </DialogTitle>
          <DialogDescription>
            Publish a post to Nostr. The #Blobbi hashtag will be automatically included.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="post-content" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Your Post
            </label>
            <Textarea
              id="post-content"
              placeholder="Hello Nostr"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[100px] resize-none"
              disabled={isPublishing}
            />
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Hash className="h-3 w-3" />
              <span>
                {content.includes('#Blobbi') || content.includes('#blobbi') 
                  ? '#Blobbi hashtag included' 
                  : '#Blobbi will be automatically added'}
              </span>
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
            <p className="text-sm text-purple-700 dark:text-purple-300">
              This post will complete the first task in your Blobbi&apos;s incubation journey!
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isPublishing}
            className="sm:w-auto w-full"
          >
            Cancel
          </Button>
          <Button
            onClick={handlePublish}
            disabled={isPublishing || !content.trim()}
            className="sm:w-auto w-full bg-purple-600 hover:bg-purple-700"
          >
            {isPublishing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Publishing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Publish Post
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}