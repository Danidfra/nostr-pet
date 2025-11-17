import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Camera, Lock, Coins, Loader2, Download, Share, ChevronDown, Plus, X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { BlobbiVisual } from './BlobbiVisual';
import { BlobbiEvolvedVisual } from './BlobbiEvolvedVisual';
import { EggGraphic } from './EggGraphic';
import { Blobbi } from '@/types/blobbi';
import { toPng } from 'html-to-image';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { NPool, NRelay1, NostrEvent } from '@nostrify/nostrify';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from '@/components/ui/carousel';

// Local relay interface for modal-only use
interface ModalRelayInfo {
  url: string;
  connected: boolean;
  enabled: boolean;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}

interface Background {
  id: string;
  name: string;
  unlocked: boolean;
  priceCoins: number;
  thumb: string;
  full: string;
}

interface PolaroidPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  blobbi: Blobbi;
  onPhotoPosted?: () => void;
}

// Available backgrounds
const backgrounds: Background[] = [
  {
    id: "bg-default",
    name: "Default",
    unlocked: true,
    priceCoins: 0,
    thumb: "/assets/bg/default-thumb.svg",
    full: "/assets/bg/default.svg"
  },
  {
    id: "bg-forest",
    name: "Forest",
    unlocked: false,
    priceCoins: 200,
    thumb: "/assets/bg/forest.png",
    full: "/assets/bg/forest.png"
  },
  {
    id: "bg-beach",
    name: "Beach",
    unlocked: false,
    priceCoins: 200,
    thumb: "/assets/bg/beach.png",
    full: "/assets/bg/beach.png"
  },
  {
    id: "bg-space",
    name: "Space",
    unlocked: false,
    priceCoins: 300,
    thumb: "/assets/bg/space.png",
    full: "/assets/bg/space.png"
  },
  {
    id: "bg-garden",
    name: "Garden",
    unlocked: false,
    priceCoins: 150,
    thumb: "/assets/bg/garden.png",
    full: "/assets/bg/garden.png"
  },
];

// Custom carousel dots component
const CarouselDots = ({
  count,
  current,
  onDotClick
}: {
  count: number;
  current: number;
  onDotClick: (index: number) => void;
}) => {
  return (
    <div className="flex justify-center space-x-2 mt-4">
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          onClick={() => onDotClick(index)}
          className={`h-2 w-2 rounded-full transition-all duration-200 ${
            index === current
              ? 'bg-purple-600 scale-125'
              : 'bg-gray-300 hover:bg-gray-400'
          }`}
          aria-label={`Go to slide ${index + 1}`}
          aria-current={index === current ? 'true' : 'false'}
        />
      ))}
    </div>
  );
};

