// Accepts a new arc plan, stores its arc record, and creates fresh tracker threads.

import { lineKey } from '../../world/changes.js';
import { ARC_ROOM, arcList } from '../domain.js';
import { flat, itemLine, planCounts, readPlan } from '../plan.js';
import { fail, has, planOptions, revOf } from './shared-helpers.js';
import { applyLines, lineOf } from './shared-apply.js';

const REASONS = new Set(['manual', 'no-arc', 'arc-end', 'stalled', 'running-low']);
const ID_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';
const ARC_ID = /^arc_[0-9a-z]{8}$/;

function newArcId(ctx, taken) {
    for (let tries = 0; tries < 64; tries += 1) {
        let id = typeof ctx.id === 'function' ? ctx.id('arc') : '';
        if (!ARC_ID.test(id ?? '')) {
            id = 'arc_';
            for (let i = 0; i < 8; i += 1) id += ID_CHARS[Math.floor(ctx.rng() * ID_CHARS.length) % ID_CHARS.length];
        }
        if (!has(taken, id)) return id;
    }
    throw new Error('No free arc id.');
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function countsText(plan) {
    const counts = planCounts(plan);
    return [
        counts.beat ? plural(counts.beat, 'beat') : '', counts.agenda ? plural(counts.agenda, 'agenda') : '',
        counts.hook ? plural(counts.hook, 'hook') : '', counts.clock ? plural(counts.clock, 'clock') : '',
        counts.secret ? plural(counts.secret, 'secret') : '',
    ].filter(Boolean).join(', ');
}

/** `director.arc.accept { plan, reason?, note? }` (cause ui). */
export function acceptArc(ctx, payload = {}) {
    const text = typeof payload?.plan === 'string' ? payload.plan : '';
    if (!text.trim()) fail(ctx, 'INVALID', 'There is no plan to accept.');
    const director = ctx.draft('director');
    const plan = readPlan(text, planOptions(ctx, director));
    const error = plan.findings.find(entry => entry.severity === 'error');
    if (error) fail(ctx, 'INVALID', error.text);
    const slice = ctx.draft('arc');
    const id = newArcId(ctx, slice.arcs);
    const minutes = director.time?.minutes;
    slice.arcs[id] = {
        id,
        key: plan.arc.key,
        desc: plan.arc.desc,
        rev: revOf(ctx),
        minutes: Number.isSafeInteger(minutes) ? minutes : null,
        reason: REASONS.has(payload?.reason) ? payload.reason : 'manual',
        note: flat(payload?.note, 16),
    };
    // The oldest arcs past ARC_ROOM go, by key, with their endings.
    const list = arcList(slice);
    for (const old of list.slice(0, Math.max(0, list.length - ARC_ROOM))) {
        delete slice.arcs[old.id];
        if (has(slice.ends, old.id)) delete slice.ends[old.id];
    }
    const fresh = [];
    const pending = [];
    for (const item of plan.items) {
        if (has(director.keys, lineKey(item.key))) pending.push(itemLine(item));
        else fresh.push(item);
    }
    const results = applyLines(ctx, director, id, fresh.map((item, index) => lineOf(item, id, index)));
    const added = results.map(result => result?.data?.thread).filter(thread => typeof thread === 'string');
    const counts = countsText(plan);
    return {
        summary: `New arc: ${plan.arc.key}${counts ? ` (${counts})` : ''}.`,
        // The Director note carries the arc and its threads from the next reply on.
        narrate: false,
        data: { arc: id, added, pending },
    };
}
