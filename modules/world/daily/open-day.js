// World events, open templates (spec §5, §9): what the daily step does with an open template's slot. Cooldown, density and the `per`
// budget are recorded when the slot rolls. The slot's key is campaign seed + day + template id + place id. A slot with a stored result
// (the chat's ledger) is applied at once; one without waits in `pending` (answered on a later reply, or its fallback after 3 days); the
// 5th and later slots of one step use their `fallback` (one batched call, at most 4 slots). The step reads only state: stored
// results, never a call. A stored answer is checked again when applied; an invalid one applies the fallback. Pure on `ws`.

import { applyEffects } from './effects.js';
import { scaleDays } from './durations.js';
import { bindOf } from './placement.js';
import { checkOpen } from './open-check.js';
import { BATCH, PENDING_DAYS, slotKey } from './open-slot.js';

const KEEP = 48;

/** Whether the template's `per` budget leaves room for another slot at this place (default one per region per season). */
export function perHolds(ws, def, place, day) {
    const by = def.per.by;
    const same = row => row.template === def.id && (by === 'place' ? row.place === place.name : by === 'realm' ? row.realm === place.realm : row.region === (place.region || place.name));
    return !Object.values(ws.slots).some(row => same(row) && day - row.day < scaleDays(def.per.days, ws.tempo));
}

function record(ws, slot, fields) {
    ws.slots[slot.key] = { ...ws.slots[slot.key], day: slot.day, template: slot.template, region: slot.region, realm: slot.realm, place: slot.place, ...fields };
    const keys = Object.keys(ws.slots);
    for (const key of keys.slice(0, Math.max(0, keys.length - KEEP))) delete ws.slots[key];
}

function fixed(ws, def, slot, day, outcome, why) {
    const bind = { place: slot.place, region: slot.region || null, realm: slot.realm };
    const source = { kind: 'template', id: def.id, title: def.id, held: false };
    if (def.fallback && (def.fallback.sets.length || def.fallback.clears.length)) {
        applyEffects(ws, { clear: def.fallback.clears, set: def.fallback.sets }, source, day, bind);
        const text = String(def.summary).replace(/\{place\}/g, slot.place).replace(/\{region\}/g, slot.region).replace(/\{realm\}/g, slot.realm);
        ws.journal.push({ day, text, by: `template:${def.id}`, place: slot.place, reach: def.reach });
        record(ws, slot, { resolved: day, outcome });
    } else record(ws, slot, { resolved: day, outcome: 'nothing' });
    ws.warnings.push(`The open template "${def.id}" at ${slot.place}: ${why}; ${def.fallback ? 'its fallback was applied' : 'it did nothing'}.`);
}

/** Resolve a slot with its stored `result` ({ outcome, answer? }) or none (the fallback), on `day`. */
function resolveSlot(ws, def, slot, result, day, why = 'the Director did not answer') {
    let answer = null;
    try { answer = typeof result?.answer === 'string' ? JSON.parse(result.answer) : null; } catch { answer = null; }
    if (!result || result.outcome === 'fallback' || !answer) return fixed(ws, def, slot, day, 'fallback', result?.why ?? why);
    const bind = { place: slot.place, region: slot.region || null, realm: slot.realm };
    const checked = checkOpen(ws, def, bind, answer, day);
    if (checked.errors.length) return fixed(ws, def, slot, day, 'fallback', `its answer no longer holds (${checked.errors[0]})`);
    applyEffects(ws, checked.block, { kind: 'template', id: def.id, title: checked.name, held: false, open: true }, day, bind);
    ws.journal.push({ day, text: checked.summary, title: checked.name, by: `template:${def.id}`, place: slot.place, reach: def.reach });
    record(ws, slot, { resolved: day, outcome: result.outcome === 'retry' ? 'retry' : 'ok', name: checked.name, summary: checked.summary, people: checked.people });
    if (result.outcome === 'retry') ws.warnings.push(`The open template "${def.id}" at ${slot.place}: the first answer was refused; the retry was used.`);
}

/** A slot rolled on `day` at `place`: applied from its stored result, to its fallback (beyond the batch), or left waiting. */
export function rollOpen(ws, def, place, day) {
    const bind = bindOf(place);
    const slot = { key: slotKey(ws.campaign, day, def.id, place.id), day, template: def.id, place: place.name, region: bind.region ?? '', realm: place.realm };
    ws.rolled += 1;
    if (ws.rolled > BATCH) return fixed(ws, def, slot, day, 'fallback', 'more than 4 open slots in one step');
    const result = ws.opens.results[slot.key];
    if (result) return resolveSlot(ws, def, slot, result, day);
    ws.pending.push(slot);
    record(ws, slot, { outcome: 'waiting' });
}

/** Waiting slots whose result is now stored are applied; one older than 3 days uses its fallback. */
export function settleOpen(ws, day) {
    const waiting = ws.pending;
    ws.pending = [];
    for (const slot of waiting) {
        const def = ws.templates.get(slot.template);
        const result = ws.opens.results[slot.key];
        if (!def) continue;
        if (result) resolveSlot(ws, def, slot, result, day);
        else if (day - slot.day >= PENDING_DAYS) fixed(ws, def, slot, day, 'fallback', 'no answer came in time');
        else ws.pending.push(slot);
    }
}
