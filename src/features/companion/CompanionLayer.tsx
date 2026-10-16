/**
 * What the player is told about their companion and the other Blobbi games,
 * above every page (beside the guest's layers), in a child's words:
 *
 *  - nothing while it works, and nothing for a choice that simply lives on
 *    this device (a player with no profile yet);
 *  - a small card with Try again when a choice made here could not be shared
 *    yet (offline, a slow connection, a sign-in app that said no); it can be
 *    put away, and comes back only if something new goes wrong;
 *  - a question, when this device's choice and one made in another game are
 *    too close in time to tell which came last: which Blobbi should it be?
 *    Closing it is not an answer (asked again next visit; nothing written).
 *
 * No protocol words: no "profile", "relay", "event", "kind" or "d-tag".
 */
import { useContext, useEffect, useMemo, useState } from 'react';
import { NostrContext } from '@nostrify/react';
import { BlobbiRenderer } from '@blobbi-kit/renderer';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { CloudOff, RefreshCw, X } from 'lucide-react';
import { useHomeBlobbi } from '@/hooks/useHomeBlobbi';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { GameOverlay } from '@/features/home/shell/GameOverlay';
import { syncNote } from './sync-note';

/** Nothing without the relays' provider (a router rendered on its own, a test): the layer is the signed-in home's. */
export function CompanionLayer() {
  const nostr = useContext(NostrContext);
  return nostr?.nostr ? <CompanionLayerInner /> : null;
}

function CompanionLayerInner() {
  const home = useHomeBlobbi();
  const companion = home.companion;
  const byD = useMemo(() => new Map(home.companions.map((c) => [c.d, c])), [home.companions]);
  const ready = home.status === 'ready' && !!companion;
  const status = companion?.status ?? { kind: 'idle' as const };
  const name = home.current?.name || 'your Blobbi';
  const note = ready ? syncNote(status, name) : null;

  // On its way (sent, a retry scheduled): said, with no Try again; a failure the player must act on keeps it
  const onItsWay = status.kind === 'waiting' && status.reason === 'partial' && !!status.retrying;
  // Put away: hidden until the next problem (a new status), never forever
  const statusKey = status.kind === 'waiting' ? `${status.reason}:${onItsWay ? 'on-its-way' : ''}:${home.current?.d ?? ''}` : status.kind;
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    if (status.kind !== 'waiting') setDismissed(null);
  }, [status.kind]);

  // Closing the question is not an answer: it goes for this visit, nothing is written, this device's Blobbi stays
  const [later, setLater] = useState<string | null>(null);
  const asked = ready ? companion!.ambiguity : null;
  const askKey = asked ? `${asked.local}|${asked.global}` : null;
  const ambiguity = asked && later !== askKey ? asked : null;
  const here = ambiguity ? byD.get(ambiguity.local) : undefined;
  const there = ambiguity ? byD.get(ambiguity.global) : undefined;

  return (
    <>
      {note && dismissed !== statusKey && !ambiguity && (
        <div className="chapter-toast chapter-toast--still companion-note" role="status" aria-live="polite" data-testid="companion-note" data-reason={status.kind === 'waiting' ? status.reason : undefined} data-state={onItsWay ? 'on-its-way' : 'waiting'}>
          {onItsWay ? <RefreshCw className="chapter-toast__icon companion-note__icon animate-spin" aria-hidden /> : <CloudOff className="chapter-toast__icon companion-note__icon" aria-hidden />}
          <span className="chapter-toast__text">
            <span className="companion-note__text">{note}</span>
          </span>
          {!onItsWay && (
            <button type="button" className="chapter-toast__ok" onClick={() => companion!.retry()} data-testid="companion-retry">
              <RefreshCw className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              Try again
            </button>
          )}
          <button type="button" className="companion-note__close" onClick={() => setDismissed(statusKey)} aria-label="Not now" data-testid="companion-note-close">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
      {ambiguity && here && there && (
        <GameOverlay open onClose={() => setLater(askKey)} title="Who's your companion?" testId="companion-choice" size="medium">
          <div className="space-y-3 text-sm">
            <p data-testid="companion-choice-text">
              You picked {here.name || 'a Blobbi'} here, and {there.name || 'another Blobbi'} in another Blobbi game, at almost the same time. Who should come along?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <ChoiceButton blobbi={here} onClick={() => companion!.resolve('local')} testId="companion-choice-local" />
              <ChoiceButton blobbi={there} onClick={() => companion!.resolve('global')} testId="companion-choice-global" />
            </div>
          </div>
        </GameOverlay>
      )}
    </>
  );
}

function ChoiceButton({ blobbi, onClick, testId }: { blobbi: BlobbiCompanion; onClick: () => void; testId: string }) {
  return (
    <button type="button" className="onboard-btn onboard-btn--secondary companion-choice__btn" onClick={onClick} data-testid={testId}>
      <span className="overlay-portrait" aria-hidden>
        <BlobbiRenderer visual={toBlobbiVisual(blobbi)} instanceId={`companion-choice-${blobbi.d}`} size="100%" transparent style={{ width: '100%', height: '100%' }} />
      </span>
      <span>{blobbi.name || 'Blobbi'}</span>
    </button>
  );
}
