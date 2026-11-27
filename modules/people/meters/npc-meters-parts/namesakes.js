// Namesakes: stored, not dead or archived people with the same own name, who can be told apart because each has a nickname (an alias that is nobody else's).
// A group in which anyone lacks one is not listed here, so everything about it stays as it is without this file.
import { npcKey } from '../npc-meters-config.js';
import { isTerminalNpcDeath } from '../../core/terminal-lifecycle.js';

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const aliasesOf = record => (Array.isArray(record?.aliases) ? record.aliases : []).filter(alias => typeof alias === 'string' && npcKey(alias));
const FORM = /^(.+?)\s+["“](.+)["”]$/;

/** A list of records ({ id, name, aliases }), from such a list or from the people domain's slice ({ order, npcs }). */
function peopleList(people) {
    if (Array.isArray(people)) return people.filter(isObject);
    const npcs = isObject(people?.npcs) ? people.npcs : {};
    const ids = Array.isArray(people?.order) ? people.order : Object.keys(npcs);
    return ids.filter(id => isObject(npcs[id])).map(id => ({ ...npcs[id], id }));
}

/**
 * → { list (every stored record), living (those not dead or archived), nickname(record) → its first alias that is no other record's name or alias, or '',
 *     groups: [{ name, members: [{ id, record, nick }] }] (every member has a nickname), group(name) → that group or null,
 *     shown(id) → 'Name "Nickname"' for a member, else null, written(value) → the member a 'Name "Nickname"' text names, or null }.
 */
export function namesakes(people) {
    const list = peopleList(people);
    let taken = null;   // (every name and alias → how many records carry it; made on first need)
    const holders = key => {
        if (!taken) {
            taken = new Map();
            for (const record of list) {
                for (const own of new Set([record.name, ...aliasesOf(record)].map(npcKey).filter(Boolean))) taken.set(own, (taken.get(own) ?? 0) + 1);
            }
        }
        return taken.get(key) ?? 0;
    };
    const nickname = record => aliasesOf(record).find(alias => npcKey(alias) !== npcKey(record.name) && holders(npcKey(alias)) === 1) ?? '';
    const living = list.filter(record => npcKey(record.name) && !record.archived && !isTerminalNpcDeath(record));
    const byName = new Map();
    for (const record of living) byName.set(npcKey(record.name), [...(byName.get(npcKey(record.name)) ?? []), record]);
    const groups = [...byName.values()].filter(records => records.length > 1)
        .map(records => ({ name: String(records[0].name).trim(), members: records.map(record => ({ id: record.id, record, nick: nickname(record).trim() })) }))
        .filter(item => item.members.every(member => member.nick));
    const group = name => groups.find(item => npcKey(item.name) === npcKey(name)) ?? null;
    const labels = new Map(groups.flatMap(item => item.members.map(member => [member.id, `${member.record.name} "${member.nick.replace(/["“”]/g, '')}"`])));
    const written = value => {
        const [, name, nick] = String(value ?? '').trim().match(FORM) ?? [];
        return name ? group(name)?.members.find(member => npcKey(member.nick) === npcKey(nick)) ?? null : null;
    };
    return { list, living, nickname, groups, group, shown: id => labels.get(id) ?? null, written };
}

const nicks = group => group.members.map(member => member.nick);

/** The tail's line for one group of namesakes (owner-approved wording). */
export const sayWhich = group => `Several people are called ${group.name}: write the nickname to say which (${nicks(group).join(', ')}).`;

/** The refusal of a line that writes a shared name the scene does not settle (owner-approved wording; three or more: "a, b or c"). */
export function whichRefusal(group) {
    const all = nicks(group);
    return `Two people are called ${group.name}; write ${all.slice(0, -1).join(', ')} or ${all.at(-1)}.`;
}
