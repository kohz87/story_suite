// Memories from the lines (NSD8), only while lines mode is on. The words of a `~ npc` line's why: and memory:, of a lie and of a milestone are saved as that person's memory by code
// (withMemories); `~ memory Name | what happened` is only for a moment no line covers, at most two a reply (memoryLine). Code owns who, the story day and the cap and trim
// (the dossier's five important memories, applied where a record is read; the runtime's own per-reply write also trims to five, so storage appends only between those writes); a memory already stored, or one that only rewords it, is not stored twice. The writes are the reply's own
// (`people.memory` in the line's transaction), so a swipe, a middle delete, a Re-read and a reload decide them again the same way. A retelling of a memory this same
// reply already stored (a why: and a memory: about one event) is not stored either.
import { NPC_DOMAIN, clean, isInt, slug, REASON_LABELS } from '../npc-meters-config.js';
import { sentence } from '../npc-meters-slice-parts/receipt.js';
import { normalizeName } from '../../core/core-text.js';
import { normalizeStoredMemories } from '../../core/core-record-shared.js';
import { sameReplyRetelling } from '../../core/core-record-merge.js';
import { knownPerson, readStub } from './stub.js';
import { knownOrCast } from './cast-first.js';

export const MEMORY_PER_REPLY = 2;
const MEMORY_MAX = 300;
const MEMORY_STORE_MAX = 400;   // what people.memory takes (Story Block's own cap is 500)

// The memories this reply's `~ memory` lines already saved, across every person (a stamp keeps its reply's sid in `s`).
const savedBy = (ctx, sid) => Object.values(ctx.read('people')?.npcs ?? {}).reduce((count, record) => count + Object.values(record?.memoryStamps ?? {}).filter(stamp => stamp?.s === sid).length, 0);

const LABEL_PER_REPLY_TEXT = 'only one memory: line per person a reply';
// Two lines of one reply are written on purpose, so they are one event only when they share four distinctive words (names left out): Rorke's
// "Delivered…report…wrecked charcoal wagon" / "Listened…report…" pair shares five; "Pulled Hollis out from under the wrecked charcoal wagon" and
// "Watched Hollis sell the wrecked charcoal wagon" share three and are two events (REV-dfx2b F1). A scan's second pass keeps three.
const LINE_RETELLING_SHARED = 4;

/** Saves `text` as `key`'s memory on this reply → '' when saved, else why not. `tag`: true marks it as a `~ memory` line's (counted against the cap). `label`: true marks
 *  it as a memory: label's (`l`: the reply's sid; one a person a reply); any other keeps the sid as `r`, so every line memory knows its reply. `date`: the story day text ('' when none). */
function saveMemory(ctx, { key, text, date = '', tag = false, label = false }) {
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
    // The same event told twice in this reply (a why: and a memory: or a `~ memory` in other words) is one memory: the first stays. Only this reply's own line
    // memories are compared, found by the reply's sid (an index is taken again after a middle delete), so two events of different replies that share words are
    // both kept (core-record-merge-parts/memories.js sameReplyRetelling).
    const mine = sid ? before.filter(item => [record.memoryStamps?.[normalizeName(item)]].some(own => own && (own.s === sid || own.l === sid || own.r === sid))) : [];
    if (mine.length && sameReplyRetelling(said, mine, Object.fromEntries(mine.map(item => [normalizeName(item), { m: 0 }])), 0, record.manualMemories, { minShared: LINE_RETELLING_SHARED })) return 'already stored';
    // At most one memory: a person a reply (REV-dossa F4): six lines of memory: would otherwise push every earlier memory out of the five the dossier keeps.
    if (label && sid && Object.values(record.memoryStamps ?? {}).some(stamp => stamp?.l === sid)) return LABEL_PER_REPLY_TEXT;
    const stamp = { m: at ?? 0, ...(date ? { d: String(date).slice(0, 40) } : {}), ...(tag && sid ? { s: sid } : {}), ...(label && sid ? { l: sid } : {}), ...(sid && !tag && !label ? { r: sid } : {}) };
    const stamps = { ...(record.memoryStamps ?? {}), [normalizeName(said)]: stamp };
    const memories = [...before, said];
    ctx.call('people.memory', { id: key, memories, stamps });
    return '';
}

