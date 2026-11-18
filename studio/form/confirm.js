// The Studio's delete confirm (mock MK-2 "delete"): a red card under the record's head that names the record, says whether anything else
// names it, and offers Delete and Keep it. The head keeps its own Duplicate and Delete buttons while the card shows. askDelete wires it to a
// Delete button on a page that keeps no state for it (places, routes, regions and realms, powers and scores).

import { h } from '../../ui/kit/dom.js';

/**
 * The card. `spec`: `{ title, uses, onDelete, onKeep }`: `uses` is how many other records name this one (null: not counted).
 * Its buttons carry `st-sure` (delete) and `st-keep` (keep it).
 */
export function deleteCard({ title, uses = null, onDelete, onKeep }) {
    const named = uses === null ? '' : uses === 0 ? 'Nothing else names it. ' : `${uses} other record${uses === 1 ? ' names' : 's name'} it; the check will list ${uses === 1 ? 'it' : 'them'}. `;
    return h('div', { class: 'cfm st-delcard', role: 'group', 'aria-label': `Delete “${title}”?` },
        h('b', `Delete “${title}”?`),
        h('small', `${named}Undo brings it back.`),
        h('span', { class: 'ctl' },
            h('button', { type: 'button', class: 'btn2 dng st-sure', onClick: onDelete }, 'Delete'),
            h('button', { type: 'button', class: 'btn2 st-keep', onClick: onKeep }, 'Keep it')));
}

/**
 * A Delete button's handler for a record page that draws no state of its own: the first press puts the card before `anchor` (under the
 * head); its Delete runs `remove()` and Keep it takes the card away. `uses()` counts what else names the record (null: not counted).
 */
export function askDelete(anchor, { title, uses = () => null, remove }) {
    let card = null;
    const gone = () => { card?.remove(); card = null; };
    return () => {
        if (card) return; // one card at a time (a redraw draws a new page, with a new handler)
        card = deleteCard({ title, uses: uses(), onDelete: () => { gone(); remove(); }, onKeep: gone });
        anchor.before(card);
    };
}
