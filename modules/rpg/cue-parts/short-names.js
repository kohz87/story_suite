// Cuts names so that no two cut names look alike.

import { NAME_CUT } from './shared-text.js';

const TAIL_FROM = 4;

const headTail = (text, max, tail) => `${text.slice(0, max - 1 - tail)}…${tail ? text.slice(-tail) : ''}`;

/**
 * The shown form of each name when names are cut to `max` characters, so that no two names show alike: a name is cut to its head,
 * and where that makes it look like another name, to a shorter head and the tail of the name ("Captain Rare L…pc3"), the shortest
 * tail (four characters or more, enough to be a word) that tells it apart. A name no cut can tell apart stays as written. → Map(name → shown).
 */
export function shortNames(names, max = NAME_CUT) {
    const all = [...new Set(names)];
    const shown = new Map(all.filter(name => name.length <= max).map(name => [name, name]));
    const used = new Set(shown.values());
    const open = all.filter(name => name.length > max);
    for (let tail = 0; tail <= max - 7 && open.some(name => !shown.has(name)); tail = tail ? tail + 1 : TAIL_FROM) {
        const forms = new Map(open.filter(name => !shown.has(name)).map(name => [name, headTail(name, max, tail)]));
        const counts = new Map();
        for (const form of forms.values()) counts.set(form, (counts.get(form) ?? 0) + 1);
        for (const [name, form] of forms) if (counts.get(form) === 1 && !used.has(form)) { shown.set(name, form); used.add(form); }
    }
    for (const name of open) if (!shown.has(name)) shown.set(name, name);
    return shown;
}
