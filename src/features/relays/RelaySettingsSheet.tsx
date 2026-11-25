/**
 * The relay settings, one screen over the home (`relay-settings.ts` for the
 * rules). Plain for a player: which relays keep their Blobbi, whether they
 * are connected, a few of their own to add. Enough for a Nostr user: the
 * addresses, read and send apart, their NIP-65 list to pick from (read
 * only). Nothing here publishes anything, and sending to a relay is always
 * its own, confirmed choice.
 */
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { GameOverlay } from '@/features/home/shell/GameOverlay';
import { useRelayHealth } from '@/hooks/useRelayHealth';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { MAX_EXTRA_RELAYS, PRIMARY_RELAY, normalizeRelayUrl } from '@/config/relays';
import type { RelayMark } from '@/lib/relay-health';
import { t } from '@/i18n';
import {
  DEFAULT_RELAY_SETTINGS,
  ESSENTIAL_RELAYS,
  addExtraRelay,
  parseRelayList,
  readRelaySettings,
  removeExtraRelay,
  setExtraAccess,
  subscribeRelaySettings,
  writeRelaySettings,
  type ExtraRelaySetting,
  type Nip65Relay,
} from './relay-settings';

const host = (url: string) => url.replace(/^wss:\/\//, '');
const NIP65_TIMEOUT_MS = 6_000;

function StatusDot({ mark }: { mark: RelayMark | 'idle' }) {
  const tone = mark === 'ok' ? 'bg-emerald-500' : mark === 'failing' ? 'bg-rose-500' : 'bg-muted-foreground/40';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" data-mark={mark}>
      <span className={`inline-block h-2 w-2 rounded-full ${tone}`} aria-hidden />
      {t(`relays.status.${mark}`)}
    </span>
  );
}

function Switch({ on, label, onChange, testId }: { on: boolean; label: string; onChange: (on: boolean) => void; testId: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} data-testid={testId} className="inline-flex min-h-10 items-center gap-2 rounded-full px-2 text-sm">
      <span className="menu-switch" aria-hidden data-on={on ? 'true' : 'false'} />
      {label}
    </button>
  );
}

type Nip65State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; relays: Nip65Relay[] };

