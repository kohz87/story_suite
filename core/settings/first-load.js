// Replaces an old-shaped Story Suite settings tree on first load, keeping the old object untouched as storySuite_legacy.

import { SETTINGS_SCHEMA } from './schema.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Ensures `extensionSettings.storySuite` is the schema-1 defaults tree. If the existing tree has any
 * other schema, the whole object moves to `storySuite_legacy` without being read or mapped, then the
 * defaults are copied in and marked with the current schema. A second call changes nothing.
 */
export function firstLoadSettings(extensionSettings, defaults) {
    if (!isRecord(extensionSettings)) throw new TypeError('Extension settings must be an object.');
    if (!isRecord(defaults)) throw new TypeError('Story Suite defaults must be an object.');
    const current = extensionSettings.storySuite;
    if (isRecord(current) && current.schema === SETTINGS_SCHEMA) return current;
    if (current !== undefined) extensionSettings.storySuite_legacy = current;
    const next = structuredClone(defaults);
    next.schema = SETTINGS_SCHEMA;
    extensionSettings.storySuite = next;
    return next;
}
