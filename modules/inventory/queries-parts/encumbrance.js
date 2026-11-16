// The encumbered condition derived from the load a carry module reports, and its tail line.

import { isPlainObject } from '../../scene/domains/common.js';
import { trimText } from '../../scene/names.js';
import { atLimit } from '../gear.js';
import { carryAnswer } from './carry.js';
import { asker } from './shared-ask.js';

// The encumbered condition (`story-block.encumbrance`): derived from the load the carry module reports
// (`items.carry` without `add`: { on, people: [{ id, name, load, capacity }], load, capacity }), never
// stored, so it lifts by itself once something is put down. Who is over their own capacity is named
// (through the party module's members); a party over its whole capacity is the party.
export const ENCUMBERED_PENALTY = -2;

export const ENCUMBERED_STATS = Object.freeze(['AGI', 'DEX']);

/**
 * → { on, encumbered, party, who: [{ id, name, load, capacity }], load, capacity, penalty, stats }:
 * `penalty` (ENCUMBERED_PENALTY while encumbered, else 0) is what the checks module adds to checks of
 * `stats`; Story Block only tells the story.
 */
export function encumbrance(state, tools, gear = false) {
    const none = { on: false, encumbered: false, party: false, who: [], load: 0, capacity: 0, penalty: 0, stats: [...ENCUMBERED_STATS] };
    const view = carryAnswer(asker(tools), {});
    if (!isPlainObject(view) || view.on === false) return none;
    const num = value => (Number.isFinite(value) ? value : 0);
    // Past the limit encumbers (exactly at it does not) as it always did; only with gear on is "at the limit" (100 %) already encumbered, as its Carry card says.
    const over = (load, capacity) => (gear ? atLimit(load, capacity) : load > capacity);
    const who = (Array.isArray(view.people) ? view.people : [])
        .filter(person => isPlainObject(person) && over(num(person.load), num(person.capacity)))
        .map(person => ({ id: String(person.id ?? ''), name: trimText(person.name || person.id || 'someone', 40), load: num(person.load), capacity: num(person.capacity) }));
    const party = over(num(view.load), num(view.capacity));
    const encumbered = party || who.length > 0;
    return {
        on: true, encumbered, party, who, load: num(view.load), capacity: num(view.capacity),
        penalty: encumbered ? ENCUMBERED_PENALTY : 0, stats: [...ENCUMBERED_STATS],
    };
}

/** The encumbered tail line, or none: [] | [line]. */
export function encumbranceTail(found) {
    if (!found?.encumbered) return [];
    const who = found.who.length
        ? found.who.map(person => `${person.name} (${person.load}/${person.capacity})`).join(', ')
        : `the party (${found.load}/${found.capacity})`;
    return [`Encumbered (carrying more than they can): ${who}; ${found.stats.join(' and ')} checks ${found.penalty} until something is put down.`];
}
