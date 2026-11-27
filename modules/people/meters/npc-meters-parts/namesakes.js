// Namesakes: stored, not dead or archived people with the same own name, who can be told apart because each has a nickname (an alias that is nobody else's).
// A group in which anyone lacks one is not listed here: its shared name stays as it is without this file. `Name "Nickname"` names a stored person whatever
// their state or group; and the one rule for which member of a group a scene has.
import { npcKey } from '../npc-meters-config.js';
import { labelKey } from '../../dossier/cast-dossier-parts/shared-text.js';
import { isTerminalNpcDeath } from '../../core/terminal-lifecycle.js';

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const aliasesOf = record => (Array.isArray(record?.aliases) ? record.aliases : []).filter(alias => typeof alias === 'string' && npcKey(alias));
const FORM = /^(.+?)\s+["“](.+)["”]$/;
const bare = value => npcKey(String(value ?? '').replace(/["“”]/g, ''));
const gone = record => Boolean(record.archived) || isTerminalNpcDeath(record);

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
 *     shown(id) → 'Name "Nickname"' for a member, else null,
 *     asForm(value) → null unless `value` reads Name "Nickname", two or more stored records have that name and it is nobody's own name or alias: { found (the stored records of that name with that
 *     alias), group (that name's group or null), one: the one they mean ({ id, record, nick }; a living one before a dead one) or null },
 *     present(group, scene, isPresent?) → the members the scene has: those it lists by a label only they hold (an alias, the shown form), else, when it
 *     is empty or lists the shared name, those `isPresent` says (by default the record's own presence) }.
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
    const living = list.filter(record => npcKey(record.name) && !gone(record));
    const byName = new Map();
    for (const record of living) byName.set(npcKey(record.name), [...(byName.get(npcKey(record.name)) ?? []), record]);
    const groups = [...byName.values()].filter(records => records.length > 1)
        .map(records => ({ name: String(records[0].name).trim(), members: records.map(record => ({ id: record.id, record, nick: nickname(record).trim() })) }))
        .filter(item => item.members.every(member => member.nick));
    const group = name => groups.find(item => npcKey(item.name) === npcKey(name)) ?? null;
    const labels = new Map(groups.flatMap(item => item.members.map(member => [member.id, `${member.record.name} "${member.nick.replace(/["“”]/g, '')}"`])));
    const asForm = value => {
        const text = String(value ?? '').trim();
        const [, name, nick] = text.match(FORM) ?? [];
        if (!name || list.filter(record => npcKey(record.name) === npcKey(name)).length < 2 || list.some(record => [record.name, ...aliasesOf(record)].some(own => String(own ?? '').trim().toLocaleLowerCase() === text.toLocaleLowerCase()))) return null;
        const holds = record => aliasesOf(record).find(alias => bare(alias) === bare(nick));
        const found = list.filter(record => npcKey(record.name) === npcKey(name) && holds(record));
        const alive = found.filter(record => !gone(record));
        const pick = alive.length === 1 ? alive[0] : (!alive.length && found.length === 1 ? found[0] : null);
        return { found, group: group(name), one: pick ? { id: pick.id, record: pick, nick: holds(pick).trim() } : null };
    };
    const present = (among, scene, isPresent = member => member.record.present === true) => {
        const listed = new Set((Array.isArray(scene) ? scene : []).map(item => labelKey(typeof item === 'string' ? item : item?.name)).filter(Boolean));
        const own = member => [labels.get(member.id), ...aliasesOf(member.record).filter(alias => holders(npcKey(alias)) === 1)];
        const labelled = among.members.filter(member => own(member).some(label => listed.has(labelKey(label))));
        if (labelled.length) return labelled;
        if (listed.size && !listed.has(labelKey(among.name))) return [];
        return among.members.filter(isPresent);
    };
    return { list, living, nickname, groups, group, shown: id => labels.get(id) ?? null, asForm, present };
}

const nicks = group => group.members.map(member => member.nick);

/** The tail's line for one group of namesakes (owner-approved wording). */
export const sayWhich = group => `Several people are called ${group.name}: write the nickname to say which (${nicks(group).join(', ')}).`;

/** The refusal of a line that writes a shared name the scene does not settle (owner-approved wording; three or more: "a, b or c"). */
export function whichRefusal(group) {
    const all = nicks(group);
    return `${all.length > 2 ? 'Several' : 'Two'} people are called ${group.name}; write ${all.slice(0, -1).join(', ')} or ${all.at(-1)}.`;
}
