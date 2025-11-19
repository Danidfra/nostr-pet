import { cn } from '@/lib/utils';
import { EggGraphic } from '@/components/blobbi/EggGraphic';
import { Blobbi } from '@/types/blobbi';
import { isValidBaseColor, isValidSecondaryColor } from '@/lib/blobbi-egg-validation';

interface BlobbiEggVisualProps {
  baseColor: string;
  secondaryColor?: string;
  size: string;
  pattern: string;
  specialMark?: string;
  eggStatus: string;
  shellIntegrity: number;
  incubationProgress: number;
  eggTemperature: number;
  className?: string;
  theme?: string;
  crossoverApp?: string;
}

export function BlobbiEggVisual({
  baseColor,
  secondaryColor,
  size,
  pattern,
  specialMark,
  eggStatus,
  shellIntegrity,
  incubationProgress,
  eggTemperature,
  className,
  theme,
  crossoverApp
}: BlobbiEggVisualProps) {
  // Validate colors before creating mock Blobbi object
  const validBaseColor = isValidBaseColor(baseColor) ? baseColor : '#ffffff'; // fallback to common white
  const validSecondaryColor = secondaryColor && isValidSecondaryColor(secondaryColor) ? secondaryColor : undefined;

  // Create a mock Blobbi object with egg properties to pass to EggGraphic
  const mockBlobbi: Partial<Blobbi> = {
    id: 'demo-egg',
    lifeStage: 'egg',
    baseColor: validBaseColor,
    secondaryColor: validSecondaryColor,
    size: size as 'tiny' | 'small' | 'medium' | 'large',
    pattern,
    specialMark: specialMark || undefined,
    eggStatus,
    shellIntegrity,
    incubationProgress,
    eggTemperature,
    state: 'active',
    themeVariant: theme,
    crossoverApp: crossoverApp
  };

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <EggGraphic
        blobbi={mockBlobbi as Blobbi}
        size={size as 'tiny' | 'small' | 'medium' | 'large'}
        animated={eggStatus === 'pulsing'}
        cracking={eggStatus === 'cracking'}
        warmth={eggTemperature}
      />
    </div>
  );
}