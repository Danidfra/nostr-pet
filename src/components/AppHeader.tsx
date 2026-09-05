import { Link } from 'react-router-dom';
import { AccountMenu } from './auth/AccountMenu';
import { ThemeToggle } from './ThemeToggle';

/** Logo left, account right. Adapted from the pre-nuke GlobalHeader. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 transition hover:opacity-80" aria-label="Blobbi home">
          <img src="/blobbilogo.svg" alt="Blobbi" className="h-9 w-auto sm:h-10" />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
