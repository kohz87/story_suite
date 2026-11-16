// Shared tracker line conversion and application helpers for arc commands.

import { applyThreadLine } from '../../time/tracker/capture.js';
import { itemLine } from '../plan.js';

// A plan item as the change line the tracker reads (SPEC §4.4's parsed form).
export const lineOf = (item, arcId, index, op = '+') => ({
    op, kind: item.kind, word: item.kind, name: item.key, text: item.desc,
    labels: { ...item.parts, arc: arcId }, raw: itemLine(item), index,
});

// Runs plan lines through the tracker's rules as a reply of their own (`plan:<arc>`), then puts the
// tracker's reply count back: a plan is not a reply.
export function applyLines(ctx, director, arcId, lines) {
    const saved = structuredClone(director.turn);
    const lineCtx = Object.freeze({ ...ctx, carrier: Object.freeze({ sid: `plan:${arcId}` }), chat: Object.freeze({ lastUser: '' }) });
    const out = lines.map(line => applyThreadLine(lineCtx, line));
    director.turn = saved;
    return out;
}
