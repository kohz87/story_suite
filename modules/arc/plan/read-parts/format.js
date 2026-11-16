// Story Director v2, part **arc**: formatting plans as editable text, counting items, and hashing notes.

import { KIND_ORDER } from '../shared.js';

/** One plan item as its text line ("BEAT: Key — what | on: …"). */
export function itemLine(item) {
    const label = item.kind === 'arc' ? 'ARC' : item.kind.toUpperCase();
    const parts = Object.entries(item.parts ?? {}).map(([name, value]) => ` | ${name}: ${value}`).join('');
    return `${label}: ${item.key}${item.desc ? ` — ${item.desc}` : ''}${parts}`;
}

/** The plan as text, one line an item: what the review shows and the reader may edit; readPlan reads it back the same. */
export function planText(plan) {
    const lines = [];
    if (plan?.arc) lines.push(itemLine({ kind: 'arc', key: plan.arc.key, desc: plan.arc.desc }));
    for (const item of plan?.items ?? []) lines.push(itemLine(item));
    return lines.join('\n');
}

/** How many of each kind a plan holds: `{ beat, agenda, hook, clock, secret }`. */
export function planCounts(plan) {
    const counts = Object.fromEntries(KIND_ORDER.map(kind => [kind, 0]));
    for (const item of plan?.items ?? []) if (Object.hasOwn(counts, item.kind)) counts[item.kind] += 1;
    return counts;
}

/** A short hash of the Director's note (FNV-1a, base 36), so an arc can say which note it was planned with. */
export function noteMark(note) {
    const text = String(note ?? '').trim().replace(/\s+/g, ' ');
    if (!text) return '';
    let hash = 0x811c9dc5;
    for (const char of text) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(36);
}
