// The people view's plain-JSON copy (view.js): clock fields and undefined values dropped, a hidden note's threshold `at` kept. Pure.

// Date.now-valued keys; dropped only when the value is a number or null (the golden's own rule).
const VOLATILE = new Set(['updatedAt', 'createdAt', 'archivedAt', 'correctedAt', 'at']);

export const isPlain = value => !!value && typeof value === 'object' && !Array.isArray(value);

// A deep plain-JSON copy without the clock fields and without undefined values. A hidden note's `at` (in a record's `secrets` list) is its meter
// threshold ("opens at Trust 2"), not a clock: it is kept (SOAKPEOPLE F47: without it the note lost its rule and vanished from the dossier).
export function stripVolatile(value, keepAt = false) {
    if (Array.isArray(value)) return value.map(item => (item === undefined ? null : stripVolatile(item, keepAt)));
    if (!isPlain(value)) return value;
    const out = {};
    for (const key of Object.keys(value)) {
        const item = value[key];
        if (item === undefined) continue;
        if (VOLATILE.has(key) && (typeof item === 'number' || item === null) && !(keepAt && key === 'at' && typeof item === 'number')) continue;
        out[key] = key === 'secrets' && Array.isArray(item) ? item.map(note => (note === undefined ? null : stripVolatile(note, true))) : stripVolatile(item);
    }
    return out;
}

export const list = value => (Array.isArray(value) ? value : []);
