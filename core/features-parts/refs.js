// Features: the feature an item names, every feature a definition names, and whether a feature changes the static prompt.

import { isObject } from './shared-object.js';

/** The feature an item names (`item.feature`, on an object or a function), or null. */
export const featureOf = item => (item && (typeof item === 'object' || typeof item === 'function') && typeof item.feature === 'string' ? item.feature : null);

/**
 * Every `feature:` a definition names: [{ where, feature }] (where: a plain description of the item).
 * A `feature` that is there but not text is listed with feature = that value, for definitionProblems.
 */
export function featureRefs(def) {
    if (!isObject(def)) return [];
    const out = [];
    const add = (item, where) => {
        if (!item || (typeof item !== 'object' && typeof item !== 'function') || !Object.hasOwn(item, 'feature')) return;
        out.push({ where, feature: item.feature });
    };
    for (const [kind, spec] of Object.entries(isObject(def.capture?.kinds) ? def.capture.kinds : {})) add(spec, `the capture kind "${kind}"`);
    for (const [type, handler] of Object.entries(isObject(def.commands) ? def.commands : {})) add(handler, `the command "${type}"`);
    for (const [name, query] of Object.entries(isObject(def.queries) ? def.queries : {})) add(query, `the query "${name}"`);
    for (const [name, hook] of Object.entries(isObject(def.hooks) ? def.hooks : {})) add(hook, `the hook "${name}"`);
    if (isObject(def.context)) {
        add(def.context, 'the context');
        (Array.isArray(def.context.parts) ? def.context.parts : []).forEach((part, index) => add(part, `context part ${index + 1}`));
    }
    (Array.isArray(def.screens) ? def.screens : []).forEach((screen, index) => add(screen, `the screen "${screen?.id ?? index + 1}"`));
    (Array.isArray(def.tabs) ? def.tabs : []).forEach((tab, index) => add(tab, `the tab "${tab?.id ?? index + 1}"`));
    (Array.isArray(def.headerControls) ? def.headerControls : []).forEach((control, index) => add(control, `the header control "${control?.id ?? index + 1}"`));
    for (const [name, widget] of Object.entries(isObject(def.widgets) ? def.widgets : {})) add(widget, `the widget "${name}"`);
    // Settings: a schema field ({ type, …, feature }), and the custom panel (a function with `feature`).
    if (isObject(def.settings)) {
        for (const [key, field] of Object.entries(isObject(def.settings.schema) ? def.settings.schema : {})) if (isObject(field)) add(field, `the settings field "${key}"`);
        if (typeof def.settings.section === 'function') add(def.settings.section, 'the settings section');
        if (typeof def.settings.render === 'function') add(def.settings.render, 'the settings section');
    }
    return out;
}

/**
 * Does this feature change the static prompt part? When it says so (`prompt: true`), or when it owns a
 * capture kind (its grammar line) or static text (the context's, or a context part's).
 */
export function affectsStatic(def, id) {
    const declared = (Array.isArray(def?.features) ? def.features : []).find(feature => feature?.id === id);
    if (declared?.prompt === true) return true;
    if (Object.values(isObject(def?.capture?.kinds) ? def.capture.kinds : {}).some(spec => featureOf(spec) === id)) return true;
    const parts = Array.isArray(def?.context?.parts) ? def.context.parts : [];
    // C3-1: a feature that owns the whole context turns all of it off, its parts' static text too.
    if (featureOf(def?.context) === id && (typeof def.context.static === 'function' || parts.some(part => typeof part?.static === 'function'))) return true;
    return parts.some(part => featureOf(part) === id && typeof part?.static === 'function');
}
