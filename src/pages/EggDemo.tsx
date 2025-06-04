import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Sparkles, Palette, Ruler, Star } from 'lucide-react';
import { BlobbiEggVisual } from '@/components/egg/BlobbiEggVisual';
import { generateSampleBlobbiEgg } from '@/lib/blobbi-adoption';
import { 
  ALL_VALID_BASE_COLORS,
  ALL_VALID_SECONDARY_COLORS,
  ALL_VALID_SIZES,
  ALL_VALID_SPECIAL_MARKS,
  ALL_VALID_TITLES,
  VALID_PATTERNS,
  VALID_EGG_STATUSES,
  getColorRarity,
  getSizeRarity,
  getSpecialMarkRarity,
  getTitleRarity
} from '@/lib/blobbi-egg-validation';
import { AppHeader } from '@/components/AppHeader';

interface EggProperties {
  d: string;
  base_color: string;
  secondary_color?: string;
  size: string;
  pattern: string;
  special_mark?: string;
  egg_status: string;
  shell_integrity: string;
  incubation_progress: string;
  happiness: string;
  hygiene: string;
  egg_temperature: string;
  title?: string;
}

// Available options based on the specification - using centralized validation
const BASE_COLORS = [...ALL_VALID_BASE_COLORS];
const SECONDARY_COLORS = [...ALL_VALID_SECONDARY_COLORS];
const SIZES = [...ALL_VALID_SIZES];
const PATTERNS = [...VALID_PATTERNS];
const EGG_STATUSES = [...VALID_EGG_STATUSES];
const SPECIAL_MARKS = [...ALL_VALID_SPECIAL_MARKS];
const TITLES = [...ALL_VALID_TITLES];

