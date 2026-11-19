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
    // + Add: the form in a sheet; the engine takes it as the reader's own item (inventory.add) and the sheet closes. After the starting kit a stat pick the add
    // cannot carry goes to the new piece as the repoint edit (inventory.edit { stack, stats }), and Carries as inventory.carry; a refusal of either keeps the
    // sheet open and says the piece was added.
    onAdd: () => ctx.openSheet?.(itemAddForm({
      gear: bag.gear ?? null,
      onCancel: () => ctx.close?.(),
      onSave: async (payload, repoint, carry) => {
        const result = await ctx.port?.command('inventory.add', payload);
        const stack = result?.receipt?.data?.stacks?.[0];
        const added = Boolean(result && result.ok !== false && stack);
        const moved = added && repoint ? await ctx.port?.command('inventory.edit', { stack, stats: repoint }) : null;
        if (moved && moved.ok === false) return { ...moved, message: `Added with its default stats. ${moved.message ?? ''}`.trim() };
        const carried = added && carry ? await ctx.port?.command('inventory.carry', { stack, carry }) : null;
        if (carried && carried.ok === false) return { ...carried, message: `Added without its Carries. ${carried.message ?? ''}`.trim() };
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
