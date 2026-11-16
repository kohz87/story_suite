// Display labels for values: the names text of a number field and the default tone of a status value.
import { oneLine } from '../../../core/text.js';
import { dmDefaultTone } from '../schema.js';

/** The tone a status value has unless the author changed it. */
export const defaultTone = dmDefaultTone;
// Display names written as lines ("1 = I") or given as an object; null when they cannot be read, {} when there are none.
export function parseNames(value) {
    if (value === undefined || value === null || value === '') return {};
    const out = {};
    const add = (key, name) => {
        const at = String(key).trim(), text = oneLine(name);
        if (!/^-?\d+$/.test(at) || !text || Object.hasOwn(out, String(Number(at)))) return false;
        out[String(Number(at))] = text;
        return true;
    };
    if (typeof value === 'string') {
        for (const line of value.split('\n')) {
            if (!line.trim()) continue;
            const match = /^\s*(-?\d+)\s*[=:]\s*(.+?)\s*$/.exec(line);
            if (!match || !add(match[1], match[2])) return null;
        }
        return out;
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    for (const [key, name] of Object.entries(value)) if (!add(key, name)) return null;
    return out;
}
/** The names as the editor's lines, one "value = name" each. */
export const namesText = names => Object.entries(names ?? {}).sort(([a], [b]) => Number(a) - Number(b)).map(([value, name]) => `${value} = ${name}`).join('\n');
