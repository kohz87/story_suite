// Reading a module's settings schema and fold keys for the Modules page.

import { SUB_FOLD, groupFields } from '../../../host-ui.js';
import { routeOf } from '../sections.js';

/** A settings schema without the groups another page draws (`routeOf`): { schema, count, groups }. */
export function moduleSchema(moduleId, schema) {
    const out = {};
    let count = 0;
    const groups = [];
    for (const group of groupFields(schema)) {
        if (routeOf({ type: 'group', moduleId, group: group.name }) !== 'modules') continue;
        groups.push(group.name);
        for (const { key } of group.fields) {
            out[key] = schema[key];
            count += 1;
        }
    }
    return { schema: out, count, groups };
}

export const parseGroup = key => {
    const at = typeof key === 'string' ? key.indexOf(`${SUB_FOLD}group:`) : -1;
    return at > 0 ? { id: key.slice(0, at), group: key.slice(at + `${SUB_FOLD}group:`.length) } : null;
};
