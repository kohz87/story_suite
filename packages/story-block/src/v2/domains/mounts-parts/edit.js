// The reader's pencil on a mount row (`mounts.edit`) and its command table.

import { parseCount } from '../common.js';
import { cleanName, trimText } from '../names.js';
import { STRINGS, fill } from '../../../../../../core/strings.js';
import { MOUNTS_FEATURE } from './feature.js';
import { MAX_NAME, MAX_KIND, MAX_CONDITION, MAX_WHERE } from './caps-text.js';
import { MAX_COUNT, MAX_PACE, MAX_CARRY } from './caps-count.js';
import { whole, paceNumber } from './shared-parse.js';
import { apply } from './apply.js';

const M = STRINGS.mounts;

// The pencil's carry: a whole number 1…MAX_CARRY, or 0 / empty to clear it; null when the field was not sent.
function carryArg(ctx, value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    if (text === '') return 0;
    const n = Number(text);
    if (!Number.isSafeInteger(n) || n < 0 || n > MAX_CARRY) ctx.fail('INVALID', `The carry must be a whole number from 1 to ${MAX_CARRY}, or empty.`);
    return n;
}

/** `mounts.edit({ mount, name?, kind?, count?, pace?, condition?, where?, carry? })`: the reader's pencil on a row, kept on the latest reply. */
function editRow(ctx, payload = {}) {
    if (ctx.cause !== 'ui' || ctx.caller !== null) ctx.fail('REFUSED', M.readerOnly);
    const mount = cleanName(payload.mount);
    if (!mount) ctx.fail('INVALID', M.which);
    const notes = [];
    const text = (field, max) => {
        if (payload[field] === undefined || payload[field] === null) return null;
        if (typeof payload[field] !== 'string') ctx.fail('INVALID', fill(M.notText, { what: field }));
        return field === 'name' ? cleanName(payload[field]) : trimText(payload[field], max);
    };
    const number = (field, max, parse) => (payload[field] === undefined || payload[field] === null ? null : whole(ctx, typeof payload[field] === 'number' ? payload[field] : String(payload[field]), field, max, notes, parse));
    const name = text('name', MAX_NAME);
    if (name !== null && !name) ctx.fail('INVALID', M.needName);
    if (name !== null && Array.from(name).length > MAX_NAME) ctx.fail('INVALID', fill(M.longName, { max: MAX_NAME }));
    const result = apply(ctx, {
        match: mount, rename: name, kind: text('kind', MAX_KIND), count: number('count', MAX_COUNT, parseCount), pace: number('pace', MAX_PACE, paceNumber),
        condition: text('condition', MAX_CONDITION), where: text('where', MAX_WHERE), carry: carryArg(ctx, payload.carry),
    }, { create: false, notes });
    return { ...result, data: { ...result.data, edit: true } };
}

export const mountsCommands = {
    'mounts.edit': Object.assign(editRow, { feature: MOUNTS_FEATURE }),
};
