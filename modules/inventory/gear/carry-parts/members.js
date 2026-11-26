// Who is counted in the party's capacity: whose strength fills the shared bag, and which members have room of their own.

import { isPlainObject } from '../../../scene/domains/common.js';
import { fold } from '../../../rpg/read.js';
import { actorIdOf } from '../../../rpg/roster-parts/actor-id.js';

function actorStr(actor) {
    for (const value of [actor?.str, actor?.STR, actor?.stats?.str, actor?.stats?.STR]) if (Number.isSafeInteger(value)) return value;
    return null;
}
const told = value => (typeof value === 'string' && value.trim() ? value.trim() : null);

/**
 * → { shared: [{ name, str }] (whose strength the shared bag has), people: [{ id, name, str }] (sorted by id), left: [{ id, name }] (holders no longer in the
 * party: no room of their own, so neither their strength nor their bags count) }.
 * `sheet` the RPG's characters, `actors` the `party` domain's, `holders` the owners of any stack.
 * People are the domain's actors, the holders, and every member of `roster` ({ members: [{ id, name }], pc }: what the party module answers), never the main
 * character (`roster.pc`) unless things are filed under their own id. A member who is a Character block is counted once, with that block's strength: it moves
 * from the shared bag to them. With no main character known, a block only the roster names stays in the shared bag (it may be the reader's).
 * With a roster, its members, `roster.pc` and the `party` domain's actors are in the party: anyone else who holds things is in `left`. Without one (read from the state alone) everyone is.
 * `legacy`: how it was counted before the roster (no roster, every block in the shared bag and a person at their own domain strength, nobody left): what a gear
 * record without a `rule` mark was made from, and what an item line of a reply without the `carryRoster` mark is judged by.
 */
export function partyCarriers({ sheet, actors, holders, roster = null, nameOf = null, legacy = false }) {
    const listed = new Map(legacy ? [] : (roster?.members ?? []).map(member => [member.id, member.name]));
    const pc = legacy ? null : roster?.pc ?? null;
    const nameFor = id => told(actors[id]?.name) ?? told(nameOf?.(id)) ?? told(listed.get(id)) ?? id;
    const own = new Set([...Object.keys(actors), ...holders]);
    const free = new Set(sheet);
    const blockOf = id => [...free].find(block => actorIdOf(block.module) === id) ?? [...free].find(block => fold(nameFor(id)) === block.key);
    const present = id => legacy || !roster || id === pc || listed.has(id) || Object.hasOwn(actors, id);
    const ids = [...new Set([...own, ...listed.keys()])].filter(id => id !== 'party' && present(id) && (id !== pc || holders.has(id))).sort();
    const left = [...holders].filter(id => id !== 'party' && !present(id)).sort().map(id => ({ id, name: nameFor(id) }));
    const people = [];
    for (const id of ids) {
        const block = legacy ? undefined : blockOf(id);
        if (block && !pc && !own.has(id)) continue;
        if (block) free.delete(block);
        people.push({ id, name: nameFor(id), str: actorStr(actors[id]) ?? block?.stats?.str ?? null });
    }
    const shared = sheet.length ? [...free].map(block => ({ name: block.who, str: block.stats?.str })) : [{ name: 'The reader', str: null }];
    return { shared, people, left };
}

/** The party's actors in a state's `party` domain, by id. */
export const domainActors = state => (isPlainObject(state?.domains?.party?.actors) ? state.domains.party.actors : {});
