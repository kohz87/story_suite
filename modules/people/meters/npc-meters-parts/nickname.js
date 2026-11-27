// The nickname a new namesake gets, chosen inside the write that makes them: "the {role}", else "{Name} from {place met}", else "{Name} the second", never
// one that is anybody's name or alias. The person who had the name alone gets one in the same write if they lack it; people who already shared it never do.
import { npcKey } from '../npc-meters-config.js';
import { ALIASES_MAX, AKA_MAX } from '../npc-lines-parts/aka.js';
import { namesakes } from './namesakes.js';

const ORDINALS = ['second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
// What can stand in a change line as a name: no field marks or quotes, and only the first part of a longer text.
const plain = value => String(value ?? '').replace(/["“”|{}<>~]/g, '').split(/[,;:.(\n]| — /)[0].replace(/\s+/g, ' ').trim();

function candidates(record, place) {
    const name = String(record.name).trim();
    const role = plain(record.role).replace(/^(?:the|a|an) /i, '').replace(/^\p{Lu}(?=[\p{Ll}-]*(?: |$))/u, first => first.toLowerCase());
    const where = plain(place);
    return [
        role && npcKey(role) !== npcKey(name) ? `the ${role}` : '',
        where ? `${name} from ${where}` : '',
        ...ORDINALS.map(word => `${name} the ${word}`),
    ].filter(text => text && text.length <= AKA_MAX);
}

/**
 * `people`: every record as the write stores them (a list, or { order, npcs }); `fresh`: the ids that write makes; `placeOf(record, isNew)` → where they were met.
 * → [{ id, aliases (the record's aliases with the new one at the end) }], empty unless someone new shares their own name with another living person.
 */
export function newNicknames(people, fresh, placeOf = () => '') {
    const made = new Set(fresh);
    if (!made.size) return [];
    const read = namesakes(people);
    const added = new Map();
    const current = () => read.list.map(record => (added.has(record.id) ? { ...record, aliases: added.get(record.id) } : record));
    for (const one of read.living.filter(record => made.has(record.id))) {
        const group = read.living.filter(record => npcKey(record.name) === npcKey(one.name));
        if (group.length < 2) continue;
        const before = group.filter(record => !made.has(record.id));
        for (const record of [...(before.length === 1 ? before : []), one]) {
            if (added.has(record.id)) continue;
            const now = namesakes(current());
            const mine = now.list.find(item => item.id === record.id);
            const aliases = Array.isArray(mine.aliases) ? mine.aliases : [];
            if (now.nickname(mine) || aliases.length >= ALIASES_MAX) continue;
            const used = new Set(now.list.flatMap(item => [item.name, ...(Array.isArray(item.aliases) ? item.aliases : [])]).map(npcKey));
            const nick = candidates(mine, placeOf(mine, made.has(mine.id))).find(text => !used.has(npcKey(text)));
            if (nick) added.set(record.id, [...aliases, nick]);
        }
    }
    return [...added].map(([id, aliases]) => ({ id, aliases }));
}
