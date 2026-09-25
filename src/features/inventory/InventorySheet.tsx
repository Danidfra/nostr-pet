import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { GameOverlay } from '@/features/home/shell/GameOverlay';
import { BLOBBI_ISLAND_URL } from '@/config/ecosystem';
import { ItemGlyph } from './ItemGlyph';
import { describeItemUse, shelfFor, SHELF_LABEL, SHELF_ORDER, type HomeItem, type ItemShelf } from './item-model';
import type { HomeInventory, HomeInventoryItem, HomeInventorySection } from './useHomeInventory';

interface InventorySheetProps {
  open: boolean;
  onClose: () => void;
  inventory: HomeInventory;
  blobbiName: string;
  /** The player chose to use this item: the screen closes and the home takes over. */
  onUse: (entry: HomeInventoryItem) => void;
  /** An earlier use is waiting to be finished; the Use button says so. */
  openUse?: boolean;
  /** A use is running right now. */
  busy?: boolean;
  /** Addresses currently worn (equipped on the Island), shown as such. */
  worn?: ReadonlySet<string>;
}

type Tab = 'all' | ItemShelf;
const KIND_WORD: Record<HomeItem['kind'], string> = { care: 'Consumable', cosmetic: 'Cosmetic', currency: 'Currency', unknown: 'Unknown' };

/**
 * The player's items as a game inventory screen: a header with the count, a
 * row of shelves that exist in the data (All, then Food, Drinks, Toys, Care,
 * Cosmetics, Other only when something is on them), a responsive grid of
 * tiles grouped by the game that owns the balance, and one detail card for
 * the selected tile that says what it is, how many, where it came from, and
 * whether THIS Blobbi can use it now. Equipping and trading stay on the
 * Island; the fast path for care is the strip above the verbs.
 */
