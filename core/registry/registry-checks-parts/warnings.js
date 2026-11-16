// Lists the fields of a definition this host does not know, for logging.

import { featureWarnings } from '../../features.js';
import { isObject } from './shared-basics.js';
import { SETTINGS_PLACES } from './lists.js';
import { FIELD_TYPES, fieldType } from './fields.js';
import { interactionWarnings } from './interaction-problems.js';

// The settings fields this host knows, and the places a module's settings may ask for (`settings.place`,
// or a fold's `place`): 'diagnostics' draws it as a sub-fold of Settings → Diagnostics (SPEC §6).
const SETTINGS_KEYS = ['defaults', 'schema', 'section', 'render', 'folds', 'place', 'rules'];

const KNOWN_KEYS = ['id', 'name', 'version', 'description', 'requires', 'domains', 'commands', 'queries', 'replayQueries', 'capture', 'context', 'hooks', 'settings', 'tabs', 'screens', 'widgets', 'features', 'cards', 'headerControls', 'participant', 'batchResults', 'capabilities', 'interactions'];
const CONTEXT_KEYS = ['static', 'tail', 'budget', 'feature', 'parts'];

// What `requires` may name: the Story Block it needs, and the peers (modules) it needs registered.
const REQUIRES_KEYS = ['storyBlock', 'peers'];

const COMMAND_KEYS = ['handler', 'internal', 'prelude', 'feature', 'enabled'];

/**
 * The fields of a definition this host does not know (a newer module's, like MODULES §F100's
 * `features`): plain sentences. They are logged when the module registers and otherwise ignored.
 */
export function definitionWarnings(def) {
    if (!isObject(def)) return [];
    const out = Object.keys(def).filter(key => !KNOWN_KEYS.includes(key)).map(key => `"${key}" is not a module field this Story Block knows; it is ignored`);
    if (isObject(def.requires)) {
        for (const key of Object.keys(def.requires)) if (!REQUIRES_KEYS.includes(key)) out.push(`"requires.${key}" is not a requires field this Story Block knows; it is ignored`);
    }
    // One level down the same (R2-b7-2): a newer module's command option, settings part or field type.
    if (isObject(def.commands)) {
        for (const [type, handler] of Object.entries(def.commands)) {
            if (isObject(handler)) for (const key of Object.keys(handler)) if (!COMMAND_KEYS.includes(key)) out.push(`"${key}" on command "${type}" is not a command field this Story Block knows; it is ignored`);
        }
    }
    if (isObject(def.context)) {
        for (const key of Object.keys(def.context)) if (!CONTEXT_KEYS.includes(key)) out.push(`"context.${key}" is not a context field this Story Block knows; it is ignored`);
    }
    out.push(...interactionWarnings(def));
    out.push(...featureWarnings(def));
    if (isObject(def.settings)) {
        for (const key of Object.keys(def.settings)) if (!SETTINGS_KEYS.includes(key)) out.push(`"settings.${key}" is not a settings field this Story Block knows; it is ignored`);
        // `place`: where the module's fold (or one of its own folds) goes; only 'diagnostics' is known.
        const placeWarning = (value, where) => (value !== undefined && !SETTINGS_PLACES.includes(value) ? [`${where} is ${JSON.stringify(value)}, a place this Story Block does not know; the fold stays where it was`] : []);
        out.push(...placeWarning(def.settings.place, '"settings.place"'));
        if (Array.isArray(def.settings.folds)) def.settings.folds.forEach((item, index) => { if (isObject(item)) out.push(...placeWarning(item.place, `settings fold ${index + 1}'s place`)); });
        const fields = isObject(def.settings.schema) ? Object.entries(def.settings.schema) : [];
        for (const [key, field] of fields) {
            const subs = fieldType(field) === 'list' && isObject(field?.of) ? Object.entries(field.of).map(([sub, inner]) => [`${key}.${sub}`, inner]) : [];
            for (const [where, inner] of [[key, field], ...subs]) {
                const type = fieldType(inner);
                if (typeof type === 'string' && type && !FIELD_TYPES.includes(type)) out.push(`settings field "${where}" has the type "${type}", which this Story Block does not know; it is hidden and its value kept`);
            }
        }
    }
    return out;
}
