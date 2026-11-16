// One item as a square tile, and the tile grid of a list of items.

import { SCREEN_STRINGS } from '../../../../../../core/strings/screens.js';
import { h } from '../../view/widgets/dom.js';
import { COMMON, slotLabel } from './shared-gear.js';

const S = SCREEN_STRINGS.inventory;
const G = S.gear;
const NOT_GOOD = Object.freeze(['worn', 'torn', 'broken']);

/** One item as a square tile (a button). Gear shows its slot and its bonus; a stack its count; a piece not in good condition an amber dot
 *  (its word is the title); a bound piece a lock. `row` is the item's `q.gx.rows[stack]` (null with Gear in fights off). */
export function itemTile(doc, item, row = null, { onOpen } = {}) {
    const rarity = item.rarity || COMMON;
    const bonus = row?.bonus || '';
    const word = row?.word || '';
    const bound = item.bound != null || row?.bound != null;
    const tile = h(doc, 'button', `tile r-${rarity}`);
    tile.setAttribute('type', 'button');
    tile.setAttribute('data-stack', String(item.stack));
    tile.setAttribute('aria-label', [item.name, S.rarities[rarity], bonus, item.qty != 1 ? `×${item.qty}` : ''].filter(Boolean).join(' · '));
    const slot = slotLabel(item, row);
    if (slot) tile.append(h(doc, 'span', 'sl', slot));
    if (item.qty != 1) tile.append(h(doc, 'span', 'q', `×${item.qty}`));
    if (NOT_GOOD.includes(word)) {
        const dot = h(doc, 'span', `dot cond-${word}`);
        dot.setAttribute('title', G.words[word]);
        tile.append(dot);
    }
    if (bound) {
        const lock = h(doc, 'i', 'fa-solid fa-lock lock');
        lock.setAttribute('aria-hidden', 'true');
        lock.setAttribute('title', G.bound);
        tile.append(lock);
    }
    tile.append(h(doc, 'span', 'nm', item.name));
    if (bonus) tile.append(h(doc, 'span', 'bn', bonus));
    if (onOpen) tile.addEventListener('click', () => onOpen(item, tile));
    return tile;
}

/** The tiles of a list of items, in the order given; the CSS fits four to a line on a narrow screen and more on a wide one. */
export function tileGrid(doc, items, { rows = null, onOpen } = {}) {
    const list = h(doc, 'ul', 'tile-grid');
    list.setAttribute('aria-label', S.tilesLabel);
    for (const item of items) {
        const cell = h(doc, 'li', 'tile-cell');
        cell.append(itemTile(doc, item, rows?.[item.stack] ?? null, { onOpen }));
        list.append(cell);
    }
    return list;
}
