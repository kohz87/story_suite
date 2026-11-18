// Why `chronicle.condition.set` would refuse a condition at a ref it knows: no date yet, a same-day clear (spec §2 "clear beats
// set"), a full cap, or a placeStatus condition where a protected person lives (spec §2, §5: only an authored event may). Asked
// by the command itself and, before calling it, by the world line (a refused sub-command fails the whole reply on the host). Pure.

import { slotValue } from '../../../rpg/slot.js';
import { groupOf } from '../../daily/geo-scope.js';
import { readWorld } from '../world-daily/read-world.js';
import { ledgerOf } from './ledger.js';
import { MAX_CONDITIONS, MAX_PER_REF } from './limits.js';

const DAY = 1440;
const low = text => String(text ?? '').trim().toLowerCase();

// The protected, living person whose home (the daily step's record, else the pack's home base or start place) is in `places`.
function protectedResident(query, chronicle, places) {
    const rows = slotValue(chronicle.daily)?.cast ?? {};
    const group = new Set(places.map(low));
    for (const person of readWorld(query).cast) {
        if (person?.protected !== true || typeof person.id !== 'string') continue;
        const row = rows[person.id] ?? {};
        if (row.died !== undefined) continue;
        const start = person.start && typeof person.start === 'object' ? person.start.place : person.start;
        if (group.has(low(row.displaced?.to ?? row.home ?? person.homeBase ?? start))) return person.name ?? person.id;
    }
    return null;
}

/**
 * The sentence `chronicle.condition.set { name, ref }` would refuse with, or '' when it takes it. `declared` is the pack's entry
 * (`{ name, placeStatus }`), `ref` the stored name of the ref, `now` the story minute (null: no date), `by` the setter, `chronicle`
 * the draft (what this reply set a moment ago counts), `geo` the packs' map, `query` the host's.
 */
export function setRefusal({ query, chronicle, geo, declared, ref, now, by }) {
    if (now === null) return 'the story has no date yet; a condition waits for one';
    const key = `${declared.name}@${ref}`;
    const { tomb } = ledgerOf(chronicle.ledger);
    if (tomb && tomb.day === Math.floor(now / DAY) && tomb.keys.includes(key)) return `${declared.name} was cleared on ${ref} today; a clear is not undone the same day`;
    const table = chronicle.conditions ?? {};
    if (!Object.hasOwn(table, key)) {
        if (Object.keys(table).length >= MAX_CONDITIONS) return `the world already carries ${MAX_CONDITIONS} conditions; one must end first`;
        if (Object.values(table).filter(entry => entry?.ref === ref).length >= MAX_PER_REF) return `${ref} already carries ${MAX_PER_REF} conditions`;
    }
    if (declared.placeStatus === true && !String(by).startsWith('event:')) {
        const who = protectedResident(query, chronicle, groupOf(geo, ref).length ? groupOf(geo, ref) : [ref]);
        if (who) return `${who} lives at ${ref} and is protected; only an authored event may set ${declared.name} there`;
    }
    return '';
}
