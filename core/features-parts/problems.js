// Features: what is wrong with a definition's features list and the feature fields a newer module adds.

import { isObject } from './shared-object.js';
import { FEATURE_KEYS, NEEDS_KEYS, PRESET_KEYS } from './shape.js';
import { DESCRIBE_MAX, LABEL_MAX, WHY_MAX } from './limits.js';
import { featureRefs } from './refs.js';

// The part of an id after `<module-id>.`.
const NAME = /^[a-z0-9][a-z0-9_-]*$/;

/** What is wrong with a definition's `features` list and the `feature:` it names: plain sentence parts. */
export function featureProblems(def) {
    if (!isObject(def)) return [];
    const problems = [];
    const ids = new Set();
    if (def.features !== undefined) {
        if (!Array.isArray(def.features)) problems.push('features is not a list (like [{ id: "my-module.wear", label: "Wear", default: false }])');
        else def.features.forEach((feature, index) => {
            const where = `feature ${index + 1}`;
            if (!isObject(feature)) { problems.push(`${where} is not an object`); return; }
            const id = feature.id;
            const prefix = `${def.id}.`;
            if (typeof id !== 'string' || !id.startsWith(prefix) || !NAME.test(id.slice(prefix.length))) {
                problems.push(`${where} needs an id made of the module id, a dot and a lowercase name (like "${def.id}.wear")`);
            } else if (ids.has(id)) problems.push(`the feature "${id}" is named twice`);
            else ids.add(id);
            const name = typeof id === 'string' ? `the feature "${id}"` : where;
            if (typeof feature.label !== 'string' || !feature.label.trim()) problems.push(`${name} has no label`);
            else if (feature.label.length > LABEL_MAX) problems.push(`${name} has a label longer than ${LABEL_MAX} characters`);
            if (feature.describe !== undefined && typeof feature.describe !== 'string') problems.push(`${name} describe is not text`);
            else if (typeof feature.describe === 'string' && feature.describe.length > DESCRIBE_MAX) problems.push(`${name} describe is longer than ${DESCRIBE_MAX} characters`);
            if (feature.default !== undefined && typeof feature.default !== 'boolean') problems.push(`${name} default is not true or false`);
            if (feature.prompt !== undefined && typeof feature.prompt !== 'boolean') problems.push(`${name} prompt is not true or false`);
            if (feature.presets !== undefined && feature.presets !== false) {
                const presets = feature.presets;
                if (!isObject(presets)) problems.push(`${name} presets is not false or an object (like { lean: false, full: true })`);
                else for (const key of PRESET_KEYS) if (presets[key] !== undefined && typeof presets[key] !== 'boolean') problems.push(`${name} presets.${key} is not true or false`);
            }
            if (feature.needs !== undefined) {
                const needs = feature.needs;
                const names = list => Array.isArray(list) && list.every(item => typeof item === 'string' && item.trim());
                if (!isObject(needs)) problems.push(`${name} needs is not an object (like { kinds: ["check"], why: "…" })`);
                else {
                    for (const key of ['kinds', 'commands', 'queries']) if (needs[key] !== undefined && !names(needs[key])) problems.push(`${name} needs.${key} is not a list of names`);
                    if (needs.why !== undefined && (typeof needs.why !== 'string' || needs.why.length > WHY_MAX)) problems.push(`${name} needs.why is not text of at most ${WHY_MAX} characters`);
                }
            }
        });
    }
    for (const { where, feature } of featureRefs(def)) {
        if (typeof feature !== 'string') problems.push(`${where} has a feature that is not text`);
        else if (!ids.has(feature)) problems.push(`${where} names the feature "${feature}", which is not one of this module's features`);
    }
    return problems;
}

/** A newer module's fields on a feature entry: plain sentences (logged, ignored). */
export function featureWarnings(def) {
    if (!isObject(def) || !Array.isArray(def.features)) return [];
    return def.features.filter(isObject).flatMap(feature => [
        ...Object.keys(feature).filter(key => !FEATURE_KEYS.includes(key))
            .map(key => `"${key}" on feature "${feature.id}" is not a feature field this Story Block knows; it is ignored`),
        ...(isObject(feature.needs) ? Object.keys(feature.needs) : []).filter(key => !NEEDS_KEYS.includes(key))
            .map(key => `"needs.${key}" on feature "${feature.id}" is not a needs field this Story Block knows; it is ignored`),
        ...(isObject(feature.presets) ? Object.keys(feature.presets) : []).filter(key => !PRESET_KEYS.includes(key))
            .map(key => `"presets.${key}" on feature "${feature.id}" is not a preset this Story Block knows; it is ignored`),
    ]);
}
