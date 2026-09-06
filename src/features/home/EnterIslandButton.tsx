import { Map as MapIcon } from 'lucide-react';
import { BLOBBI_ISLAND_URL } from '@/config/ecosystem';

interface EnterIslandButtonProps {
  variant?: 'primary' | 'secondary';
}

/**
 * The way out into the world. Blobbi Island is an independent app; it opens
 * in a new tab and shares only the player's Nostr identity and events.
 */
export function EnterIslandButton({ variant = 'primary' }: EnterIslandButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const look =
    variant === 'primary'
      ? 'bg-primary text-primary-foreground hover:brightness-110'
      : 'home-glass text-foreground hover:bg-accent';

  return (
    <a
      href={BLOBBI_ISLAND_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${look}`}
      data-testid="enter-island"
    >
      <MapIcon className="h-4 w-4" />
      Enter Blobbi Island
    </a>
  );
}
