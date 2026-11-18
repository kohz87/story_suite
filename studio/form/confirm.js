// The Studio's delete confirm (mock MK-2 "delete"): a red card under the record's head that names the record, says whether anything else
// names it, and offers Delete and Keep it. The head keeps its own Duplicate and Delete buttons while the card shows.

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
