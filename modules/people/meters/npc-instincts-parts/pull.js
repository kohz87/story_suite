// The pull for one NPC: the three signals, the per-NPC instinct values and the top pressure.
import { INSTINCT_KINDS, INSTINCT_KEYS } from './kinds.js';
import { readBelonging, readClosure, readAwe } from './readers.js';

// The pull for one NPC: the three signals, the per-NPC inst values (belo, clos, awe) and the top pressure.
// The top pressure is the highest-scoring signal; ties go to the earlier kind in INSTINCT_KINDS.
// Preservation and Comfort are not built here (no data for non-party NPCs).
export function readInstincts(input) {
    const signals = [readBelonging(input), readClosure(input), readAwe(input)];
    const inst = { belo: 0, clos: 0, awe: 0 };
    let top = null;
    // `input.scale(key, score)` (optional): the person's drive for that instinct scales the score before it is read (a muted drive: no pull).
    const scale = typeof input?.scale === 'function' ? input.scale : null;
    for (const found of signals) {
        if (!found) continue;
        const signal = scale ? { ...found, score: scale(INSTINCT_KEYS[found.kind], found.score) } : found;
        inst[INSTINCT_KEYS[signal.kind]] = Math.max(0, Math.min(3, Math.floor(signal.score)));
        if (signal.score < 1) continue;
        if (!top || signal.score > top.score || (signal.score === top.score && INSTINCT_KINDS.indexOf(signal.kind) < INSTINCT_KINDS.indexOf(top.kind))) top = signal;
    }
    return { inst, pressure: top ? { kind: top.kind, cause: top.cause, since: top.since } : null };
}
