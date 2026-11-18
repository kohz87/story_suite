// The Studio's record list pieces (mock MK-2 `.slist.reclist` and `.mtools`): one record's row in a list, and the list's filter chips.
// The row is a settings `.slist` button without the icon column: the title with its tags, a line under it, then the problem count and ›.

import { h } from '../../ui/kit/dom.js';

/**
 * One record's row. `spec`: `{ cls, rec, title, tags, sub, bad, thumb, current, onClick }`. `cls` names the editor's row class (kept for
 * Go to and the tests), `rec` its record key, `tags` short words drawn as tags after the title, `bad` its problem count, `thumb` an
 * optional node before the text (a portrait), `current` marks the open record.
 */
export function recordRow({ cls, rec, title, tags = [], sub = '', bad = 0, thumb = null, current = false, onClick }) {
    return h('button', { type: 'button', class: ['st-rec', cls, thumb ? 'st-hasthumb' : null], dataset: { rec }, 'aria-current': current ? 'true' : null, onClick },
        thumb,
        h('span', { class: 'st-rt' }, h('span', { class: 'st-tl' }, h('b', String(title)), ...tags.filter(Boolean).map(tag => h('span', { class: 'tg2' }, tag))), sub ? h('small', sub) : null),
        h('span', { class: 'rcnt' }, bad ? h('span', { class: 'st-bad pairerr', 'aria-label': `${bad} problem${bad === 1 ? '' : 's'}` }, `✕ ${bad}`) : null, h('span', { 'aria-hidden': 'true' }, '›')));
}

/** The filter chips: `filters` is `[[key, label]]`, `on` the key shown pressed; a chip calls `onPick(key)`. */
export function filterChips(filters, on, onPick) {
    return h('div', { class: 'chips3 st-filters', role: 'group', 'aria-label': 'Show' },
        filters.map(([key, label]) => h('button', { type: 'button', class: 'st-filter', dataset: { filter: key }, 'aria-pressed': String(on === key), onClick: () => onPick(key) }, label)));
}
