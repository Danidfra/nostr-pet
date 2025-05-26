import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Palette, Sparkles } from 'lucide-react';
import { useBlobbi } from '@/hooks/useBlobbi';
import { BlobbiVisual } from './BlobbiVisual';
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
  const { blobbi, updateCustomization, isUpdatingCustomization } = useBlobbi();
  const { toast } = useToast();
  
  const [selectedColor, setSelectedColor] = useState(blobbi?.customization.color || '#7C3AED');
  const [selectedPattern, setSelectedPattern] = useState(blobbi?.customization.pattern || '');
  
  if (!blobbi) return null;
  
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
      });
      
      toast({
        title: "Customization Saved!",
        description: "Your Blobbi looks great with its new style!",
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save customization. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const hasChanges = 
    selectedColor !== blobbi.customization.color || 
    selectedPattern !== blobbi.customization.pattern;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Customize Your Blobbi
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Preview */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  <BlobbiVisual blobbi={previewBlobbi} size="medium" />
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Customization Options */}
          <div className="space-y-6">
            {/* Color Selection */}
            <div className="space-y-3">
              <Label>Body Color</Label>
              <div className="grid grid-cols-4 gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setSelectedColor(color.value)}
                    className={`
                      w-full h-12 rounded-md border-2 transition-all
                      ${selectedColor === color.value 
                        ? 'border-primary ring-2 ring-primary ring-offset-2' 
                        : 'border-border hover:border-primary/50'
                      }
                    `}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            
            {/* Pattern Selection */}
            <div className="space-y-3">
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
            </div>
            
            {/* Future Accessories */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Accessories
              </Label>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Accessories coming soon! Earn more coins to unlock hats, glasses, and more.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || isUpdatingCustomization}
          >
            {isUpdatingCustomization ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}