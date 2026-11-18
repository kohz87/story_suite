// Composes the Bag tab: Purse with party load and Assets side by side when wide, the loot To pick up, then the Items card.
import { h } from '../../kit/dom.js';
import { purseCard } from './purse-load.js';
import { assetsCard } from './assets.js';
import { itemsCard } from './item-grid.js';
import { itemSheet } from './item-sheet.js';
import { itemAddForm } from './item-add.js';
import { lootCard } from './loot-card.js';

/** Builds the Bag tab from a `bag` view-model; ctx = { prefs, port, members, openSheet(el, label), close() }. Empty cards are left out. */
export function bagTab(bag = {}, ctx = {}) {
  const sheetCtx = { ...ctx, rpg: Boolean(bag.rpg) };
  const full = {
    ...sheetCtx,
    onItem: item => ctx.openSheet?.(itemSheet(item, sheetCtx), item.name),
    // + Add: the form in a sheet; the engine takes it as the reader's own item (inventory.add) and the sheet closes.
    onAdd: () => ctx.openSheet?.(itemAddForm({
      onCancel: () => ctx.close?.(),
      onSave: async payload => {
        const result = await ctx.port?.command('inventory.add', payload);
        if (!result || result.ok !== false) ctx.close?.();
        return result;
      },
    }), 'Add an item'),
  };
  const top = [bag.purse ? purseCard(bag, sheetCtx) : null, assetsCard(bag, sheetCtx)];
  return h(
    'div',
    { class: 'bag-tab', dataset: { tab: 'bag' } },
    h('div', { class: 'btop' }, top),
    lootCard(bag, sheetCtx),
    itemsCard(bag, full),
  );
}