export default function EggDemo() {
  const [eggData, setEggData] = useState<EggProperties | null>(null);
  const [showSecondaryColor, setShowSecondaryColor] = useState(false);
  const [showSpecialMark, setShowSpecialMark] = useState(false);
  const [showTitle, setShowTitle] = useState(false);

  const generateRandomEgg = () => {
    const rawEgg = generateSampleBlobbiEgg();
    const newEgg: EggProperties = {
      d: rawEgg.d,
      base_color: rawEgg.base_color,
      secondary_color: rawEgg.secondary_color,
      size: rawEgg.size,
      pattern: rawEgg.pattern,
      special_mark: rawEgg.special_mark,
      egg_status: rawEgg.egg_status,
      shell_integrity: rawEgg.shell_integrity,
      incubation_progress: rawEgg.incubation_progress,
      happiness: rawEgg.happiness,
      hygiene: rawEgg.hygiene,
      egg_temperature: rawEgg.egg_temperature,
      title: rawEgg.title,
    };
    
    setEggData(newEgg);
    setShowSecondaryColor(!!newEgg.secondary_color);
    setShowSpecialMark(!!newEgg.special_mark);
    setShowTitle(!!newEgg.title);
  };

  const updateProperty = (key: keyof EggProperties, value: string) => {
    if (!eggData) return;
    
    // Validate colors before updating
    if (key === 'base_color' && !(ALL_VALID_BASE_COLORS as readonly string[]).includes(value)) {
      console.warn(`Invalid base color: ${value}. Must be specification-compliant.`);
      return;
    }
    
    if (key === 'secondary_color' && !(ALL_VALID_SECONDARY_COLORS as readonly string[]).includes(value)) {
      console.warn(`Invalid secondary color: ${value}. Must be specification-compliant.`);
      return;
    }
    
    setEggData(prev => prev ? { ...prev, [key]: value } : null);
  };

  const toggleOptionalProperty = (property: 'secondary_color' | 'special_mark' | 'title', show: boolean) => {
    if (!eggData) return;

    if (show) {
      // Add the property with a default value (using first valid option)
      const defaultValues = {
        secondary_color: SECONDARY_COLORS[0],
        special_mark: SPECIAL_MARKS[0],
        title: TITLES[0]
      };
      
      // Validate the default value before setting
      const defaultValue = defaultValues[property];
      if (property === 'secondary_color' && !(ALL_VALID_SECONDARY_COLORS as readonly string[]).includes(defaultValue)) {
        console.warn(`Invalid default secondary color: ${defaultValue}`);
        return;
      }
      
      updateProperty(property, defaultValue);
    } else {
      // Remove the property
      setEggData(prev => {
        if (!prev) return null;
        const newData = { ...prev };
        delete newData[property];
        return newData;
      });
    }

    // Update toggle state
    if (property === 'secondary_color') setShowSecondaryColor(show);
    if (property === 'special_mark') setShowSpecialMark(show);
    if (property === 'title') setShowTitle(show);
  };

  const getRarityInfo = (value: string, type: 'color' | 'size' | 'mark' | 'title') => {
    let rarity: string | null = null;
    let chance: string = '50%';

    switch (type) {
      case 'color':
        rarity = getColorRarity(value, 'base') || getColorRarity(value, 'secondary');
        chance = rarity === 'legendary' ? '5%' : rarity === 'rare' ? '15%' : rarity === 'uncommon' ? '30%' : '50%';
        break;
      case 'size':
        rarity = getSizeRarity(value);
        chance = rarity === 'legendary' ? '5%' : rarity === 'rare' ? '10%' : rarity === 'uncommon' ? '25%' : '60%';
        break;
      case 'mark':
        rarity = getSpecialMarkRarity(value);
        chance = rarity === 'legendary' ? '5%' : rarity === 'rare' ? '15%' : rarity === 'uncommon' ? '30%' : '50%';
        break;
      case 'title':
        rarity = getTitleRarity(value);
        chance = rarity === 'legendary' ? '5%' : rarity === 'rare' ? '15%' : rarity === 'uncommon' ? '30%' : '50%';
        break;
    }
    
    return { rarity: rarity || 'common', chance };
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
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <AppHeader 
            title="🥚 Blobbi Egg Demo"
            subtitle="Interactive demonstration of Blobbi egg generation and customization based on the blobbi-egg.md specification. This is a visual demo only - no events are published to Nostr."
          />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Visual Display */}
          <Card className="lg:sticky lg:top-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                🥚 Egg Visualization
                {eggData && <Badge variant="secondary">ID: {eggData.d}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-6">
              {eggData ? (
                <>
                  <div className="flex items-center justify-center min-h-[300px] p-8">
                    <BlobbiEggVisual
                      baseColor={eggData.base_color}
                      secondaryColor={eggData.secondary_color}
                      size={eggData.size}
                      pattern={eggData.pattern}
                      specialMark={eggData.special_mark}
                      eggStatus={eggData.egg_status}
                      shellIntegrity={parseInt(eggData.shell_integrity)}
                      incubationProgress={parseInt(eggData.incubation_progress)}
                      eggTemperature={parseInt(eggData.egg_temperature)}
                    />
                  </div>
                  
                  {/* Stats Display */}
                  <div className="w-full space-y-3">
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Current Stats</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex justify-between">
                        <span>Happiness:</span>
                        <Badge variant="outline">{eggData.happiness}/100</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Hygiene:</span>
                        <Badge variant="outline">{eggData.hygiene}/100</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Temperature:</span>
                        <Badge variant="outline">{eggData.egg_temperature}/100</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Shell Integrity:</span>
                        <Badge variant="outline">{eggData.shell_integrity}/100</Badge>
                      </div>
                    </div>
                    
                    {/* Incubation Progress */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Incubation Progress:</span>
                        <span>{eggData.incubation_progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${eggData.incubation_progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-600 dark:text-gray-400">
                  <Sparkles className="h-12 w-12 mb-4 opacity-50" />
                  <p>Generate or customize an egg to see the visualization</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Controls */}
          <div className="space-y-6">
            {/* Generation Controls */}
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <RefreshCw className="h-5 w-5" />
                  Generation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={generateRandomEgg}
                  className="w-full flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                  size="lg"
                >
                  <RefreshCw className="h-4 w-4" />
                  Generate Random Egg
                </Button>
              </CardContent>
            </Card>

            {eggData && (
              <>
                {/* Required Properties */}
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                      <Palette className="h-5 w-5" />
                      Required Properties
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Base Color */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        Base Color
                        {(() => {
                          const rarity = getRarityInfo(eggData.base_color, 'color');
                          return (
                            <Badge variant={getRarityBadgeVariant(rarity.rarity)} className="text-xs">
                              {rarity.rarity} ({rarity.chance})
                            </Badge>
                          );
                        })()}
                      </Label>
                      <Select value={eggData.base_color} onValueChange={(value) => updateProperty('base_color', value)}>
                        <SelectTrigger>
                          <SelectValue>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded border"
                                style={{ backgroundColor: eggData.base_color }}
                              />
                              {eggData.base_color}
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {BASE_COLORS.map((color) => {
                            const rarity = getRarityInfo(color, 'color');
                            return (
                              <SelectItem key={color} value={color}>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-4 h-4 rounded border"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span>{color}</span>
                                  <Badge variant={getRarityBadgeVariant(rarity.rarity)} className="text-xs ml-auto">
                                    {rarity.rarity}
                                  </Badge>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Size */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Ruler className="h-4 w-4" />
                        Size
                        {(() => {
                          const rarity = getRarityInfo(eggData.size, 'size');
                          return (
                            <Badge variant={getRarityBadgeVariant(rarity.rarity)} className="text-xs">
                              {rarity.rarity} ({rarity.chance})
                            </Badge>
                          );
                        })()}
                      </Label>
                      <Select value={eggData.size} onValueChange={(value) => updateProperty('size', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SIZES.map((size) => {
                            const rarity = getRarityInfo(size, 'size');
                            return (
                              <SelectItem key={size} value={size}>
                                <div className="flex items-center gap-2">
                                  <span className="capitalize">{size}</span>
                                  <Badge variant={getRarityBadgeVariant(rarity.rarity)} className="text-xs ml-auto">
                                    {rarity.rarity}
                                  </Badge>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Pattern */}
                    <div className="space-y-2">
                      <Label>Pattern</Label>
                      <Select value={eggData.pattern} onValueChange={(value) => updateProperty('pattern', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PATTERNS.map((pattern) => (
                            <SelectItem key={pattern} value={pattern}>
                              <span className="capitalize">{pattern}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Egg Status */}
                    <div className="space-y-2">
                      <Label>Egg Status</Label>
                      <Select value={eggData.egg_status} onValueChange={(value) => updateProperty('egg_status', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EGG_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              <span className="capitalize">{status}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Optional Properties */}
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                      <Star className="h-5 w-5" />
                      Optional Properties
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-300">
                      These properties have spawn chances and add rarity to your egg
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Secondary Color Toggle */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="secondary-color-toggle" className="flex items-center gap-2">
                          Secondary Color
                          <Badge variant="outline" className="text-xs">45% spawn chance</Badge>
                        </Label>
                        <Switch
                          id="secondary-color-toggle"
                          checked={showSecondaryColor}
                          onCheckedChange={(checked) => toggleOptionalProperty('secondary_color', checked)}
                        />
                      </div>
                      {showSecondaryColor && (
                        <Select value={eggData.secondary_color || ''} onValueChange={(value) => updateProperty('secondary_color', value)}>
                          <SelectTrigger>
                            <SelectValue>
                              {eggData.secondary_color && (
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-4 h-4 rounded border"
                                    style={{ backgroundColor: eggData.secondary_color }}
                                  />
                                  {eggData.secondary_color}
                                </div>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {SECONDARY_COLORS.map((color) => {
                              const rarity = getRarityInfo(color, 'color');
                              return (
                                <SelectItem key={color} value={color}>
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-4 h-4 rounded border"
                                      style={{ backgroundColor: color }}
                                    />
                                    <span>{color}</span>
                                    <Badge variant={getRarityBadgeVariant(rarity.rarity)} className="text-xs ml-auto">
                                      {rarity.rarity}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <Separator />

                    {/* Special Mark Toggle */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="special-mark-toggle" className="flex items-center gap-2">
                          Special Mark
                          <Badge variant="outline" className="text-xs">15% spawn chance</Badge>
                        </Label>
                        <Switch
                          id="special-mark-toggle"
                          checked={showSpecialMark}
                          onCheckedChange={(checked) => toggleOptionalProperty('special_mark', checked)}
                        />
                      </div>
                      {showSpecialMark && (
                        <Select value={eggData.special_mark || ''} onValueChange={(value) => updateProperty('special_mark', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SPECIAL_MARKS.map((mark) => {
                              const rarity = getRarityInfo(mark, 'mark');
                              return (
                                <SelectItem key={mark} value={mark}>
                                  <div className="flex items-center gap-2">
                                    <span className="capitalize">{mark.replace('_', ' ')}</span>
                                    <Badge variant={getRarityBadgeVariant(rarity.rarity)} className="text-xs ml-auto">
                                      {rarity.rarity}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <Separator />

                    {/* Title Toggle */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="title-toggle" className="flex items-center gap-2">
                          Title
                          <Badge variant="outline" className="text-xs">10% spawn chance</Badge>
                        </Label>
                        <Switch
                          id="title-toggle"
                          checked={showTitle}
                          onCheckedChange={(checked) => toggleOptionalProperty('title', checked)}
                        />
                      </div>
                      {showTitle && (
                        <Select value={eggData.title || ''} onValueChange={(value) => updateProperty('title', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TITLES.map((title) => {
                              const rarity = getRarityInfo(title, 'title');
                              return (
                                <SelectItem key={title} value={title}>
                                  <div className="flex items-center gap-2">
                                    <span>{title}</span>
                                    <Badge variant={getRarityBadgeVariant(rarity.rarity)} className="text-xs ml-auto">
                                      {rarity.rarity}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Specification Info */}
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
                  <CardHeader>
                    <CardTitle className="text-sm text-gray-900 dark:text-gray-100">Specification Compliance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <p>✅ Follows exact blobbi-egg.md specification</p>
                      <p>✅ Rarity system with weighted probabilities</p>
                      <p>✅ Optional traits with correct spawn chances</p>
                      <p>✅ Ready for Nostr Kind 31124 event publishing</p>
                      <p>⚠️ This is a visual demo only - no events are published</p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}