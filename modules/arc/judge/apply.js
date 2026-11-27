// Story Director v2, part **arc**: applying the Director judge's verdicts to a read plan (switch story-director.world-events). Code has the last word:
// an accepted item stays; a reshaped line is read again by the strict plan reader and the react-not-resolve guard, and is a refusal when it does not
// read as one item of the same kind or the guard refuses it; a refusal drops the item with a note (the adopted note when it names an Active event, so the
// text is the guard's own). An item the judge did not answer stays. Pure; it runs on the planner's answer, never on the reader's edited text.

import { lineKey } from '../../world/changes.js';
import { readPlan } from '../plan/read.js';
import { refuseResolving, refusalNote } from '../plan/world-guard.js';
import { flat } from '../plan/shared.js';
import { finder } from '../plan/read-parts/cite-match.js';

const JUDGED = new Set(['beat', 'clock', 'agenda']);
const EVENT = /^event\s*[:\-–—]?\s*["“'‘](.+?)["”'’]\s*(?:\([^()]*\))?\s*\.?$/i;

/** The note for a refusal outside the adopted event wording (recorded in NSD-WORDING.md). */
export const reasonNote = (kind, reason) => `Refused: this ${kind} was left out: ${flat(reason, 160).replace(/[.!?]+$/, '')}.`;

function noteFor(item, rest, events) {
    const named = EVENT.exec(rest)?.[1]?.trim();
    if (!named) return reasonNote(item.kind, rest || 'the Director refused it');
    // The name may be quoted as the brief cut it, or with the rest of its line after it.
    const found = finder(events.flatMap(each => [each?.title, each?.id]).filter(name => typeof name === 'string'))(named);
    const event = found === null ? null : events.find(each => each?.title === found || each?.id === found);
    return event ? refusalNote(item.kind, event.title) : reasonNote(item.kind, `it decides how "${named}" ends`);
}

// The corrected line as one item of the same kind, or null (it did not read, read as something else, or decides an Active event).
function reshaped(item, line, events, options) {
    const text = String(line ?? '').trim();
    if (!text) return null;
    const read = readPlan(text, { ...options, lone: true });
    if (read.items.length !== 1 || read.items[0].kind !== item.kind) return null;
    return refuseResolving(read, events).refused.length ? null : read.items[0];
}

/**
 * `{ read, refused: [note], tally: { accept, reshape, refuse } }`: `read` (readPlan's result, after the guard) with the judge's verdicts applied. `answer`: readJudge's
 * result; `events`: the brief's `guard`; `options`: the plan reader's options. The judged items (beats, clocks, agendas) are numbered 1, 2, … in plan order.
 */
export function applyJudge(read, answer, events = [], options = {}) {
    const tally = { accept: 0, reshape: 0, refuse: 0 };
    if (!read || !answer) return { read, refused: [], tally };
    const refused = [];
    const infos = [];
    let n = 0;
    const kept = [];
    for (const item of read.items) {
        if (!JUDGED.has(item.kind)) { kept.push(item); continue; }
        n += 1;
        const row = answer.items[n];
        if (!row || row.verdict === 'accept') { tally.accept += 1; kept.push(item); continue; }
        if (row.verdict === 'reshape') {
            const fixed = reshaped(item, row.rest, events, options);
            const taken = fixed && read.items.some(each => each !== item && lineKey(each.key) === lineKey(fixed.key));
            if (fixed && !taken) {
                tally.reshape += 1;
                kept.push(fixed);
                infos.push({ severity: 'info', text: `Reshaped by the Director: this ${item.kind} ("${item.key}").` });
                continue;
            }
            tally.refuse += 1;
            refused.push(reasonNote(item.kind, 'the Director\'s corrected line could not be used'));
            continue;
        }
        tally.refuse += 1;
        refused.push(noteFor(item, row.rest, events));
    }
    if (!refused.length && !infos.length) return { read, refused, tally };
    const findings = [...read.findings, ...infos, ...refused.map(text => ({ severity: 'warn', text }))];
    if (!kept.length) findings.unshift({ severity: 'error', text: 'The plan has no beats, agendas, hooks, clocks or secrets.' });
    return { read: { ...read, items: kept, findings }, refused, tally };
}
