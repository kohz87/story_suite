// Memories from the lines (NSD8), only while lines mode is on. The words of a `~ npc` line's why:, of a lie and of a milestone are saved as that person's memory by code
// (withMemories); `~ memory Name | what happened` is only for a moment no line covers, at most two a reply (memoryLine). Code owns who, the story day and the cap and trim
// (the dossier's five important memories, applied where a record is read; storage only appends); a memory already stored, or one that only rewords it, is not stored twice. The writes are the reply's own
// (`people.memory` in the line's transaction), so a swipe, a middle delete, a Re-read and a reload decide them again the same way.
import { clean, isInt, slug, REASON_LABELS } from '../npc-meters-config.js';
import { normalizeName } from '../../core-text.js';
import { normalizeStoredMemories } from '../../core-record-shared.js';
import { knownPerson } from './stub.js';

export const MEMORY_PER_REPLY = 2;
const MEMORY_MAX = 300;
const MEMORY_STORE_MAX = 400;   // what people.memory takes (Story Block's own cap is 500)

// The memories this reply's `~ memory` lines already saved, across every person (a stamp keeps its reply's sid in `s`).
const savedBy = (ctx, sid) => Object.values(ctx.read('people')?.npcs ?? {}).reduce((count, record) => count + Object.values(record?.memoryStamps ?? {}).filter(stamp => stamp?.s === sid).length, 0);

/** Saves `text` as `key`'s memory on this reply → '' when saved, else why not. `tag`: true marks it as a `~ memory` line's (counted against the cap). `date`: the story day text ('' when none). */
function saveMemory(ctx, { key, text, date = '', tag = false }) {
    const record = ctx.read('people')?.npcs?.[key];
    const said = clean(text, MEMORY_MAX);
    if (!record) return 'no dossier';
    if (!said) return 'says nothing';
    const at = isInt(ctx.carrier?.index) ? ctx.carrier.index : null;
    const sid = typeof ctx.carrier?.sid === 'string' ? ctx.carrier.sid : null;
    if (tag && sid && savedBy(ctx, sid) >= MEMORY_PER_REPLY) return `at most ${MEMORY_PER_REPLY} memories a reply`;
    const before = Array.isArray(record.memories) ? record.memories : [];
    if (before.length >= MEMORY_STORE_MAX) return 'the list is full';
    // Storage only ever grows by one at the end (an add, never a replace of what an earlier reply wrote, so deleting that reply takes only its own memory); the
    // dossier's five-memory cap and trim happen where a record is read (normalizeNpcRecord). normalizeStoredMemories is used here to tell a repeat or a rewording.
    const recent = normalizeStoredMemories([...before.slice(-8), said]);
    if (!recent.some(item => normalizeName(item) === normalizeName(said)) || before.some(item => normalizeName(item) === normalizeName(said))) return 'already stored';
    const stamp = { m: at ?? 0, ...(date ? { d: String(date).slice(0, 40) } : {}), ...(tag && sid ? { s: sid } : {}) };
    const stamps = { ...(record.memoryStamps ?? {}), [normalizeName(said)]: stamp };
    const memories = [...before, said];
    ctx.call('people.memory', { id: key, memories, stamps });
    return '';
}

/** The `~ memory Name | sentence` line: refused for an unknown person, a missing sentence, a repeat or a third in a reply. `deps.date(at)` → the story day text. */
export function memoryLine(ctx, line, deps) {
    const raw = typeof line?.raw === 'string' ? line.raw.split('|').slice(1).join('|') : String(line?.text ?? '');
    const found = knownPerson(ctx, line?.name);
    if (!found) ctx.fail('REFUSED', `${clean(line?.name, 40)} has no record yet; write + npc ${clean(line?.name, 40)} | role | look first.`);
    const at = isInt(ctx.carrier?.index) ? ctx.carrier.index : null;
    const why = saveMemory(ctx, { key: found.key, text: raw, date: deps.date(at), tag: true });
    if (why) ctx.fail('REFUSED', `~ memory ${clean(line?.name, 40)}: ${why}.`);
    return { summary: `${clean(line.name, 40)}: a memory.`, data: { key: found.key, memory: true }, narrate: false };
}

// The words a line leaves as a memory (or ''), exactly as written: a `~ npc` line's why:, a told lie's said:, a milestone.
function wordsOf(line) {
    if (line.kind === 'npc' && line.op === '~') {
        const why = Object.entries(line.labels ?? {}).find(([label, raw]) => REASON_LABELS.has(slug(label)) && String(raw ?? '').trim());
        return why ? why[1] : '';
    }
    if (line.kind === 'lie' && !/^(yes|true)$/i.test(String(line.labels?.caught ?? '').trim()) && line.labels?.said) return line.labels.said;
    return line.kind === 'milestone' && line.op === '+' ? line.text : '';
}

/** `handler` with the memory its line's words make, saved after the line applied (lines mode only; a repeat or a missing record saves nothing and never refuses the line). */
export function withMemories(handler, { linesMode, date }) {
    return function remembered(ctx, line = {}) {
        const out = handler(ctx, line);
        if (!linesMode(ctx)) return out;
        const text = wordsOf(line);
        const found = text ? knownPerson(ctx, line.name) : null;
        if (found) saveMemory(ctx, { key: found.key, text, date: date(isInt(ctx.carrier?.index) ? ctx.carrier.index : null) });
        return out;
    };
}
