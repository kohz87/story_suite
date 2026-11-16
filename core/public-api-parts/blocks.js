// Reads the blocks section of the public paths from the pinned data-module blocks.

import { activeDefinition, actorsOf, instanceOf } from '../../packages/story-block/src/v2/data-modules/adapters.js';
import { dmHidden } from '../../packages/story-block/src/v2/data-modules/schema.js';
import { isObject, text, fold } from './shared-basics.js';
import { put } from './shared-put.js';

// A block is hidden the way the Blocks screen says "Hidden": no tab and no card (no `show` at all is the same), and no screens or layouts of its own.
// The RPG's role blocks are shown by the RPG's own screens.
const blockHidden = definition => !definition.role && !definition.show?.tab && !definition.show?.card
    && !(Array.isArray(definition.screens) && definition.screens.length) && !(Array.isArray(definition.layouts) && definition.layouts.length);

export function blocksSection(state, rpgOn) {
    const map = new Map();
    const domain = state?.domains?.dataModules;
    if (!isObject(domain) || !isObject(domain.active)) return map;
    const ids = [];
    const actors = actorsOf(state);
    const visible = (definition, fields) => Object.fromEntries(Object.keys(isObject(definition.state) ? definition.state : {})
        .filter(key => Object.hasOwn(fields, key) && !dmHidden(definition.state[key])).map(key => [key, fields[key]]));
    const leaves = (prefix, shown) => {
        for (const [key, value] of Object.entries(shown)) {
            put(map, `${prefix}.${key}`, value);
            if (isObject(value)) for (const [inner, entry] of Object.entries(value)) put(map, `${prefix}.${key}.${inner}`, entry);
        }
    };
    for (const id of Object.keys(domain.active).sort()) {
        const definition = activeDefinition(state, id);
        if (!definition || blockHidden(definition) || (definition.role && !rpgOn)) continue;
        ids.push(id);
        if (definition.scope === 'character') {
            const people = {};
            // Subjects with the same display name are read by their ids.
            const subjects = (domain.active[id].subjects ?? []).filter(subject => isObject(instanceOf(state, id, subject)?.fields));
            const shownName = subject => text(actors[subject]?.name) || subject;
            const count = new Map();
            for (const subject of subjects) count.set(fold(shownName(subject)), (count.get(fold(shownName(subject))) ?? 0) + 1);
            for (const subject of subjects) {
                const fields = instanceOf(state, id, subject).fields;
                const who = count.get(fold(shownName(subject))) > 1 ? subject : shownName(subject);
                people[who] = visible(definition, fields);
                put(map, `blocks.${id}.${who}`, people[who], false);
                leaves(`blocks.${id}.${who}`, people[who]);
            }
            put(map, `blocks.${id}`, people, false);
        } else {
            const fields = instanceOf(state, id, 'chat')?.fields;
            if (!isObject(fields)) { ids.pop(); continue; }
            const shown = visible(definition, fields);
            put(map, `blocks.${id}`, shown, false);
            leaves(`blocks.${id}`, shown);
        }
    }
    put(map, 'blocks', ids, false);
    return map;
}
