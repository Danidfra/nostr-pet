import { LogOut } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoginActions } from '@/hooks/useLoginActions';
import { shortNpub } from '@/lib/format';

/** Who is signed in, and the way out. Adapted from the pre-nuke account dropdown. */
export function AccountMenu() {
  const { user, metadata } = useCurrentUser();
  const { logout } = useLoginActions();

  if (!user) return null;

  const label = metadata?.display_name || metadata?.name || shortNpub(user.pubkey);

  return (
    <div className="flex items-center gap-2">
      {metadata?.picture ? (
        <img src={metadata.picture} alt="" className="h-8 w-8 rounded-full object-cover" />
      ) : (
        <span aria-hidden className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400" />
      )}
      <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline" title={shortNpub(user.pubkey)}>
        {label}
      </span>
      <button
        type="button"
        onClick={logout}
        className="inline-flex h-9 items-center gap-1 rounded-full border border-border bg-card/80 px-3 text-xs font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </button>
    </div>
  );
}
