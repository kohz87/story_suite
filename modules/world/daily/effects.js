// World events, the daily step: applying an effects block on the tick (spec v0.10 §3 effects, §2 holders, §6 authored effects).
// Order inside a block: clears, then sets, then powers and scores (clamped to −100..100, outside the per-deed limits), facts,
// then cast moves and deaths (cast.js). A set with no duration: on an event it is held while the event is Active; on a template,
// an on_end block or a world line it lasts the condition's `fades`. "until cleared" overrides. Pure (on `ws`).

import { conditionString } from './grammar.js';
import { scaledDays } from './durations.js';
import { clearCondition, setCondition } from './holds.js';
import { boundRef } from './requires.js';
import { applyCast, evacuate } from './cast.js';
import { recordAnchor } from './anchors.js';

const DAY = 1440;
const clamp = value => Math.max(-100, Math.min(100, value));
const list = value => (Array.isArray(value) ? value : []);

function condition(ws, text, bind, label) {
    const parsed = conditionString(text);
    const ref = parsed && boundRef(parsed, bind);
    if (!parsed || !ref) { ws.warnings.push(`${label}: "${text}" could not be read or bound.`); return null; }
    const declared = ws.declared.get(parsed.name);
    if (!declared) { ws.warnings.push(`${label}: "${parsed.name}" is not one of this world's conditions.`); return null; }
    return { ...parsed, ref, declared };
}

/** The lifetime of a set: whole days, null (until cleared) or 'hold' (bound to the event while it is Active). */
function lifetime(ws, parsed, held) {
    if (parsed.duration) {
        const days = scaledDays(parsed.duration, ws.tempo, { open: true });
        return days === undefined ? 'bad' : days;
    }
    if (held) return 'hold';
    const fades = parsed.declared.fades;
    if (fades === null || fades === undefined) return null;
    const days = scaledDays(fades, ws.tempo, { open: true });
    return days === undefined ? 'bad' : days;
}

function standing(ws, kind, name, delta, label) {
    const key = `${kind}:${name}`;
    if (!(key in ws.standings)) { ws.warnings.push(`${label}: the ${kind} "${name}" is not in this world.`); return; }
    if (!Number.isFinite(delta)) return;
    ws.standings[key] = clamp(ws.standings[key] + delta);
}

/**
 * Apply `block` ({ set, clear, powers, scores, facts, cast }) for `source` = { kind: 'event' | 'template', id, title, held }
 * on `day` with the placeholder binding `bind`. `held`: sets with no duration are held by the event (its main effects).
 */
export function applyEffects(ws, block, source, day, bind = {}) {
    if (!block || typeof block !== 'object') return;
    const minute = day * DAY;
    const label = `${source.kind === 'template' ? 'The template' : 'The event'} "${source.id}"`;
    for (const text of list(block.clear)) {
        const parsed = condition(ws, text, bind, label);
        if (parsed) clearCondition(ws, parsed.name, parsed.ref, minute);
    }
    for (const text of list(block.set)) {
        const parsed = condition(ws, text, bind, label);
        if (!parsed) continue;
        const days = lifetime(ws, parsed, source.held === true);
        if (days === 'bad') { ws.warnings.push(`${label}: "${text}" has a duration that cannot be read.`); continue; }
        const set = setCondition(ws, { name: parsed.name, ref: parsed.ref, days, holder: source.id, by: source.kind === 'template' ? 'code' : `event:${source.id}`, why: source.title ?? source.id }, minute);
        if (set && parsed.declared.placeStatus === true) evacuate(ws, parsed.ref, parsed.name, source, day);
    }
    for (const [name, delta] of Object.entries(block.powers ?? {})) standing(ws, 'power', name, delta, label);
    for (const [name, delta] of Object.entries(block.scores ?? {})) standing(ws, 'score', name, delta, label);
    for (const fact of list(block.facts)) {
        if (!fact || typeof fact.id !== 'string') continue;
        ws.facts[fact.id] = { text: String(fact.text ?? '').slice(0, 200), day };
        recordAnchor(ws.anchors, `fact:${fact.id}`, day);
        ws.journal.push({ day, text: String(fact.text ?? fact.id).slice(0, 200), by: source.id });
    }
    if (list(block.cast).length) applyCast(ws, list(block.cast), source, day);
}
