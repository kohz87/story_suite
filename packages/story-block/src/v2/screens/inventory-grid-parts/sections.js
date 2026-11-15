// The Grid view's category sections and the Worn view's one fold per wearer.

import { SCREEN_STRINGS } from '../../strings/screens.js';
import { fill } from '../../strings.js';
import { h } from '../../view/widgets/dom.js';
import { foldSection } from './folds.js';
import { tileGrid } from './tiles.js';

const S = SCREEN_STRINGS.inventory;

/** One kind's section in Grid view: a foldable heading ("Consumables", its count) over its tiles. Null when the kind has no items (nothing to show). */
export function categorySection(doc, { kind, title, items, rows = null, open, onToggle, onOpen }) {
    if (items.length === 0) return null;
    return foldSection(doc, {
        id: `cat-${kind}`, label: title, count: items.length, open, onToggle, rule: true,
        body: tileGrid(doc, items, { rows, onOpen }), className: `cat cat-${kind}`,
    });
}

/** The Worn view (Gear in fights on): one fold per wearer, "Astra · 5 pieces", with that wearer's pieces as tiles. A wearer with nothing on is left out.
 *  `open(value)` says whether a wearer's fold is open; `onToggle(value, open)` reports a press. Each wearer's fold is its own. */
export function wornSection(doc, { wearers = [], items, rows, open, onToggle, onOpen }) {
    const wrap = h(doc, 'div', 'worn-folds');
    for (const who of wearers) {
        const pieces = items.filter(item => rows?.[item.stack]?.byId === who.value && rows[item.stack].place);
        if (pieces.length === 0) continue;
        const count = pieces.length === 1 ? S.wornWhoOne : fill(S.wornWho, { n: pieces.length });   // the mockup's fold: chevron, the name, "5 pieces" at the right
        wrap.append(foldSection(doc, {
            id: `worn-${who.value}`, label: who.label, count, rule: true, open: open(who.value),
            onToggle: on => onToggle?.(who.value, on),
            body: tileGrid(doc, pieces, { rows, onOpen }), className: 'worn-wearer',
        }));
    }
    return wrap;
}
