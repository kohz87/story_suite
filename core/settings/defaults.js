// Assembles the Story Suite settings defaults from core, UI and each registered module's declared settings.

import { SETTINGS_SCHEMA } from './schema.js';
import { UI_DEFAULTS } from './ui-defaults.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const copy = value => structuredClone(value);

function moduleIdOf(declaration) {
    return declaration?.moduleId ?? declaration?.id;
}

function defaultsOf(declaration) {
    return declaration?.settings?.defaults ?? declaration?.defaults ?? {};
}

/**
 * Builds `{ schema: 1, core, ui, modules }` from core and UI defaults and module settings declarations.
 * Declarations may use the registry's `{ moduleId, defaults }` shape or a module definition's
 * `{ id, settings: { defaults } }` shape. Inputs are copied, and duplicate module ids are refused.
 */
export function assembleDefaults({ core = {}, ui = {}, modules = [] } = {}) {
    if (!isRecord(core)) throw new TypeError('Core defaults must be an object.');
    if (!isRecord(ui)) throw new TypeError('UI defaults must be an object.');
    if (!Array.isArray(modules)) throw new TypeError('Module defaults must be a list.');
    const tree = {
        schema: SETTINGS_SCHEMA,
        core: copy(core),
        ui: copy({ ...UI_DEFAULTS, ...ui }),
        modules: {},
    };
    for (const declaration of modules) {
        const id = moduleIdOf(declaration);
        if (typeof id !== 'string' || !id) throw new TypeError('Every module settings declaration needs an id.');
        if (Object.hasOwn(tree.modules, id)) throw new Error(`Two module settings declarations use the id "${id}".`);
        const defaults = defaultsOf(declaration);
        if (!isRecord(defaults)) throw new TypeError(`The settings defaults of "${id}" must be an object.`);
        tree.modules[id] = copy(defaults);
    }
    return tree;
}
