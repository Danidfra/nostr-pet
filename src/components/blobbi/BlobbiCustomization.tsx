import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Palette, Sparkles } from 'lucide-react';
import { useBlobbiWithFakeStatus } from '@/hooks/useBlobbiWithFakeStatus';
import { BlobbiVisual } from './BlobbiVisual';
import { BlobbiEvolvedVisual } from './BlobbiEvolvedVisual';
import { useToast } from '@/hooks/useToast';

const COLORS = [
  { name: 'Purple', value: '#7C3AED' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Yellow', value: '#F59E0B' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Orange', value: '#F97316' },
];

const PATTERNS = [
  { name: 'None', value: '' },
  { name: 'Stripes', value: 'stripes' },
  { name: 'Dots', value: 'dots' },
];

interface BlobbiCustomizationProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BlobbiCustomization({ isOpen, onClose }: BlobbiCustomizationProps) {
  const { blobbi, updateCustomization, isUpdatingCustomization, isLoading } = useBlobbiWithFakeStatus();
  const { toast } = useToast();

  // Initialize state - will be set properly when dialog opens
  const [selectedColor, setSelectedColor] = useState('#7C3AED');
  const [selectedPattern, setSelectedPattern] = useState('');

  // Reset state to current blobbi customization only when dialog opens
  React.useEffect(() => {
    if (isOpen && blobbi) {
      setSelectedColor(blobbi.customization?.color || '#7C3AED');
      setSelectedPattern(blobbi.customization?.pattern || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Only reset when dialog opens/closes

  // Set initial values when blobbi first loads
  React.useEffect(() => {
    if (blobbi && !isOpen) {
      setSelectedColor(blobbi.customization?.color || '#7C3AED');
      setSelectedPattern(blobbi.customization?.pattern || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobbi?.id]); // Only run when blobbi ID changes

  if (!isOpen) return null;

  if (isLoading || !blobbi) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Customize Your Blobbi
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Create a preview blobbi with the selected customizations
  const previewBlobbi = {
    ...blobbi,
    customization: {
      ...blobbi.customization,
      color: selectedColor,
      pattern: selectedPattern,
    },
  };

  const handleSave = async () => {
    try {
      await updateCustomization({
        color: selectedColor,
        pattern: selectedPattern,
        accessories: blobbi.customization.accessories || [], // Preserve existing accessories
      });

      toast({
        title: "Customization Saved!",
        description: "Your Blobbi looks great with its new style!",
      });

      onClose();
    } catch (error) {
      console.error('Failed to save customization:', error);
      toast({
        title: "Error",
        description: "Failed to save customization. Please try again.",
        variant: "destructive",
      });
    }
  };

  const hasChanges =
    selectedColor !== (blobbi.customization?.color || '#7C3AED');
    // Pattern changes removed from UI but data preserved
    // selectedPattern !== (blobbi.customization?.pattern || '');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl max-h-[85vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <Palette className="w-4 h-4 text-white" />
            </div>
            Customize Your Blobbi
          </DialogTitle>
        </DialogHeader>

        <div className="grid lg:grid-cols-2 gap-6 h-full max-h-[500px] overflow-hidden">
          {/* Preview */}
          <div className="space-y-4">
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-900 dark:text-gray-100">
                  Preview
                  {previewBlobbi.evolutionForm && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({previewBlobbi.evolutionForm.charAt(0).toUpperCase() + previewBlobbi.evolutionForm.slice(1)})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center transition-all duration-500 min-h-[200px] p-6 bg-gradient-to-br from-purple-50/60 to-pink-50/60 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl border-2 border-purple-100/50 dark:border-purple-600/30">
                  {previewBlobbi.evolutionForm ? (
                    <BlobbiEvolvedVisual
                      key={`${selectedColor}-${selectedPattern}`}
                      blobbi={previewBlobbi}
                      size={previewBlobbi.lifeStage === 'baby' ? 'small' : 'medium'}
                    />
                  ) : (
                    <BlobbiVisual
                      key={`${selectedColor}-${selectedPattern}`}
                      blobbi={previewBlobbi}
                      size={previewBlobbi.lifeStage === 'baby' ? 'small' : 'medium'}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Customization Options */}
          <div className="space-y-6 overflow-y-auto pr-2">
            {/* Color Selection */}
            <div className="space-y-4">
              <Label className="text-gray-900 dark:text-gray-100 font-medium">Body Color</Label>
              <div className="grid grid-cols-4 gap-3">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => {
                      setSelectedColor(color.value);
                    }}
                    className={`
                      w-full h-12 rounded-xl border-2 transition-all duration-200 hover:scale-105
                      ${selectedColor === color.value
                        ? 'border-purple-500 ring-2 ring-purple-500 ring-offset-2 dark:ring-offset-gray-900 shadow-lg'
                        : 'border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-500'
                      }
                    `}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* Pattern Selection - HIDDEN FROM UI BUT DATA PRESERVED */}
            {/* <div className="space-y-3">
              <Label>Pattern</Label>
              <RadioGroup value={selectedPattern} onValueChange={setSelectedPattern}>
                {PATTERNS.map((pattern) => (
                  <div key={pattern.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={pattern.value} id={pattern.value || 'none'} />
                    <Label
                      htmlFor={pattern.value || 'none'}
                      className="cursor-pointer"
                    >
                      {pattern.name}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div> */}

            {/* Future Accessories */}
            <div className="space-y-4">
              <Label className="flex items-center gap-2 text-gray-900 dark:text-gray-100 font-medium">
                <Sparkles className="w-4 h-4" />
                Accessories
              </Label>
              <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-600 rounded-xl">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-800/30 dark:to-pink-800/30 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-purple-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Accessories coming soon! Earn more coins to unlock hats, glasses, and more.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-6">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isUpdatingCustomization}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 disabled:opacity-50"
          >
            {isUpdatingCustomization ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}