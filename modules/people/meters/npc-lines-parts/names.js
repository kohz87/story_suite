// Who a story line names (SOAKPEOPLE F50): among the people as this reply sees them (ctx.read('people'), reply-pinned, so a swipe, a Re-read and a replay
// decide the same way), the person whose name, else alias, else Name "Nickname", the line writes exactly; else the ONE person a short form fits: a first name or a surname, with or
// without a title ("Hesk", "Captain Dalla"; titles and "the" never count as a name); else the ONE person whose role it is ("the Watch-Captain"). Two people
// a short form fits is nobody: the line must write the full name.
import { labelKey } from '../../dossier/cast-dossier-parts/shared-text.js';
import { isTerminalNpcDeath } from '../../core/terminal-lifecycle.js';
import { namesakes } from '../npc-meters-parts/namesakes.js';
import { bareTokens } from '../../core/core-merge-names-parts/shared-name-tokens.js';

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const labelsOf = record => [record?.name, ...(Array.isArray(record?.aliases) ? record.aliases : [])].filter(item => typeof item === 'string');
const roleKey = value => labelKey(value).replace(/^(?:the|a|an) /, '');

/** → { key, record } of the person `name` names among `people` ({ [id]: record }), or null (nobody, or more than one by a short form or role). */
export function personNamed(people, name) {
    const asked = labelKey(name);
    if (!asked) return null;
    const rows = Object.entries(isObject(people) ? people : {}).filter(([, record]) => isObject(record));
    // A person's own name wins over anyone's alias, wherever each stands in the list; among namesakes a living one, then a dead one, then an archived one.
    const owned = rows.filter(([, record]) => labelKey(record.name) === asked);
    const exact = owned.find(([, record]) => !record.archived && !isTerminalNpcDeath(record)) ?? owned.find(([, record]) => isTerminalNpcDeath(record)) ?? owned[0] ?? rows.find(([, record]) => labelsOf(record).map(labelKey).includes(asked));
    if (exact) return { key: exact[0], record: exact[1] };
    // `Name "Nickname"` is that person, before any short form or role is tried.
    const formed = /["“]/.test(name) ? namesakes(rows.map(([id, record]) => ({ ...record, id }))).asForm(name)?.one : null;
    if (formed) return { key: formed.id, record: people[formed.id] };
    const words = bareTokens(name);
    const short = words.length ? rows.filter(([, record]) => {
        const own = new Set(labelsOf(record).flatMap(bareTokens));
        return words.every(word => own.has(word));
    }) : [];
    if (short.length === 1) return { key: short[0][0], record: short[0][1] };
    if (short.length > 1) return null;
    const role = roleKey(name);
    const byRole = role ? rows.filter(([, record]) => typeof record.role === 'string' && roleKey(record.role) === role) : [];
    return byRole.length === 1 ? { key: byRole[0][0], record: byRole[0][1] } : null;
}