/**
 * The `~ memory Name | sentence` line: refused for an unknown person, a missing sentence, a repeat or a third in a reply. `deps.date(at)` → the story day text;
 * `deps.castFirst` (./cast-first.js): a pack person met or present here gets their dossier from the pack first (S2PA B1).
 */
export function memoryLine(ctx, line, deps) {
    const raw = typeof line?.raw === 'string' ? line.raw.split('|').slice(1).join('|') : String(line?.text ?? '');
    const found = knownOrCast(ctx, line?.name, deps.castFirst);
    if (!found) ctx.fail('REFUSED', `${clean(line?.name, 40)} has no record yet; write + npc ${clean(line?.name, 40)} | role | look first.`);
    if (found.record?.lifeState === 'deceased') ctx.fail('REFUSED', `${clean(found.record.name, 40)} has died; lines about them change nothing now.`);   // (F44)
    const at = isInt(ctx.carrier?.index) ? ctx.carrier.index : null;
    const why = saveMemory(ctx, { key: found.key, text: raw, date: deps.date(at), tag: true });
    if (why) ctx.fail('REFUSED', `~ memory ${clean(line?.name, 40)}: ${why}.`);
    return { summary: `${clean(line.name, 40)}: a memory.`, data: { key: found.key, memory: true }, narrate: false };
}

// The words a line leaves as memories, exactly as written: a `~ npc` line's why: and its memory: (owner-approved 21 Nov: something they will remember that moved
// no meter), a `+ npc` stub's memory: part (REV-dossa F5; ./stub.js readStub keeps it out of the look), a told lie's said:, a milestone. `memory` marks the
// memory: label's words (never kept for someone who has died; one a person a reply).
function wordsOf(line) {
    if (line.kind === 'npc' && line.op === '+') {
        const { memory } = readStub(line);
        return memory ? [{ text: memory, memory: true }] : [];
    }
    if (line.kind === 'npc' && line.op === '~') {
        const labelled = test => Object.entries(line.labels ?? {}).find(([label, raw]) => test(slug(label)) && String(raw ?? '').trim());
        const why = labelled(key => REASON_LABELS.has(key));
        const memory = labelled(key => key === 'memory');
        return [...(why ? [{ text: why[1] }] : []), ...(memory ? [{ text: memory[1], memory: true }] : [])];
    }
    if (line.kind === 'lie' && !/^(yes|true)$/i.test(String(line.labels?.caught ?? '').trim()) && line.labels?.said) return [{ text: line.labels.said }];
    return line.kind === 'milestone' && line.op === '+' && line.text ? [{ text: line.text }] : [];
}

/** `handler` with the memories its line's words make, saved after the line applied (lines mode only; a repeat or a missing record saves nothing and never refuses the line;
 *  a second memory: for the person in this reply is a problem on the line: `note(slice, rev, problems)` keeps it with NPC State's problems). */
export function withMemories(handler, { linesMode, date, note = null }) {
    return function remembered(ctx, line = {}) {
        const out = handler(ctx, line);
        if (!linesMode(ctx)) return out;
        const words = wordsOf(line);
        const found = words.length ? knownPerson(ctx, line.name) : null;
        if (!found) return out;
        const day = date(isInt(ctx.carrier?.index) ? ctx.carrier.index : null);
        const problems = [];
        for (const { text, memory } of words) {
            if (memory && ctx.read('people')?.npcs?.[found.key]?.lifeState === 'deceased') continue;
            const why = saveMemory(ctx, { key: found.key, text, date: day, label: memory === true });
            if (why === LABEL_PER_REPLY_TEXT) problems.push(`${clean(found.record?.name ?? line.name, 40)}: ${LABEL_PER_REPLY_TEXT}; this one was not stored.`);
        }
        if (!problems.length) return out;
        if (typeof note === 'function') note(ctx.draft(NPC_DOMAIN), ctx.rev, problems);
        return { ...out, summary: sentence([out.summary, ...problems]), data: { ...out.data, problems: [...(out.data?.problems ?? []), ...problems] } };
    };
}
