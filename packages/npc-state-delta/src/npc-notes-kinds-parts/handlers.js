// The note kinds (lie, know, taste, tie) and running one parsed line through its kind.
import { addLie, catchLie, caughtSummary } from '../npc-notes-lies.js';
import { addKnow, openKnow } from '../npc-notes-knows.js';
import { addTaste, tastesText } from '../npc-notes-tastes.js';
import { readTies, applyTags, tiesText } from '../npc-notes-ties.js';

const NO_NOTES = Object.freeze({ run() {}, flag() {} });

// lie: `~ lie` tells a lie (to, said); `~ lie catch` stamps the latest matching uncaught lie as caught (trust drop via notes.run).
function lieKind(current, line, ctx) {
    if (line.catch) {
        const hit = catchLie(current, { to: line.to, said: line.said, day: ctx.day, r: ctx.r, tier: ctx.tier, drop: ctx.drop });
        if (!hit) return { text: current, problem: `No uncaught lie to ${String(line.to ?? '')} matches that catch.` };
        ctx.notes.run(hit.change);
        ctx.notes.flag(caughtSummary(ctx.name, hit.entry.to));
        return { text: hit.text, problem: '' };
    }
    const out = addLie(current, { to: line.to, said: line.said, day: ctx.day, r: ctx.r });
    return { text: out.text, problem: out.problem };
}

// know: `~ know` records one reply's lines (lines: [{ about, fact, how, secret? }]); `~ know open` opens a secret (about, fact).
function knowKind(current, line, ctx) {
    if (line.open) return { text: openKnow(current, line.about, line.fact) ?? current, problem: '' };
    const out = addKnow(current, ctx.r, line.lines, { tolerant: ctx.knowRule === 1 });
    return { text: out.text ?? current, problem: out.problem ?? '' };
}

// taste: `~ taste` captures a likes/dislikes item. A refused change keeps the list; a mirrored one is kept and flagged.
function tasteKind(current, line, ctx) {
    const out = addTaste(current, {
        name: ctx.name, sign: line.sign, item: line.item, from: line.from, why: line.why, day: ctx.day, r: ctx.r, userText: ctx.userText, rule: ctx.tasteRule,
    });
    if (out.status === 'refused') return { text: current, problem: out.problem };
    if (out.problem) ctx.notes.flag(out.problem, out.cue);
    return { text: tastesText(out.tastes), problem: '' };
}

// tie: `~ tie` applies +ally / -rival / +owes between this person and `with`. An empty result returns null (the host drops the leaf).
function tieKind(current, line, ctx) {
    const base = current ? readTies(current) : {};
    if (base === null) return { text: current, problem: 'The stored ties are not valid.' };
    const out = applyTags(base, { self: ctx.name, with: line.with, tags: line.tags });
    if (out.refused) return { text: current, problem: `The tie is refused (${out.refused}).` };
    if (out.ignored.length) return { text: current, problem: `Unknown tie tag: ${out.ignored.join(', ')}.` };
    return { text: tiesText(out.ties), problem: '' };
}

export const KINDS = Object.freeze({
    lie: Object.freeze({ field: 'lies', handle: lieKind }),
    know: Object.freeze({ field: 'knows', handle: knowKind }),
    taste: Object.freeze({ field: 'tastes', handle: tasteKind }),
    tie: Object.freeze({ field: 'ties', handle: tieKind }),
});

/** Runs one parsed line through its kind → { field, text, problem }. An unknown kind is refused with a problem; nothing is written. */
export function runKind(kind, current, line, ctx = {}) {
    const entry = Object.hasOwn(KINDS, kind) ? KINDS[kind] : null;
    if (!entry) return { field: null, text: current, problem: `Unknown note kind: ${String(kind)}.` };
    return { field: entry.field, ...entry.handle(current, line ?? {}, { ...ctx, notes: ctx.notes ?? NO_NOTES }) };
}
