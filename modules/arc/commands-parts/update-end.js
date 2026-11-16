// Updates a tracked thread with a pending plan item or ends the current arc.

import { lineKey } from '../../../changes.js';
import { currentArc } from '../domain.js';
import { flat, readPlan } from '../plan.js';
import { fail, has, planOptions, revOf } from './shared-helpers.js';
import { applyLines, lineOf } from './shared-apply.js';

/** `director.arc.update { arc, line }` (cause ui): one plan item onto a thread the Director already tracks. */
export function updateArc(ctx, payload = {}) {
    const slice = ctx.draft('arc');
    const current = currentArc(slice);
    if (!current?.active || current.id !== payload?.arc) fail(ctx, 'REFUSED', 'That arc is not the current one.');
    const director = ctx.draft('director');
    const plan = readPlan(String(payload?.line ?? ''), planOptions(ctx, director, { lone: true }));
    const [item] = plan.items;
    if (!item || plan.items.length !== 1) fail(ctx, 'INVALID', 'One plan line is needed.');
    const key = lineKey(item.key);
    const id = has(director.keys, key) ? director.keys[key] : null;
    const thread = id && has(director.threads, id) ? director.threads[id] : null;
    if (!thread) fail(ctx, 'REFUSED', `"${item.key}" is not tracked; it comes with the arc itself.`);
    if (!ctx.claim(`arc:${current.id}:${key}`)) fail(ctx, 'CLAIMED', `"${item.key}" is already part of this arc.`);
    const [result] = applyLines(ctx, director, current.id, [lineOf(item, current.id, 0, thread.status === 'active' ? '~' : '+')]);
    return {
        summary: `Arc ${current.key}: ${item.key}.`,
        narrate: false,
        data: { arc: current.id, thread: result?.data?.thread ?? null },
    };
}

/** `director.arc.end { reason? }` (cause ui): the current arc is over. */
export function endArc(ctx, payload = {}) {
    const slice = ctx.draft('arc');
    const current = currentArc(slice);
    if (!current?.active) fail(ctx, 'REFUSED', 'No arc is running.');
    if (!ctx.claim(`arc:${current.id}:end`)) fail(ctx, 'CLAIMED', 'That arc has already ended.');
    const reason = flat(payload?.reason, 120) || 'the arc ended';
    slice.ends[current.id] = { rev: revOf(ctx), reason };
    return { summary: `Arc ended: ${current.key} (${reason}).`, narrate: false, data: { arc: current.id, reason } };
}
