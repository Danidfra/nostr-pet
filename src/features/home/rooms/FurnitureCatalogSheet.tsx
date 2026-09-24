import { Sheet } from '@/features/home/shell/Sheet';
import { FURNITURE_CATEGORY_LABEL, furnitureForRoom, type FurnitureCategory } from './furniture-registry';
import type { RoomDefinition } from './rooms';

const ORDER: readonly FurnitureCategory[] = ['furniture', 'rugs', 'plants', 'lights', 'decor', 'clocks'];

/** The catalog, per room: only what may stand here, grouped. Tapping adds the piece and closes. */
export function FurnitureCatalogSheet({ open, onClose, room, onAdd }: { open: boolean; onClose: () => void; room: RoomDefinition; onAdd: (id: string) => boolean }) {
  const available = furnitureForRoom(room.id);
  return (
    <Sheet open={open} onClose={onClose} title="Add furniture" testId="catalog-sheet">
      <div className="flex flex-col gap-4">
        {ORDER.map((category) => {
          const items = available.filter((d) => d.category === category);
          if (items.length === 0) return null;
          return (
            <section key={category} aria-label={FURNITURE_CATEGORY_LABEL[category]} className="flex flex-col gap-2">
              <h3 className="text-sm font-bold">{FURNITURE_CATEGORY_LABEL[category]}</h3>
              <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5" role="list">
                {items.map((def) => (
                  <li key={def.id}>
                    <button
                      type="button"
                      className="item-tile"
                      onClick={() => {
                        if (onAdd(def.id)) onClose();
                      }}
                      aria-label={`Add ${def.label}`}
                      data-testid={`catalog-${def.id}`}
                    >
                      <span className="catalog-art">
                        <img src={def.asset} alt="" draggable={false} loading="lazy" />
                      </span>
                      <span className="item-tile__name">{def.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Sheet>
  );
}
