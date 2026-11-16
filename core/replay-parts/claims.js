// Lists the claim keys a block's ops add.

import { isObject } from './shared-object.js';

const unescapeKey = key => key.replace(/~1/g, '/').replace(/~0/g, '~');

/**
 * The claim keys a list of ops adds, in order: `/meta/claims/<key>` adds, or one `/meta/claims` add or
 * replace whose value is a record of keys. Removals are not claims.
 */
export function claimKeys(ops) {
    const out = [];
    for (const op of Array.isArray(ops) ? ops : []) {
        if (!isObject(op) || (op.op !== 'add' && op.op !== 'replace') || typeof op.path !== 'string') continue;
        if (op.path === '/meta/claims') {
            if (isObject(op.value)) for (const key of Object.keys(op.value)) if (!out.includes(key)) out.push(key);
        } else if (op.path.startsWith('/meta/claims/') && !op.path.slice(13).includes('/')) {
            const key = unescapeKey(op.path.slice(13));
            if (key && !out.includes(key)) out.push(key);
        }
    }
    return out;
}
