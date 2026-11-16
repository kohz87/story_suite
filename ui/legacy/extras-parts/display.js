// Choices and Inner chatter: one display line's verdict and what a reply's display lines show.

import { capsOf, extractBlock, lineBody, parseChanges } from '../../../core/capture.js';
import { flatten } from './text.js';
import { CHATTER_MAX } from './limits.js';

/**
 * One display line's verdict (turn.js at capture, displayLines when drawing: the same rule both
 * ways). `entry`: the registry's capture entry ({ kind, display: { perReply?, noun?, read? } });
 * `counts`: a Map kind → lines kept so far in this reply. → { ok: true, value } | { ok: false, code, message }.
 */
export function readDisplayLine(entry, line, counts, caps = null) {
    const display = entry?.display;
    let answer;
    try {
        answer = typeof display?.read === 'function' ? display.read(line) : { value: { text: flatten(lineBody(line?.raw ?? '')) } };
    } catch (error) {
        answer = { error: error?.message ?? String(error) };
    }
    if (!answer || typeof answer.error === 'string' || answer.value === undefined) {
        return { ok: false, code: 'INVALID', message: typeof answer?.error === 'string' ? answer.error : 'it could not be read' };
    }
    const seen = counts.get(entry.kind) ?? 0;
    // `caps` ({ [kind]: n }): the cap the reply was read with, kept in its hidden comment (capture.js markCaps).
    const kept = caps?.[entry.kind];
    const max = Number.isInteger(kept) && kept > 0 ? kept : Number.isInteger(display?.perReply) && display.perReply > 0 ? display.perReply : Infinity;
    if (seen >= max) {
        const noun = typeof display?.noun === 'string' && display.noun ? display.noun : `${entry.kind} lines`;
        return { ok: false, code: 'LIMITED', message: `a reply shows at most ${max} ${noun}, and this one had more` };
    }
    counts.set(entry.kind, seen + 1);
    return { ok: true, value: answer.value };
}

/**
 * What a reply's display lines show, read from its text as SillyTavern holds it (the hidden comment
 * the reply's block was kept in): { [kind]: value[] } in reply order, only for kinds that are display
 * kinds and on now. `entryOf(word)` → the registry's capture entry (registry.capture); `max`: the
 * host's maxChangeLines (the same lines the capture read); `caret`: the reply carries the caretWords mark (a preset's ^ before each word is dropped, as at capture).
 */
export function displayLines(mes, { entryOf, max = Infinity, caret = false } = {}) {
    const out = {};
    // (A line its hidden comment marks as read while its feature was off is left out, B-a1-5.)
    const block = extractBlock(String(mes ?? ''), 'Changes', null, { display: true });
    if (block === null || typeof entryOf !== 'function') return out;
    const lines = parseChanges(block, { max, caret }).lines.slice(0, Number.isFinite(max) ? max : undefined);
    const counts = new Map();
    // The cap the reply was read with: the mark in its comment, else what every reply had before the setting (3).
    const caps = { chatter: CHATTER_MAX, ...capsOf(mes) };
    for (const line of lines) {
        let entry = null;
        try { entry = entryOf(line.kind); } catch { entry = null; }
        if (!entry?.display || entry.off) continue;
        const read = readDisplayLine(entry, line, counts, caps);
        if (read.ok) (out[entry.kind] ??= []).push(read.value);
    }
    return out;
}
