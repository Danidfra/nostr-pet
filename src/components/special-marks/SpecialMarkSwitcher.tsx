import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ALL_VALID_SPECIAL_MARKS, getSpecialMarkRarity } from '@/lib/blobbi-egg-validation';
import { SpecialMarkRenderer } from './SpecialMarkRenderer';
import { isSpecialMarkSupported } from '@/lib/special-marks-utils';
import { useSpecialMarkCollection } from '@/hooks/useSpecialMark';

interface SpecialMarkSwitcherProps {
  /** Current special mark */
  currentMark?: string | null;
  /** Callback when mark changes */
  onMarkChange?: (mark: string | null) => void;
  /** Whether to show animation controls */
  showAnimationControls?: boolean;
  /** Whether to show opacity controls */
  showOpacityControls?: boolean;
  /** Whether to show rarity badges */
  showRarityBadges?: boolean;
  /** Size of the preview */
  previewSize?: 'small' | 'medium' | 'large';
  /** Custom class name */
  className?: string;
  /** Whether to enable collection mode (multiple marks) */
  collectionMode?: boolean;
}

const getRarityColor = (rarity: string) => {
  switch (rarity) {
    case 'common':
      return 'bg-gray-100 text-gray-800 border-gray-300';
    case 'uncommon':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'rare':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'legendary':
      return 'bg-purple-100 text-purple-800 border-purple-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

export const SpecialMarkSwitcher: React.FC<SpecialMarkSwitcherProps> = ({
  currentMark = null,
  onMarkChange,
  showAnimationControls = true,
  showOpacityControls = true,
  showRarityBadges = true,
  previewSize = 'medium',
  className,
  collectionMode = false,
}) => {
  const [selectedMark, setSelectedMark] = useState<string | null>(currentMark);
  
  // Use collection hook if in collection mode
  const collectionHook = useSpecialMarkCollection(
    currentMark ? [currentMark] : [],
    { animated: true, autoAnimate: true }
  );

  const previewSizes = {
    small: { width: 64, height: 80 },
    medium: { width: 128, height: 160 },
    large: { width: 192, height: 240 },
  };

  const currentSize = previewSizes[previewSize];

  const handleMarkSelect = useCallback((mark: string | null) => {
    setSelectedMark(mark);
    onMarkChange?.(mark);
    
    if (collectionMode && mark) {
      collectionHook.addMark(mark);
    }
  }, [onMarkChange, collectionMode, collectionHook]);

  const handleClearMark = useCallback(() => {
    setSelectedMark(null);
    onMarkChange?.(null);
  }, [onMarkChange]);

  const renderMarkPreview = (mark: string) => {
    if (!isSpecialMarkSupported(mark)) {
      return (
        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
          Unsupported
        </div>
      );
    }

    return (
      <div className="relative w-full h-full">
        {/* Egg background for context */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(135deg, #f0f0f0 0%, #ffffff 50%, #f0f0f0 100%)',
            borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
            boxShadow: 'inset -5px -5px 10px rgba(0, 0, 0, 0.1), inset 5px 5px 10px rgba(255, 255, 255, 0.8)',
          }}
        />
        
        {/* Special mark overlay */}
        <SpecialMarkRenderer
          specialMark={mark}
          eggWidth={currentSize.width}
          eggHeight={currentSize.height}
          animated={collectionMode ? collectionHook.isAnimated : true}
          opacity={collectionMode ? collectionHook.opacity : 1}
        />
      </div>
    );
  };

  return (
    <Card className={cn('w-full max-w-2xl', className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Special Mark Switcher
          {collectionMode && (
            <Badge variant="outline">
              Collection Mode
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Current Selection */}
        <div className="space-y-2">
          <Label>Current Special Mark</Label>
          <Select value={selectedMark || ''} onValueChange={(value) => handleMarkSelect(value || null)}>
            <SelectTrigger>
              <SelectValue placeholder="Select a special mark" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {ALL_VALID_SPECIAL_MARKS.map((mark) => {
                const rarity = getSpecialMarkRarity(mark);
                return (
                  <SelectItem key={mark} value={mark}>
                    <div className="flex items-center gap-2">
                      <span>{mark.replace(/_/g, ' ')}</span>
                      {showRarityBadges && rarity && (
                        <Badge 
                          variant="outline" 
                          className={cn('text-xs', getRarityColor(rarity))}
                        >
                          {rarity}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Preview */}
        {selectedMark && (
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="flex justify-center p-4 bg-muted rounded-lg">
              <div 
                style={{ 
                  width: currentSize.width, 
                  height: currentSize.height 
                }}
                className="relative"
              >
                {renderMarkPreview(selectedMark)}
              </div>
            </div>
          </div>
        )}

        {/* Animation Controls */}
        {showAnimationControls && selectedMark && (
          <div className="space-y-4">
            <Label>Animation Controls</Label>
            <div className="flex items-center space-x-2">
              <Switch
                id="animation-toggle"
                checked={collectionMode ? collectionHook.isAnimated : true}
                onCheckedChange={collectionMode ? collectionHook.toggleAnimation : undefined}
              />
              <Label htmlFor="animation-toggle">Enable Animations</Label>
            </div>
          </div>
        )}

        {/* Opacity Controls */}
        {showOpacityControls && selectedMark && (
          <div className="space-y-4">
            <Label>Opacity: {Math.round((collectionMode ? collectionHook.opacity : 1) * 100)}%</Label>
            <Slider
              value={[collectionMode ? collectionHook.opacity * 100 : 100]}
              onValueChange={([value]) => {
                if (collectionMode) {
                  collectionHook.setOpacity(value / 100);
                }
              }}
              max={100}
              min={0}
              step={5}
              className="w-full"
            />
          </div>
        )}

        {/* Collection Mode Controls */}
        {collectionMode && (
          <div className="space-y-4">
            <Label>Collection ({collectionHook.marks.length} marks)</Label>
            <div className="flex flex-wrap gap-2">
              {collectionHook.marks.map((mark, index) => (
                <Badge
                  key={mark}
                  variant={index === collectionHook.activeIndex ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => collectionHook.selectMark(index)}
                >
                  {mark.replace(/_/g, ' ')}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      collectionHook.removeMark(mark);
                    }}
                    className="ml-1 text-xs hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
            
            {collectionHook.hasMultipleMarks && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={collectionHook.previousMark}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={collectionHook.nextMark}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClearMark}
            disabled={!selectedMark}
          >
            Clear Mark
          </Button>
          
          {selectedMark && !isSpecialMarkSupported(selectedMark) && (
            <Badge variant="destructive">
              Unsupported Mark
            </Badge>
          )}
        </div>

        {/* Performance Info */}
        {collectionMode && collectionHook.performanceMode && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              Performance mode is active. Animations may be reduced for better performance.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};