import { Link } from 'react-router-dom';
import { AccountMenu } from './auth/AccountMenu';
import { ThemePicker } from '@/theme';

/** Logo left; theme and account right. Adapted from the pre-nuke GlobalHeader. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-14 items-center justify-between sm:h-16">
        <Link to="/" className="flex items-center gap-2 transition hover:opacity-80" aria-label="Blobbi home">
          <img src="/blobbilogo.svg" alt="Blobbi" className="h-8 w-auto sm:h-10" />
        </Link>
        <div className="flex items-center gap-2">
          <ThemePicker />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
