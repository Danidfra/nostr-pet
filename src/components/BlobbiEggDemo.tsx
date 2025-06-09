import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, RefreshCw } from 'lucide-react';
import { generateSampleBlobbiEgg } from '@/lib/blobbi-adoption';

interface EggData {
  d: string;
  base_color: string;
  size: string;
  pattern: string;
  egg_status: string;
  happiness: string;
  hygiene: string;
  egg_temperature: string;
  shell_integrity: string;
  incubation_progress: string;
  secondary_color?: string;
  special_mark?: string;
  title?: string;
}

export function BlobbiEggDemo() {
  const [eggData, setEggData] = useState<EggData | null>(null);

  const generateNewEgg = () => {
    const rawEgg = generateSampleBlobbiEgg();
    const newEgg: EggData = {
      d: rawEgg.d,
      base_color: rawEgg.base_color,
      size: rawEgg.size,
      pattern: rawEgg.pattern,
      egg_status: rawEgg.egg_status,
      happiness: rawEgg.happiness,
      hygiene: rawEgg.hygiene,
      egg_temperature: rawEgg.egg_temperature,
      shell_integrity: rawEgg.shell_integrity,
      incubation_progress: rawEgg.incubation_progress,
      secondary_color: rawEgg.secondary_color,
      special_mark: rawEgg.special_mark,
      title: rawEgg.title,
    };
    setEggData(newEgg);
  };

  const getRarityColor = (value: string, type: 'color' | 'size' | 'mark' | 'title') => {
    const legendaryColors = ['#6633cc', '#ff3399', '#00ffff'];
    const rareColors = ['#cc99ff', '#ffb3cc', '#66ffcc'];
    const uncommonColors = ['#99ccff', '#ccffcc', '#ffffcc'];
    
    const legendaryMarks = ['sigil_eye', 'glow_crack_pattern'];
    const rareMarks = ['rune_top', 'shimmer_band'];
    const uncommonMarks = ['ring_mark'];

    const legendaryTitles = ['Defender of the Grove', 'The Primordial'];
    const rareTitles = ['Echo of Ancients', 'Shellbound Hero'];
    const uncommonTitles = ['Tender of Flames', 'Whisperer'];

    if (type === 'color' && legendaryColors.includes(value)) return 'legendary';
    if (type === 'color' && rareColors.includes(value)) return 'rare';
    if (type === 'color' && uncommonColors.includes(value)) return 'uncommon';
    
    if (type === 'size' && value === 'tiny') return 'legendary';
    if (type === 'size' && value === 'large') return 'rare';
    if (type === 'size' && value === 'medium') return 'uncommon';
    
    if (type === 'mark' && legendaryMarks.includes(value)) return 'legendary';
    if (type === 'mark' && rareMarks.includes(value)) return 'rare';
    if (type === 'mark' && uncommonMarks.includes(value)) return 'uncommon';
    
    if (type === 'title' && legendaryTitles.includes(value)) return 'legendary';
    if (type === 'title' && rareTitles.includes(value)) return 'rare';
    if (type === 'title' && uncommonTitles.includes(value)) return 'uncommon';
    
    return 'common';
  };

  const getRarityBadgeVariant = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'destructive';
      case 'rare': return 'secondary';
      case 'uncommon': return 'outline';
      default: return 'default';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Blobbi Egg Generator Demo
        </CardTitle>
        <CardDescription>
          See how the new specification-compliant egg generation works with exact probabilities and rarities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={generateNewEgg}
          className="w-full flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Generate Sample Egg
        </Button>

        {eggData && (
          <Card className="border-2 border-dashed">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                🥚 Generated Blobbi Egg
                <Badge variant="secondary">Specification Compliant</Badge>
              </CardTitle>
              <CardDescription>
                ID: {eggData.d}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Required Properties</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Base Color:</span>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: eggData.base_color }}
                        />
                        <Badge variant={getRarityBadgeVariant(getRarityColor(eggData.base_color, 'color'))}>
                          {eggData.base_color}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Size:</span>
                      <Badge variant={getRarityBadgeVariant(getRarityColor(eggData.size, 'size'))}>
                        {eggData.size}
                      </Badge>
                    </div>
                    {/* Pattern display removed from UI but data preserved */}
                    {/* <div className="flex items-center justify-between">
                      <span>Pattern:</span>
                      <span className="capitalize">{eggData.pattern}</span>
                    </div> */}
                    <div className="flex items-center justify-between">
                      <span>Status:</span>
                      <span className="capitalize">{eggData.egg_status}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Stats (Per Spec)</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Happiness:</span>
                      <span>{eggData.happiness}/100 <span className="text-xs text-muted-foreground">(80-100)</span></span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hygiene:</span>
                      <span>{eggData.hygiene}/100 <span className="text-xs text-muted-foreground">(80-100)</span></span>
                    </div>
                    <div className="flex justify-between">
                      <span>Temperature:</span>
                      <span>{eggData.egg_temperature}/100 <span className="text-xs text-muted-foreground">(80-100)</span></span>
                    </div>
                    <div className="flex justify-between">
                      <span>Shell Integrity:</span>
                      <span>{eggData.shell_integrity}/100 <span className="text-xs text-muted-foreground">(80-100)</span></span>
                    </div>
                    <div className="flex justify-between">
                      <span>Incubation:</span>
                      <span>{eggData.incubation_progress}/100 <span className="text-xs text-muted-foreground">(0-100)</span></span>
                    </div>
                  </div>
                </div>
              </div>

              {(eggData.secondary_color || eggData.special_mark || eggData.title) && (
                <div>
                  <h4 className="font-semibold mb-2">Optional Traits (Rare!)</h4>
                  <div className="space-y-2">
                    {eggData.secondary_color && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Secondary Color <span className="text-xs text-muted-foreground">(45% chance)</span>:</span>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded border"
                            style={{ backgroundColor: eggData.secondary_color }}
                          />
                          <Badge variant={getRarityBadgeVariant(getRarityColor(eggData.secondary_color, 'color'))}>
                            {eggData.secondary_color}
                          </Badge>
                        </div>
                      </div>
                    )}
                    {eggData.special_mark && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Special Mark <span className="text-xs text-muted-foreground">(15% chance)</span>:</span>
                        <Badge variant={getRarityBadgeVariant(getRarityColor(eggData.special_mark, 'mark'))}>
                          {eggData.special_mark.replace('_', ' ')}
                        </Badge>
                      </div>
                    )}
                    {eggData.title && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Title <span className="text-xs text-muted-foreground">(10% chance)</span>:</span>
                        <Badge variant={getRarityBadgeVariant(getRarityColor(eggData.title, 'title'))}>
                          {eggData.title}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
                <strong>Specification Compliance:</strong>
                <ul className="mt-1 space-y-1">
                  <li>• All required fields present with exact values from blobbi-egg.md</li>
                  <li>• Stats follow exact ranges: hunger/health/energy=100, others=80-100</li>
                  <li>• Rarity system with weighted selection (Common 50-60%, Legendary 5%)</li>
                  <li>• Optional fields spawn with exact probabilities</li>
                  <li>• Ready for Nostr Kind 31124 event publishing</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}