export function InventorySheet({ open, onClose, inventory, blobbiName, onUse, openUse = false, busy = false, worn }: InventorySheetProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  useEffect(() => {
    if (!open) {
      setSelected(null);
      setTab('all');
    }
  }, [open]);

  const shelves = useMemo(() => {
    const present = new Set(inventory.items.map((i) => shelfFor(i.item)));
    return SHELF_ORDER.filter((s) => present.has(s));
  }, [inventory.items]);
  useEffect(() => {
    if (tab !== 'all' && !shelves.includes(tab)) setTab('all');
  }, [tab, shelves]);

  const entry = selected ? inventory.items.find((i) => `${i.inventoryAddress}|${i.item.address}` === selected) : undefined;
  const total = inventory.items.reduce((n, i) => n + i.quantity, 0);
  const visibleSections = inventory.sections.map((s) => ({ ...s, items: tab === 'all' ? s.items : s.items.filter((i) => shelfFor(i.item) === tab) })).filter((s) => s.items.length > 0);

  const tabs = inventory.status === 'ready' && inventory.items.length > 0 && (
    <div role="tablist" aria-label="Shelves" className="inv-tabs" data-testid="inventory-tabs">
      {(['all', ...shelves] as Tab[]).map((t) => (
        <button key={t} type="button" role="tab" aria-selected={tab === t} className={`inv-tab ${tab === t ? 'inv-tab--on' : ''}`} onClick={() => setTab(t)} data-testid={`inventory-tab-${t}`}>
          {t === 'all' ? 'All' : SHELF_LABEL[t]}
        </button>
      ))}
    </div>
  );

  return (
    <GameOverlay open={open} onClose={onClose} title="Items" testId="inventory-sheet" subtitle={inventory.status === 'ready' ? <span data-testid="inventory-count">{total === 0 ? 'Nothing yet' : `${total} item${total === 1 ? '' : 's'} for ${blobbiName}`}</span> : undefined} toolbar={tabs || undefined}>
      <div className="flex flex-col gap-4">
        {inventory.status === 'loading' && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="inventory-loading">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Looking for your items…
          </p>
        )}
        {inventory.status === 'error' && (
          <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" data-testid="inventory-error">
            Could not read your inventories right now.{' '}
            <button type="button" className="font-semibold underline" onClick={inventory.refresh}>
              Try again
            </button>
          </p>
        )}
        {inventory.status === 'ready' && inventory.items.length === 0 && (
          <div className="overlay-card text-center" data-testid="inventory-empty">
            <p className="text-sm font-semibold">Nothing here yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Items you earn on Blobbi Island or grow on the Farm show up here, ready for {blobbiName}.</p>
            <a href={BLOBBI_ISLAND_URL} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline">
              Visit the Island <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        )}

        {visibleSections.map((section) => (
          <SectionView key={section.inventoryAddress} section={section} selected={selected} onSelect={setSelected} worn={worn} />
        ))}

        {entry && (
          <div className="inv-detail" data-testid="inventory-detail">
            <div className="flex items-start gap-3">
              <ItemGlyph glyph={entry.item.glyph} size="3rem" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold">{entry.item.name}</p>
                <p className="text-xs text-muted-foreground">
                  ×{entry.quantity} · {entry.source.label} · {KIND_WORD[entry.item.kind]}
                  {entry.item.equippable ? (worn?.has(entry.item.address) ? ' · Worn' : ' · Equip on the Island') : ''}
                </p>
                {entry.item.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{entry.item.description}</p>}
                <p className="mt-1 text-sm" data-testid="inventory-detail-note">
                  {entry.unverified ? "This inventory's balance can't be verified right now." : entry.usability.ok ? describeItemUse(entry.item, blobbiName) : entry.usability.reason}
                </p>
              </div>
            </div>
            {entry.usability.ok && !entry.unverified && (
              <div className="mt-3 flex items-center justify-end gap-2">
                <button type="button" className="lifecycle-pill !animate-none" disabled={busy} onClick={() => onUse(entry)} data-testid="inventory-use">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {openUse ? 'Finish earlier use' : `Use ${entry.item.name}`}
                </button>
              </div>
            )}
          </div>
        )}

        {inventory.status === 'ready' && (
          <p className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <span>Balances come from the games that own them; using an item records a spend.</span>
            <button type="button" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-semibold hover:bg-foreground/5" onClick={inventory.refresh} aria-label="Refresh items" data-testid="inventory-refresh">
              <RefreshCw className={`h-3.5 w-3.5 ${inventory.isRefreshing ? 'animate-spin' : ''}`} aria-hidden />
            </button>
          </p>
        )}
      </div>
    </GameOverlay>
  );
}

function SectionView({ section, selected, onSelect, worn }: { section: HomeInventorySection; selected: string | null; onSelect: (key: string) => void; worn?: ReadonlySet<string> }) {
  return (
    <section aria-label={section.source.label} data-testid={`inventory-source-${section.source.id}`} className="flex flex-col gap-2">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-bold">{section.source.label}</h3>
        {section.resolution !== 'resolved' && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300" data-testid="inventory-unverified">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Balance unverified
          </span>
        )}
      </header>
      <ul className="inv-grid" role="list">
        {section.items.map((entry) => {
          const key = `${entry.inventoryAddress}|${entry.item.address}`;
          const usable = entry.usability.ok && !entry.unverified;
          return (
            <li key={key}>
              <button
                type="button"
                className={`item-tile ${selected === key ? 'item-tile--selected' : ''} ${usable ? '' : 'item-tile--muted'}`}
                aria-pressed={selected === key}
                aria-label={`${entry.item.name}, ${entry.quantity}${usable ? '' : `, ${entry.unverified ? 'balance unverified' : entry.usability.reason ?? 'not usable'}`}`}
                onClick={() => onSelect(key)}
                data-testid={`inventory-item-${entry.item.itemId}`}
                data-usable={usable ? 'true' : 'false'}
                data-shelf={shelfFor(entry.item)}
              >
                <ItemGlyph glyph={entry.item.glyph} size="2.4rem" />
                {worn?.has(entry.item.address) && (
                  <span className="item-tile__worn" data-testid="item-worn">
                    Worn
                  </span>
                )}
                <span className="item-tile__name">{entry.item.name}</span>
                <span className="item-tile__count" aria-hidden>
                  ×{entry.quantity}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
