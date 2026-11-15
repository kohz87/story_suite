// Reads and clamps arc planning settings from module values.

import { DEFAULTS, NS, PROMPT_MAX } from './schema.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const int = (value, min, max, fallback) => (Number.isSafeInteger(value) ? Math.min(max, Math.max(min, value)) : fallback);

/** The arc settings out of the module's values (`arc.*` keys, or a part's own un-namespaced ones). */
export function arcSettings(values) {
    const given = isRecord(values) ? values : {};
    const get = key => (Object.hasOwn(given, `${NS}${key}`) ? given[`${NS}${key}`] : given[key]);
    const text = (key, max) => (typeof get(key) === 'string' ? get(key).slice(0, max) : DEFAULTS[key]);
    return {
        profile: text('profile', 100).trim(),
        trigger: get('trigger') === 'auto' ? 'auto' : 'manual',
        autoAccept: get('autoAccept') === true,
        genre: text('genre', 200),
        note: text('note', 1000),
        keepNote: get('keepNote') === true,
        prompt: text('prompt', PROMPT_MAX),
        recent: int(get('recent'), 4, 200, DEFAULTS.recent),
        maxTokens: int(get('maxTokens'), 300, 8000, DEFAULTS.maxTokens),
        stallDays: int(get('stallDays'), 1, 365, DEFAULTS.stallDays),
        lowThreads: int(get('lowThreads'), 0, 20, DEFAULTS.lowThreads),
    };
}
