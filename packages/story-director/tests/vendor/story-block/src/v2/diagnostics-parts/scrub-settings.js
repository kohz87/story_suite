// A settings object made safe to share: secret keys left out, secret text replaced, long text and lists cut.
import { cutAt } from '../../text.js';
import { LIST_MAX } from './limits.js';
import { isSecretKey, scrubSecrets } from './secrets.js';

const TEXT_MAX = 200;
const DEPTH_MAX = 4;

/**
 * A settings object made safe to share: secret keys left out (listed by name in `removed`), secret-looking
 * text replaced, long text cut, long lists cut with "+N more". Plain JSON in, plain JSON out.
 */
export function scrubSettings(value, removed = [], path = '', depth = 0) {
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
        const clean = scrubSecrets(value);
        return [...clean].length > TEXT_MAX ? `${cutAt(clean, TEXT_MAX)}… (${[...value].length} characters)` : clean;
    }
    if (depth >= DEPTH_MAX) return Array.isArray(value) ? `[${value.length} items]` : '{…}';
    if (Array.isArray(value)) {
        const out = value.slice(0, LIST_MAX).map((item, at) => scrubSettings(item, removed, `${path}[${at}]`, depth + 1));
        if (value.length > LIST_MAX) out.push(`+${value.length - LIST_MAX} more`);
        return out;
    }
    if (typeof value === 'object') {
        const out = {};
        for (const [key, inner] of Object.entries(value)) {
            const where = path ? `${path}.${key}` : key;
            if (isSecretKey(key)) { removed.push(where); continue; }
            if (typeof inner === 'function' || inner === undefined) continue;
            out[key] = scrubSettings(inner, removed, where, depth + 1);
        }
        return out;
    }
    return null;
}
