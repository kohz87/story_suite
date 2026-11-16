// Foe group chips, party chips and the status block that holds them.
import { h, text } from '../../../../../../../ui/legacy/view/widgets/dom.js';
import { healthMiniBar } from './bars.js';
import { hasValue, numberOr } from './shared-values.js';

// One chip: name (with ×count for a group), "Lv N" when known, then the Health mini-bar.
function chip(doc, { name, level, count = 1, value, max, tone, party = false } = {}) {
    const node = h(doc, 'div', `rpg-chip${party ? ' rpg-chip-party' : ''}${max > 0 && !(numberOr(value) > 0) ? ' rpg-chip-down' : ''}`);
    const label = h(doc, 'span', 'rpg-chip-name');
    const shown = text(name, 60);
    label.appendChild(h(doc, 'span', 'rpg-chip-title', numberOr(count, 1) > 1 ? `${shown} ×${Math.trunc(count)}` : shown));   // wraps between words, 2 lines at most (board.css)
    if (hasValue(level)) label.appendChild(h(doc, 'small', 'rpg-chip-level', `Lv ${text(level, 6)}`));
    node.appendChild(label);
    node.appendChild(healthMiniBar(doc, { value, max, tone }));
    return node;
}

/** A foe group as ONE chip: "Ridge hounds ×12" (pass `count`), its level, and its Health mini-bar. */
export function foeGroupChip(doc, props = {}) {
    return chip(doc, { ...props, party: false });
}

/** A party member as a chip: name, level and Health mini-bar (the party's chips take the accent border in board.css). */
export function partyChip(doc, props = {}) {
    return chip(doc, { ...props, count: 1, party: true });
}
/** The status block: foe group chips, then party chips (each list is `[{ name, count?, level?, value, max, tone }]`). */
export function statusChips(doc, { foes = [], party = [] } = {}) {
    const box = h(doc, 'div', 'rpg-board-cards');
    const side = (cls, list, make) => { if (!list.length) return; const row = h(doc, 'div', `rpg-chips ${cls}`); for (const item of list) row.appendChild(make(doc, item)); box.appendChild(row); };
    side('rpg-chips-foes', foes, foeGroupChip);
    side('rpg-chips-party', party, partyChip);
    return box;
}