export function RelaySettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSyncExternalStore(subscribeRelaySettings, readRelaySettings, () => DEFAULT_RELAY_SETTINGS);
  const { health } = useRelayHealth();
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const [input, setInput] = useState('');
  const [note, setNote] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [nip65, setNip65] = useState<Nip65State>({ kind: 'idle' });

  const essentialMark = (url: string): RelayMark => health.relays[url] ?? 'unknown';
  const extraMark = (e: ExtraRelaySetting): RelayMark | 'idle' => (!e.read && !e.write ? 'idle' : health.extras[e.url] ?? 'unknown');

  const add = (raw: string, source: ExtraRelaySetting['source'] = 'manual') => {
    const out = addExtraRelay(readRelaySettings(), raw, source);
    if (!out.ok) {
      setNote({ tone: 'error', text: t(`relays.error.${out.reason}`, { max: MAX_EXTRA_RELAYS }) });
      return false;
    }
    writeRelaySettings(out.settings);
    setNote({ tone: 'ok', text: t('relays.add.added') });
    return true;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (add(input)) setInput('');
  };

  const setWrite = (url: string, on: boolean) => {
    // Sending is never turned on in one tap: the player reads what it means first
    if (on) setConfirming(url);
    else writeRelaySettings(setExtraAccess(readRelaySettings(), url, { write: false }));
  };

  const findRelayList = async () => {
    if (!user) return;
    setNip65({ kind: 'loading' });
    try {
      const events: NostrEvent[] = await nostr.query([{ kinds: [10002], authors: [user.pubkey], limit: 1 }], { signal: AbortSignal.timeout(NIP65_TIMEOUT_MS) });
      const newest = events.filter((e) => e.pubkey === user.pubkey).sort((a, b) => b.created_at - a.created_at)[0];
      setNip65({ kind: 'loaded', relays: parseRelayList(newest) });
    } catch {
      setNip65({ kind: 'failed' });
    }
  };

  const known = new Set([...ESSENTIAL_RELAYS, ...settings.extras.map((e) => e.url)]);
  const offered = nip65.kind === 'loaded' ? nip65.relays.filter((r) => !known.has(r.url)) : [];
  const connected = ESSENTIAL_RELAYS.filter((u) => essentialMark(u) === 'ok').length + settings.extras.filter((e) => extraMark(e) === 'ok').length;

  return (
    <GameOverlay open={open} onClose={onClose} title={t('relays.title')} subtitle={t('relays.tile.sub', { connected, total: ESSENTIAL_RELAYS.length + settings.extras.length })} testId="relay-settings" size="medium">
      <div className="menu">
        <p className="menu-section__hint">{t('relays.intro')}</p>

        <section className="menu-section" aria-labelledby="relays-essential" data-testid="relays-essential">
          <h3 id="relays-essential" className="menu-section__title">
            {t('relays.essential.title')}
          </h3>
          <p className="menu-section__hint">{t('relays.essential.hint')}</p>
          <ul className="flex flex-col gap-1">
            {ESSENTIAL_RELAYS.map((url) => (
              <li key={url} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-foreground/5 px-3 py-2" data-testid={`relay-essential-${host(url)}`}>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{url === normalizeRelayUrl(PRIMARY_RELAY) ? t('relays.essential.primary') : t('relays.essential.network')}</span>
                  <span className="block break-all font-mono text-xs text-muted-foreground">{host(url)}</span>
                </span>
                <StatusDot mark={essentialMark(url)} />
              </li>
            ))}
          </ul>
        </section>

        <section className="menu-section" aria-labelledby="relays-extras" data-testid="relays-extras">
          <h3 id="relays-extras" className="menu-section__title">
            {t('relays.extras.title')} <span className="font-normal text-muted-foreground">{t('relays.extras.count', { count: settings.extras.length, max: MAX_EXTRA_RELAYS })}</span>
          </h3>
          <p className="menu-section__hint">{t('relays.extras.hint')}</p>
          {settings.extras.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('relays.extras.empty')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {settings.extras.map((e) => (
                <li key={e.url} className="rounded-lg bg-foreground/5 px-3 py-2" data-testid={`relay-extra-${host(e.url)}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 break-all font-mono text-xs">{host(e.url)}</span>
                    <button type="button" onClick={() => writeRelaySettings(removeExtraRelay(readRelaySettings(), e.url))} aria-label={t('relays.remove', { relay: host(e.url) })} className="touch-hit rounded-full p-2" data-testid={`relay-remove-${host(e.url)}`}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2">
                    <Switch on={e.read} label={t('relays.access.read')} onChange={(on) => writeRelaySettings(setExtraAccess(readRelaySettings(), e.url, { read: on }))} testId={`relay-read-${host(e.url)}`} />
                    <Switch on={e.write} label={t('relays.access.write')} onChange={(on) => setWrite(e.url, on)} testId={`relay-write-${host(e.url)}`} />
                    <StatusDot mark={extraMark(e)} />
                  </div>
                  {confirming === e.url && (
                    <div role="alertdialog" aria-labelledby={`confirm-${host(e.url)}`} className="mt-2 rounded-lg border border-foreground/15 p-3" data-testid="relay-confirm-write">
                      <p id={`confirm-${host(e.url)}`} className="text-sm font-semibold">
                        {t('relays.confirmWrite.title', { relay: host(e.url) })}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{t('relays.confirmWrite.body')}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="menu-tile menu-tile--on min-h-10 px-3 py-1 text-sm"
                          onClick={() => {
                            writeRelaySettings(setExtraAccess(readRelaySettings(), e.url, { write: true }));
                            setConfirming(null);
                          }}
                          data-testid="relay-confirm-allow"
                        >
                          {t('relays.confirmWrite.allow')}
                        </button>
                        <button type="button" className="menu-tile min-h-10 px-3 py-1 text-sm" onClick={() => setConfirming(null)} data-testid="relay-confirm-cancel">
                          {t('relays.confirmWrite.cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={submit} className="mt-2 flex gap-2" data-testid="relay-add-form">
            <label className="sr-only" htmlFor="relay-add-input">
              {t('relays.add.label')}
            </label>
            <input
              id="relay-add-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('relays.add.placeholder')}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-base"
              data-testid="relay-add-input"
            />
            <button type="submit" disabled={!input.trim() || settings.extras.length >= MAX_EXTRA_RELAYS} className="menu-tile min-h-10 shrink-0 px-3 py-1" data-testid="relay-add">
              <Plus className="h-4 w-4" aria-hidden />
              {t('relays.add.button')}
            </button>
          </form>
          {note && (
            <p role={note.tone === 'error' ? 'alert' : 'status'} className={`mt-1 text-xs ${note.tone === 'error' ? 'text-rose-700 dark:text-rose-300' : 'text-muted-foreground'}`} data-testid="relay-note">
              {note.text}
            </p>
          )}
        </section>

        {user && (
          <section className="menu-section" aria-labelledby="relays-nip65" data-testid="relays-nip65">
            <h3 id="relays-nip65" className="menu-section__title">
              {t('relays.nip65.title')}
            </h3>
            <p className="menu-section__hint">{t('relays.nip65.hint')}</p>
            {nip65.kind === 'idle' || nip65.kind === 'failed' ? (
              <>
                <button type="button" onClick={() => void findRelayList()} className="menu-tile min-h-10 px-3 py-1 text-sm" data-testid="relay-nip65-find">
                  {t('relays.nip65.button')}
                </button>
                {nip65.kind === 'failed' && (
                  <p role="alert" className="mt-1 text-xs text-rose-700 dark:text-rose-300">
                    {t('relays.nip65.failed')}
                  </p>
                )}
              </>
            ) : nip65.kind === 'loading' ? (
              <p role="status" className="text-sm text-muted-foreground">
                {t('relays.nip65.loading')}
              </p>
            ) : offered.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="relay-nip65-none">
                {t('relays.nip65.none')}
              </p>
            ) : (
              <ul className="flex flex-col gap-1" data-testid="relay-nip65-list">
                {offered.map((r) => (
                  <li key={r.url} className="flex items-center justify-between gap-2 rounded-lg bg-foreground/5 px-3 py-1">
                    <span className="min-w-0 break-all font-mono text-xs">{host(r.url)}</span>
                    <button type="button" onClick={() => add(r.url, 'nip65')} disabled={settings.extras.length >= MAX_EXTRA_RELAYS} aria-label={t('relays.nip65.add', { relay: host(r.url) })} className="touch-hit rounded-full p-2" data-testid={`relay-nip65-add-${host(r.url)}`}>
                      <Plus className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {settings.extras.length > 0 && (
          <button
            type="button"
            onClick={() => {
              writeRelaySettings(DEFAULT_RELAY_SETTINGS);
              setConfirming(null);
              setNote({ tone: 'ok', text: t('relays.restore.done') });
            }}
            className="menu-tile min-h-10 px-3 py-1 text-sm"
            data-testid="relay-restore"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {t('relays.restore.button')}
          </button>
        )}
      </div>
    </GameOverlay>
  );
}
