// What the Grid's tiles and the item sheet share: the default rarity and a piece's slot label.

import { SCREEN_STRINGS } from '../../strings/screens.js';

const G = SCREEN_STRINGS.inventory.gear;
export const COMMON = 'common';

export const slotLabel = (item, row) => {
    const place = row?.place || row?.slotKey || item.slot || '';
    return place ? (G.slots[place] ?? place) : '';
};
