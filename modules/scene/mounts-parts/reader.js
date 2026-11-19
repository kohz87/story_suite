// The reader's own mount rows from the Bag's Transport list: `mounts.add` (a new row, the `+ mount` line's fields) and
// `mounts.remove` (the `- mount` line). Both are the reader's only, like the pencil (`mounts.edit`). An add never changes a mount
// the party has (that is the pencil's job), so a name already used is refused; a remove marks the row it takes away (apply.js
// remove, ctx.ifThere), so a replay after the reply that made it was deleted passes over it.

import { cleanName, trimText } from '../names.js';
import { STRINGS, fill } from '../../../core/strings.js';
import { MAX_NAME, MAX_KIND, MAX_CONDITION, MAX_WHERE } from './caps-text.js';
import { MAX_COUNT, MAX_PACE } from './caps-count.js';
import { whole, paceNumber } from './shared-parse.js';
import { nameKey } from './shared-keys.js';
import { apply, remove } from './apply.js';

const M = STRINGS.mounts;

function readerOnly(ctx) {
    if (ctx.cause !== 'ui' || ctx.caller !== null) ctx.fail('REFUSED', M.readerOnly);
}

// A text field as stored (one line, cut to `max`); null when not sent; refused when not text.
function text(ctx, payload, field, max) {
    const value = payload[field];
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') ctx.fail('INVALID', fill(M.notText, { what: field }));
    return trimText(value, max);
}

/** `mounts.add({ name, kind?, count?, pace?, condition?, where? })`: the reader adds a mount; a missing pace is the kind's usual one. */
export function addMount(ctx, payload = {}) {
    readerOnly(ctx);
    if (payload.name !== undefined && payload.name !== null && typeof payload.name !== 'string') ctx.fail('INVALID', fill(M.notText, { what: 'name' }));
    const name = cleanName(payload.name);
    if (!name) ctx.fail('INVALID', M.needName);
    if (Array.from(name).length > MAX_NAME) ctx.fail('INVALID', fill(M.longName, { max: MAX_NAME }));
    const scene = ctx.draft('scene');
    if (Object.values(scene.mounts ?? {}).some(row => nameKey(row.name) === nameKey(name))) ctx.fail('REFUSED', fill(M.taken, { name }));
    const notes = [];
    const number = (field, max, parse) => {
        const value = payload[field];
        if (value === undefined || value === null || value === '') return null;
        return whole(ctx, typeof value === 'number' ? value : String(value), field, max, notes, parse);
    };
    const kind = text(ctx, payload, 'kind', MAX_KIND);
    const result = apply(ctx, {
        match: name, kind: kind || null, count: number('count', MAX_COUNT), pace: number('pace', MAX_PACE, paceNumber),
        condition: text(ctx, payload, 'condition', MAX_CONDITION), where: text(ctx, payload, 'where', MAX_WHERE),
    }, { create: true, notes });
    return { ...result, data: { ...result.data, edit: true } };
}

/** `mounts.remove({ mount })`: the reader takes a mount off the party's list. */
export function removeMount(ctx, payload = {}) {
    readerOnly(ctx);
    const mount = cleanName(payload.mount);
    if (!mount) ctx.fail('INVALID', M.which);
    const result = remove(ctx, mount);
    return { ...result, data: { ...result.data, edit: true } };
}
