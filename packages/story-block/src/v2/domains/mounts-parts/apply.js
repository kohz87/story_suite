// Adds, changes or removes one mount row in the scene draft.

import { STRINGS, fill } from '../../strings.js';
import { escapeKey } from '../../ops.js';
import { MAX_ROWS } from './caps-count.js';
import { paceOfKind } from './pace.js';
import { nameKey, rowKey } from './shared-keys.js';

const M = STRINGS.mounts;

const told = ctx => ctx.cause !== 'story';

function rowOf(scene, name) {
    const key = nameKey(name);
    return Object.entries(scene.mounts ?? {}).find(([, row]) => nameKey(row.name) === key) ?? [null, null];
}

const FIELDS = ['name', 'kind', 'count', 'pace', 'condition', 'where', 'carry'];

// `match` is the mount the line names; `rename` (the pencil only) is the name it should have now.
export function apply(ctx, { match, rename: to = null, kind, count, pace, condition, where, carry = null }, { create, notes = [] }) {
    const scene = ctx.draft('scene');
    const name = match;
    const [key, found] = rowOf(scene, match);
    if (!found) {
        if (!create) return ctx.fail('NOT_FOUND', fill(M.none, { name: match }));
        const rows = Object.keys(scene.mounts ?? {}).length;
        if (rows >= MAX_ROWS) return ctx.fail('REFUSED', fill(M.full, { max: MAX_ROWS, name }));
        scene.mounts ??= {};
        let at = rowKey(name);
        for (let n = 2; Object.hasOwn(scene.mounts, at); n += 1) at = `${rowKey(name)}#${n}`;
        const row = { name, kind: kind ?? '', count: count ?? 1, pace: pace ?? paceOfKind(kind), condition: condition ?? '', where: where ?? '' };
        scene.mounts[at] = row;
        return { summary: fill(M.added, { name, n: row.count > 1 ? ` ×${row.count}` : '', about: [row.kind, `${row.pace} km/day`].filter(Boolean).join(', ') }), data: { name, key: at, created: true }, narrate: told(ctx), ...(notes.length ? { problem: notes.join(' ') } : {}) };
    }
    // Only this row's own changes are written, so a replay after an earlier reply was deleted finds it as it is.
    ctx.ifThere('scene', `/mounts/${escapeKey(key)}`);
    const row = scene.mounts[key];
    const before = { ...row };
    if (to && to !== row.name) {
        if (Object.values(scene.mounts).some(other => other !== row && nameKey(other.name) === nameKey(to))) return ctx.fail('REFUSED', fill(M.taken, { name: to }));
        row.name = to;
    }
    if (kind !== null && kind !== undefined) {
        // A pace left at the old kind's usual one follows the new kind, unless the line gives one.
        if (pace === null && row.pace === paceOfKind(row.kind)) row.pace = paceOfKind(kind);
        row.kind = kind;
    }
    if (count !== null && count !== undefined) row.count = count;
    if (pace !== null && pace !== undefined) row.pace = pace;
    if (condition !== null && condition !== undefined) row.condition = condition;
    if (where !== null && where !== undefined) row.where = where;
    // The reader's own carry (0 or empty clears it, back to the kind's usual one).
    if (carry !== null && carry !== undefined) { if (carry > 0) row.carry = carry; else delete row.carry; }
    const changed = FIELDS.filter(field => row[field] !== before[field]);
    const parts = changed.filter(field => field !== 'name').map(field => (field === 'pace' ? `${row.pace} km/day` : field === 'count' ? `×${row.count}` : field === 'carry' ? (row.carry ? `carry ${row.carry}` : fill(M.cleared, { field })) : row[field] || fill(M.cleared, { field })));
    const rename = changed.includes('name') ? fill(M.renamed, { old: before.name, name: row.name }) : '';
    return {
        summary: changed.length ? `${[rename, parts.length ? `${row.name}: ${parts.join(', ')}` : ''].filter(Boolean).join('; ')}.` : fill(M.same, { name: row.name }),
        data: { name: row.name, key, changed },
        narrate: told(ctx) && changed.length > 0,
        ...(notes.length ? { problem: notes.join(' ') } : {}),
    };
}

export function remove(ctx, name) {
    const scene = ctx.draft('scene');
    const [key, row] = rowOf(scene, name);
    // The story often takes away a mount the party never had (or already lost): nothing to undo, as with `- present`.
    if (!row && ctx.cause === 'story') return { summary: fill(M.notWith, { name }), data: { name, missing: true }, narrate: false };
    if (!row) return ctx.fail('NOT_FOUND', fill(M.none, { name }));
    ctx.ifThere('scene', `/mounts/${escapeKey(key)}`);
    delete scene.mounts[key];
    return { summary: fill(M.removed, { name: row.name }), data: { name: row.name, key, removed: true }, narrate: told(ctx) };
}