export function PolaroidPhotoModal({ isOpen, onClose, blobbi, onPhotoPosted }: PolaroidPhotoModalProps) {
  const { toast } = useToast();
  const polaroidRootRef = useRef<HTMLDivElement>(null);
  const [selectedBackground, setSelectedBackground] = useState<Background>(backgrounds[0]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPolaroid, setCapturedPolaroid] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);

  // Share step state
  const [mode, setMode] = useState<'edit' | 'share'>('edit');
  const [customRelayUrl, setCustomRelayUrl] = useState('');
  const [isAddingRelay, setIsAddingRelay] = useState(false);
  const [nostrContent, setNostrContent] = useState('');
  const [isNostrSectionOpen, setIsNostrSectionOpen] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  // Local modal-only relays state (not persistent)
  const [modalRelays, setModalRelays] = useState<ModalRelayInfo[]>([
    { url: 'wss://relay.ditto.pub', connected: true, enabled: true, status: 'connected' }
  ]);

  const { user } = useCurrentUser();
  const { mutateAsync: uploadFile } = useUploadFile();

  // Handle background selection
  const handleBackgroundSelect = (background: Background, slideIndex: number) => {
    if (!background.unlocked) {
      toast({
        title: "Background Locked",
        description: `Unlock with ${background.priceCoins} coins (coming soon)`,
        variant: "default",
      });
      return;
    }
    setSelectedBackground(background);
    setCurrentSlide(slideIndex);

    // Scroll carousel to the selected slide
    if (carouselApi) {
      carouselApi.scrollTo(slideIndex);
    }
  };

  // Render Blobbi component with inline SVG for capture
  const renderBlobbi = () => {
    const commonProps = {
      blobbi,
      size: 'medium' as const,
      className: 'blobbi-character',
      forceInlineSvg: true, // Force inline SVG for capture
    };

    if (blobbi.lifeStage === 'egg') {
      return (
        <EggGraphic
          {...commonProps}
          animated={true}
          cracking={!!(blobbi.incubationProgress && blobbi.incubationProgress > 80)}
          warmth={blobbi.eggTemperature || 60}
        />
      );
    } else if (blobbi.evolutionForm && blobbi.evolutionForm !== 'blobbi') {
      return <BlobbiEvolvedVisual {...commonProps} />;
    } else {
      return <BlobbiVisual {...commonProps} />;
    }
  };

  // Capture photo using html-to-image
  const handleCapturePhoto = useCallback(async () => {
    if (!polaroidRootRef.current) {
      throw new Error('Polaroid root element not found');
    }

    setIsCapturing(true);
    console.log('📸 Starting photo capture with html-to-image');

    try {
      // Wait for fonts to be loaded
      await document.fonts.ready;
      console.log('✅ Fonts loaded');

      // Wait for images to be loaded
      const images = polaroidRootRef.current.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map(img => {
          return new Promise<void>((resolve, reject) => {
            if (img.complete) {
              resolve();
            } else {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error(`Failed to load image: ${img.src}`));
            }
          });
        })
      );
      console.log('✅ Images loaded');

      // Calculate pixel ratio for quality
      const pixelRatio = Math.min(3, window.devicePixelRatio || 1);
      console.log('📱 Using pixel ratio:', pixelRatio);

      // Capture polaroid root element
      const dataUrl = await toPng(polaroidRootRef.current, {
        pixelRatio,
      });

      console.log('✅ Photo captured successfully');
      setCapturedPolaroid(dataUrl);

      // Analytics tracking
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'growth_hub.photo_created', {
          event_category: 'blobbi_interaction',
          event_label: 'polaroid_capture',
          blobbiId: blobbi.id,
          stage: blobbi.lifeStage,
          backgroundId: selectedBackground.id,
        });
      }

      toast({
        title: "Photo Captured!",
        description: "Your Blobbi polaroid has been created successfully.",
        variant: "default",
      });

    } catch (error) {
      console.error('❌ Photo capture failed:', error);
      toast({
        title: "Capture Failed",
        description: "Failed to capture photo. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsCapturing(false);
    }
  }, [blobbi, selectedBackground, toast]);

  // Share click handler - immediate transition
  const onShareClick = useCallback(async () => {
    if (capturedPolaroid) {
      // If we already have a captured photo, switch to share mode immediately
      setMode('share');
      return;
    }

    // Otherwise, capture the photo and then switch to share mode
    try {
      await handleCapturePhoto();
      setMode('share');
    } catch (error) {
      // Error is already handled in handleCapturePhoto
      console.error('Failed to capture photo:', error);
    }
  }, [capturedPolaroid, handleCapturePhoto]);

  // Handle modal close
  const handleClose = () => {
    setCapturedPolaroid(null);
    setIsCapturing(false);
    setMode('edit');
    setNostrContent('');
    setIsNostrSectionOpen(false);
    onClose();
  };

  // Download captured polaroid
  const handleDownload = () => {
    if (!capturedPolaroid) return;

    const link = document.createElement('a');
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '');
    const filename = `blobbi-polaroid-${blobbi.id}-${timestamp}.png`;

    link.href = capturedPolaroid;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Download Started",
      description: `Your polaroid is being downloaded as ${filename}`,
      variant: "default",
    });
  };

  // Add custom relay (modal-only version)
  const handleAddRelay = async () => {
    if (!customRelayUrl.trim()) return;

    try {
      setIsAddingRelay(true);

      // Validate URL format
      try {
        const urlObj = new URL(customRelayUrl);
        if (!urlObj.protocol.startsWith('ws')) {
          throw new Error('Relay URL must use ws:// or wss:// protocol');
        }
      } catch (error) {
        throw new Error('Please enter a valid WebSocket URL (ws:// or wss://)');
      }

      // Check if relay already exists
      if (modalRelays.some(relay => relay.url === customRelayUrl)) {
        throw new Error('This relay is already in your list');
      }

      // Add new relay to modal-only state
      const newRelay: ModalRelayInfo = {
        url: customRelayUrl,
        connected: false,
        enabled: true,
        status: 'connecting'
      };

      setModalRelays(prev => [...prev, newRelay]);
      setCustomRelayUrl('');
      toast({
        title: "Relay Added",
        description: "Relay has been added successfully",
        variant: "default",
      });
    } catch (error: unknown) {
      toast({
        title: "Failed to Add Relay",
        description: error instanceof Error ? error.message : "Failed to add relay",
        variant: "destructive",
      });
    } finally {
      setIsAddingRelay(false);
    }
  };

  // Toggle relay enabled/disabled state (modal-only version)
  const toggleModalRelay = (url: string, enabled: boolean) => {
    setModalRelays(prev => prev.map(relay =>
      relay.url === url ? { ...relay, enabled } : relay
    ));
  };

  // Check if at least one relay is selected (modal-only version)
  const hasSelectedRelays = modalRelays.some(relay => relay.enabled);

  // Generate locked hashtag content
  const lockedHashtagContent = `#Blobbi #${blobbi.name.replace(/\s+/g, '')}`;

  // Handle Nostr post
  const handleNostrPost = async () => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to share photos to Nostr.",
        variant: "destructive",
      });
      return;
    }

    if (!capturedPolaroid) {
      toast({
        title: "Photo not available",
        description: "Polaroid image is not available. Please take a new photo.",
        variant: "destructive",
      });
      return;
    }

    setIsPosting(true);
    try {
      // Convert data URL to blob (following nostrdamus pattern)
      const blob = await (await fetch(capturedPolaroid)).blob();
      const file = new File([blob], "blobbi-polaroid.png", { type: "image/png" });
      const uploadResult = await uploadFile(file);
      const imageUrl = uploadResult[0][1];

      // Create hashtags for the content
      const mandatoryHashtags = '#Blobbi #NostrPet';

      // Create summary for imeta tag
      const imetaSummary = `blobbi_polaroid #Blobbi #NostrPet ${blobbi.name}`;

      // Create final content with image URL (following nostrdamus pattern)
      const finalContent = nostrContent.trim()
        ? `${nostrContent.trim()}\n\n${mandatoryHashtags}\n\n${imageUrl}`
        : `${mandatoryHashtags}\n\n${imageUrl}`;

      // Get enabled relays from modal state
      const enabledRelays = modalRelays.filter(relay => relay.enabled).map(relay => relay.url);

      if (enabledRelays.length === 0) {
        throw new Error('No relays selected');
      }

      // Create temporary pool for modal-specific publishing
      const tempPoolConfig = {
        open: (url: string) => new NRelay1(url),
        reqRouter: () => new Map(), // Not needed for event publishing
        eventRouter: () => enabledRelays, // Only publish to selected relays
      };

      const tempPool = new NPool(tempPoolConfig);

      // Sign and publish event using temporary pool
      const event = await user.signer.signEvent({
        kind: 1,
        content: finalContent,
        tags: [
          ["t", "blobbi"],
          ['b', 'blobbi:ecosystem:v1'],
          [
            "imeta",
            `url ${imageUrl}`,
            "m image/png",
            `summary ${imetaSummary}`,
            `alt A polaroid photo of ${blobbi.name} taken with background: ${selectedBackground.name}`
          ]
        ],
        created_at: Math.floor(Date.now() / 1000),
      });

      // Publish to selected relays only
      await tempPool.event(event, { signal: AbortSignal.timeout(5000) });

      // Properly close temporary pool and await its closure
      try {
        await tempPool.close();
      } catch (closeError) {
        console.warn('Warning: Error closing temporary pool:', closeError);
        // Don't throw here - the event was already published successfully
      }

      // Show success message
      setIsPosting(false);
      toast({
        title: "Photo shared to Nostr! 🚀",
        description: `Published to ${enabledRelays.length} relay${enabledRelays.length > 1 ? 's' : ''}: ${enabledRelays.join(', ')}`,
      });

      // Notify parent component that photo was posted successfully
      if (onPhotoPosted) {
        try {
          await onPhotoPosted();
        } catch (error) {
          console.warn('Failed to execute onPhotoPosted callback:', error);
        }
      }

      // Reset form after successful share
      setNostrContent('');

      // Close modal after short delay
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      // Check if this is an AggregateError (likely from pool closure)
      if (error && typeof error === 'object' && 'errors' in error && Array.isArray((error as any).errors)) {
        console.warn('AggregateError during Nostr operation (likely pool closure, but event may have been published):', error);

        // Try to extract more specific error info
        const errorMessages = (error as any).errors.map((err: any) => err instanceof Error ? err.message : String(err));
        console.warn('Individual errors:', errorMessages);

        // Show a more user-friendly message that acknowledges that event might have been published
        setIsPosting(false);
        toast({
          title: "Photo may have been shared! ✅",
          description: "There was a connection issue during cleanup, but your photo was likely published successfully. Please check your Nostr client.",
          variant: "default",
        });

        // Notify parent component that photo was likely posted successfully (optimistically)
        if (onPhotoPosted) {
          try {
            await onPhotoPosted();
          } catch (error) {
            console.warn('Failed to execute onPhotoPosted callback:', error);
          }
        }

        // Still reset form and close modal
        setNostrContent('');
        setTimeout(() => {
          handleClose();
        }, 3000);
        return;
      }

      // Handle other types of errors
      setIsPosting(false);
      console.error('Error sharing to Nostr:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Share failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Keyboard navigation for carousel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen || !carouselApi) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        carouselApi.scrollPrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        carouselApi.scrollNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, carouselApi]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-5xl md:max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'edit' ? (
              <>
                <Camera className="h-5 w-5 text-purple-600" />
                Take Polaroid Photo
              </>
            ) : (
              <>
                <Share className="h-5 w-5 text-purple-600" />
                Share Your Polaroid
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[30%_1fr] gap-4 md:gap-6 max-h-[72vh]">
          {/* Left Column - Preview */}
          <div className="flex items-center justify-center md:justify-start">
            <div className="w-full max-w-[520px]">
            {mode === 'edit' ? (
              /* EDIT mode: Show live composition DOM */
              <div
                ref={polaroidRootRef}
                className="polaroid-root w-[90%] bg-white p-6 rounded-lg border-2 border-gray-200 shadow-lg"
                style={{
                  // Ensure consistent sizing for capture
                  width: '320px',
                  height: '500px',
                }}
              >
                {/* Photo area with background */}
                <div
                  className="relative aspect-[3/4] bg-cover bg-center rounded-lg overflow-hidden mb-4"
                  style={{
                    backgroundImage: `url(${selectedBackground.full})`,
                  }}
                >
                  {/* Background image for capture */}
                  <img
                    src={selectedBackground.full}
                    alt={selectedBackground.name}
                    className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
                    crossOrigin="anonymous"
                  />

                  {/* Blobbi in center */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="scale-75 md:scale-100">
                      {renderBlobbi()}
                    </div>
                  </div>
                </div>

                {/* Polaroid bottom white strip with name */}
                <div className="h-16 bg-white rounded-b-lg flex items-center justify-center">
                  <span className="text-gray-600 font-handwriting text-lg">
                    {blobbi.name}
                  </span>
                </div>
              </div>
            ) : (
              /* SHARE mode: Show captured image only */
              <div className="w-[90%]">
                {capturedPolaroid ? (
                  <img
                    src={capturedPolaroid}
                    alt={`Polaroid of ${blobbi.name}`}
                    className="w-full object-contain"
                    style={{
                      // Maintain the same aspect ratio as the polaroid
                      maxHeight: '420px',
                    }}
                  />
                ) : (
                  <div className="w-full aspect-[3/4] grid place-items-center text-sm text-muted-foreground border-2 border-dashed border-gray-300 rounded-lg">
                    No photo yet — click "Share Photo" to capture.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
          {/* Right Column */}
          <div className="space-y-4">
            {mode === 'edit' ? (
              <>
                <h3 className="font-semibold text-lg">Backgrounds</h3>

                {/* Carousel with responsive slides */}
                <div className="relative">
                  <Carousel
                    opts={{
                      align: "start",
                      loop: true,
                    }}
                    className="w-[80%] mx-auto px-4"
                    setApi={(api) => {
                      setCarouselApi(api);
                      if (api) {
                        api.on('select', () => {
                          setCurrentSlide(api.selectedScrollSnap());
                        });
                      }
                    }}
                  >
                    <CarouselPrevious className="-left-5 -translate-x-0" />
                    <CarouselNext className="-right-5 translate-x-0" />

                    <CarouselContent>
                      {backgrounds.map((background, index) => (
                        <CarouselItem
                          key={background.id}
                          className="md:basis-1/4 py-2"
                        >
                          <Card
                            className={`cursor-pointer transition-all duration-200 pt-4 ${
                              selectedBackground.id === background.id
                                ? 'ring-1 ring-purple-500 border-purple-300'
                                : 'border-gray-200 hover:border-purple-300'
                            }`}
                            onClick={() => handleBackgroundSelect(background, index)}
                          >
                            <CardContent>
                              <div className="relative">
                                <img
                                  src={background.thumb}
                                  alt={background.name}
                                  className="w-full aspect-[3/4] object-cover rounded-lg"
                                  crossOrigin="anonymous"
                                />

                                {/* Lock overlay for locked backgrounds */}
                                {!background.unlocked && (
                                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                                    <div className="text-center text-white">
                                      <Lock className="h-6 w-6 mx-auto mb-2" />
                                      <div className="flex items-center gap-1 text-sm">
                                        <Coins className="h-3 w-3" />
                                        {background.priceCoins}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Selection indicator */}
                                {selectedBackground.id === background.id && (
                                  <div className="absolute top-2 right-2">
                                    <div className="bg-purple-500 text-white rounded-full p-1">
                                      <Camera className="h-3 w-3" />
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="mt-2 text-center">
                                <p className="font-medium text-sm">{background.name}</p>
                                {!background.unlocked && (
                                  <Badge variant="secondary" className="mt-1 text-xs">
                                    <Lock className="h-3 w-3 mr-1" />
                                    {background.priceCoins} coins
                                  </Badge>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                  </Carousel>

                  {/* Carousel dots */}
                  <CarouselDots
                    count={Math.ceil(backgrounds.length / 4)}
                    current={currentSlide}
                    onDotClick={(index) => {
                      if (carouselApi) {
                        carouselApi.scrollTo(index);
                      }
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-lg">Share Options</h3>

                {/* Download Section */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Download className="h-5 w-5 text-green-600" />
                        <div>
                          <h4 className="font-medium">Download Image</h4>
                          <p className="text-sm text-muted-foreground">
                            Save your polaroid as a PNG file
                          </p>
                        </div>
                      </div>
                      <Button onClick={handleDownload} className="bg-green-600 hover:bg-green-700">
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Nostr Post Section (Collapsible) */}
                <Collapsible open={isNostrSectionOpen} onOpenChange={setIsNostrSectionOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardContent className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Share className="h-5 w-5 text-purple-600" />
                            <div>
                              <h4 className="font-medium">Post on Nostr</h4>
                              <p className="text-sm text-muted-foreground">
                                Share your polaroid with the Nostr community
                              </p>
                            </div>
                          </div>
                          <ChevronDown className={`h-4 w-4 transition-transform ${isNostrSectionOpen ? 'rotate-180' : ''}`} />
                        </div>
                      </CardContent>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t p-4 space-y-4">
                        {/* Relays Selector */}
                        <div>
                          <Label className="text-sm font-medium">Relays</Label>
                          <div className="mt-2 space-y-2">
                            {modalRelays.map((relay) => (
                              <div key={relay.url} className="flex items-center space-x-2 p-2 border rounded">
                                <Switch
                                  checked={relay.enabled}
                                  onCheckedChange={(checked) => toggleModalRelay(relay.url, checked)}
                                />
                                <span className="flex-1 text-sm">{relay.url}</span>
                                <div className={`w-2 h-2 rounded-full ${
                                  relay.connected ? 'bg-green-500' :
                                  relay.status === 'connecting' ? 'bg-yellow-500' :
                                  relay.status === 'error' ? 'bg-red-500' : 'bg-gray-300'
                                }`} />
                              </div>
                            ))}
                          </div>

                          {/* Add Custom Relay */}
                          <div className="flex gap-2 mt-3">
                            <Input
                              placeholder="Add custom relay (wss://...)"
                              value={customRelayUrl}
                              onChange={(e) => setCustomRelayUrl(e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              onClick={handleAddRelay}
                              disabled={!customRelayUrl.trim() || isAddingRelay}
                              size="sm"
                            >
                              {isAddingRelay ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                            </Button>
                          </div>

                          {!hasSelectedRelays && (
                            <p className="text-sm text-red-600">
                              At least one relay must be selected
                            </p>
                          )}
                        </div>

                        {/* Post Content Inputs */}
                        <div>
                          <Label className="text-sm font-medium">Post Content</Label>
                          <Textarea
                            placeholder="Write something about your Blobbi..."
                            value={nostrContent}
                            onChange={(e) => setNostrContent(e.target.value)}
                            className="mt-2"
                            rows={3}
                          />
                          <div className="mt-2 p-3 bg-muted rounded-md">
                            <Label className="text-xs text-muted-foreground">Will be appended:</Label>
                            <p className="text-sm font-medium mt-1">{lockedHashtagContent}</p>
                          </div>
                        </div>

                        {/* Post Button */}
                        <Button
                          onClick={handleNostrPost}
                          disabled={!hasSelectedRelays || isPosting}
                          className="w-full bg-purple-600 hover:bg-purple-700"
                        >
                          {isPosting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Posting...
                            </>
                          ) : (
                            <>
                              <Share className="h-4 w-4 mr-2" />
                              Post on Nostr
                            </>
                          )}
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          {mode === 'edit' ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isCapturing}>
                Cancel
              </Button>
              <Button
                onClick={onShareClick}
                disabled={isCapturing}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isCapturing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Capturing...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-2" />
                    Take Photo
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setMode('edit')} disabled={isCapturing}>
                Back to Edit
              </Button>
              <Button onClick={handleClose} disabled={isCapturing}>
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}