// Size limits: how many change kinds a draft makes and whether a List of entries fits the instance storage.
import { DM_LIMITS as L } from '../schema.js';
import { dataModuleDefaults } from '../check.js';
import { bytes } from '../interpreter.js';

// (a field hidden from the story has no line the story can write, so it uses no kind)
// (a List of entries field has three lines, one to add an entry, one to change one and one to drop one)
export const blockKindCount = draft => (Array.isArray(draft?.fields) ? draft.fields.filter(field => field?.prompt !== false).reduce((sum, field) => sum + (field?.type === 'entries' ? 3 : 1), 0) : 0)
    + (Array.isArray(draft?.functions) ? draft.functions.filter(fn => fn?.type === 'button').length : 0);

// What one entry of a List of entries takes in the stored instance at worst: every text at its longest (one byte a character; other scripts need more), every
// number at its widest, every choice as its longest word.
const worstEntry = schema => bytes(Object.fromEntries(Object.entries(schema.of).map(([key, sub]) => [key, sub.type === 'text' ? 'x'.repeat(sub.max)
    : sub.type === 'int' ? (String(sub.min).length > String(sub.max).length ? sub.min : sub.max)
        : [...sub.values].sort((a, b) => b.length - a.length)[0]])));
/** → null when every List of entries can hold its `max` entries in the instance storage, else { key, fit }: the first list that cannot and the most entries that would fit. */
export function entriesTooBig(state) {
    const lists = Object.entries(state).filter(([, schema]) => schema.type === 'entries');
    if (!lists.length) return null;
    const base = bytes({ fields: dataModuleDefaults(state), timers: {}, offers: {}, settled: {} });
    const sizes = lists.map(([, schema]) => worstEntry(schema) + 1);
    const total = lists.reduce((sum, [, schema], at) => sum + (schema.max ?? L.entriesDefault) * sizes[at], base);
    if (total <= L.instanceBytes) return null;
    for (const [at, [key, schema]] of lists.entries()) {
        const others = total - (schema.max ?? L.entriesDefault) * sizes[at];
        const fit = Math.floor((L.instanceBytes - others) / sizes[at]);
        if (fit < (schema.max ?? L.entriesDefault)) return { key, fit: Math.max(1, fit), chars: Object.values(schema.of).reduce((sum, sub) => sum + (sub.type === 'text' ? sub.max : 0), 0), kb: Math.round((others + (schema.max ?? L.entriesDefault) * sizes[at]) / 1024) };
    }
    return null;
}
