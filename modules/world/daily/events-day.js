// World events, the daily step: one day of authored events (spec v0.10 §3 Lifecycle, Certainty, Caps). In the fixed same-day
// order (set-in-motion, chain stages, one-offs, recurring; by id within each) every event that is not finished is checked:
// Active → does it end; pre-empted → Replaced; the window (lapse at the first tick after its last
// day); requirements (Eligible ↔ Dormant); then today's chance, the seeded roll and the caps. Pure (on `ws`).

import { anchorHolds } from './anchors.js';
import { capBlock, eventRealms, takeSlots } from './caps.js';
import { dailyChance, rollChance } from './chance.js';
import { closeEvent, endEvent, fireEvent } from './fire.js';
import { scaleDays } from './durations.js';
import { oncePerStretch, seededDay, stretchOf } from './season-chance.js';
import { bindOf, placesFor, weightedPick } from './placement.js';
import { modifierProduct, requiresHold } from './requires.js';
import { cascadeState, preEmpted, windowAnchor } from './cascade.js';
import { isThreshold, thresholdHolds } from './threshold.js';

const FINISHED = new Set(['ended', 'lapsed', 'replaced']);

function endsToday(ws, def, row, day) {
    if (day <= row.fired) return false;
    if (Number.isFinite(def.ends.for) && day >= row.fired + scaleDays(def.ends.for, ws.tempo)) return true;
    // A threshold in any_of ends the event on the first day it holds (a later fall-back does not un-end it: the event is over). An anchor
    // ends it when it BECOMES true after the event fired (spec §3): one already true on the firing day does not end it the next day.
    return def.ends.anyOf.some(text => (isThreshold(text) ? thresholdHolds(ws, text) : anchorHolds(ws, text, day) && !anchorHolds(ws, text, row.fired)));
}

/** Roll and, on a hit, fire when the caps allow (set-in-motion fires over them). */
function attempt(ws, def, day, chance, bind) {
    const row = ws.events[def.id];
    row.state = 'eligible';
    if (chance.blocked) { ws.log.push({ kind: 'roll', key: def.id, day, result: 'blocked (×0)' }); return; }
    const roll = rollChance(ws.draw, day, def.id, chance);
    ws.log.push({ kind: 'roll', key: def.id, day, p: Number(chance.p.toFixed(6)), result: roll.hit ? 'hit' : 'miss' });
    if (!roll.hit) return;
    const realms = eventRealms(ws, def, bind);
    const major = def.severity === 'major';
    const block = major && def.certainty !== 'set-in-motion' ? capBlock(ws, realms, day) : '';
    if (block) { ws.log.push({ kind: 'cap', key: def.id, day, why: block }); return; }
    if (major) takeSlots(ws, realms, day);
    fireEvent(ws, def, day, bind, realms);
}

function windowed(ws, def, row, day) {
    if (def.window?.after) {
        if (row.start === undefined || row.start > day) {
            const start = windowAnchor(ws, def);
            if (start === null) { ws.waiting?.add(def.id); return { open: false }; }
            row.start = start;
        }
    } else if (row.start === undefined) {
        if (!requiresHold(ws, def, day)) return { open: false };
        row.start = day;
    }
    if (day < row.start) return { open: false };
    if (!def.window) return { open: true, end: null, length: null };
    const length = def.window.fixed ? def.window.within : scaleDays(def.window.within, ws.tempo);
    const end = row.start + length - 1;
    return day > end ? { lapse: true } : { open: true, end, length };
}

function oneEvent(ws, def, day) {
    const row = ws.events[def.id];
    if (row.state === 'active') {
        if (endsToday(ws, def, row, day)) endEvent(ws, def, day);
        return;
    }
    if (preEmpted(ws, def, day)) return closeEvent(ws, def, day, 'replaced', 'pre-empted');
    const win = windowed(ws, def, row, day);
    if (win.lapse) {
        if (def.certainty === 'set-in-motion') ws.warnings.push(`The set-in-motion event "${def.id}" lapsed: its requirements did not hold on its last day.`);
        return closeEvent(ws, def, day, 'lapsed', 'its window closed');
    }
    if (!win.open || !requiresHold(ws, def, day)) { row.state = 'dormant'; return; }
    const m = modifierProduct(ws, def, day);
    const span = stretchOf(ws, def, day);
    if (oncePerStretch(def) && day < seededDay(ws, def, span)) { row.state = 'eligible'; return; }
    const days = def.chance?.per === 'season' || !win.length ? span.length : win.length;
    const left = win.end === null ? 1 : win.end - day + 1;
    attempt(ws, def, day, dailyChance(def, { days, left, m }), null);
}

function recurring(ws, def, day) {
    const row = ws.events[def.id];
    if (row.state === 'active') {
        if (endsToday(ws, def, row, day)) endEvent(ws, def, day);
        return;
    }
    if (preEmpted(ws, def, day)) return closeEvent(ws, def, day, 'replaced', 'pre-empted');
    const cooldown = def.cooldown ? scaleDays(def.cooldown.days, ws.tempo) : 0;
    const cooled = place => {
        const last = def.cooldown?.perPlace ? row.places?.[place.name] : row.fired;
        return !Number.isInteger(last) || day - last >= cooldown;
    };
    const where = def.where?.fit ? null : def.where;
    const list = placesFor(ws, where, day).filter(({ place }) => cooled(place) && requiresHold(ws, def, day, bindOf(place)));
    if (!list.length) { row.state = 'dormant'; return; }
    const span = stretchOf(ws, def, day);
    const once = oncePerStretch(def);
    if (once && row.stretch === span.start) { row.state = 'dormant'; return; }
    if (once && day < seededDay(ws, def, span)) { row.state = 'eligible'; return; }
    const place = weightedPick(list, ws.draw(day, `${def.id}#place`));
    const bind = bindOf(place);
    attempt(ws, def, day, dailyChance(def, { days: span.length, left: 1, m: modifierProduct(ws, def, day, bind) }), bind);
    if (once && row.fired === day) row.stretch = span.start;
}

/** Every authored event, one day, in the fixed order; then the cascade (a dead chain path) until nothing more falls, the same day. */
export function eventsDay(ws, events, day) {
    ws.waiting = new Set();
    for (const def of events) {
        ws.events[def.id] ??= { state: 'dormant' };
        if (FINISHED.has(ws.events[def.id].state)) continue;
        if (def.kind === 'recurring') recurring(ws, def, day);
        else oneEvent(ws, def, day);
    }
    // Ruling 51: a window event whose anchor happened later today (an event processed after it) opens today.
    for (let again = true; again;) {
        again = false;
        for (const def of events) {
            const row = ws.events[def.id];
            if (!ws.waiting.has(def.id) || FINISHED.has(row.state) || row.state === 'active' || windowAnchor(ws, def) === null) continue;
            ws.waiting.delete(def.id);
            oneEvent(ws, def, day);
            again = true;
        }
    }
    for (let changed = true; changed;) {
        changed = false;
        for (const def of events) {
            const row = ws.events[def.id];
            if (FINISHED.has(row.state) || row.state === 'active' || def.kind === 'recurring') continue;
            const dead = cascadeState(ws, def);
            if (dead) { closeEvent(ws, def, day, dead, 'its only path is gone'); changed = true; }
        }
    }
}
