// World events, the daily step: one day of authored events (spec v0.10 §3 Lifecycle, Certainty, Caps). In the fixed same-day
// order (set-in-motion, chain stages, one-offs, recurring; by id within each) every event that is not finished is checked:
// Active → does it end; pre-empted → Replaced; the window (lapse at the first tick after its last
// day); requirements (Eligible ↔ Dormant); then today's chance, the seeded roll and the caps. Pure (on `ws`).

import { anchorHolds } from './anchors.js';
import { capBlock, eventRealms, takeSlots } from './caps.js';
import { dailyChance, rollChance } from './chance.js';
import { closeEvent, endEvent, fireEvent } from './fire.js';
import { scaleDays, seasonDays } from './durations.js';
import { bindOf, placesFor, weightedPick } from './placement.js';
import { modifierProduct, requiresHold } from './requires.js';
import { cascadeState, preEmpted, windowAnchor } from './cascade.js';

const FINISHED = new Set(['ended', 'lapsed', 'replaced']);

function endsToday(ws, def, row, day) {
    if (day <= row.fired) return false;
    if (Number.isFinite(def.ends.for) && day >= row.fired + scaleDays(def.ends.for, ws.tempo)) return true;
    return def.ends.anyOf.some(text => anchorHolds(ws, text, day));
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
            if (start === null) return { open: false };
            row.start = start;
        }
    } else if (row.start === undefined) {
        if (!requiresHold(ws, def, day)) return { open: false };
        row.start = day;
    }
    if (day < row.start) return { open: false };
    if (!def.window) return { open: true, end: null, length: null };
    const length = scaleDays(def.window.within, ws.tempo);
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
    const days = def.chance?.per === 'season' || !win.length ? seasonDays(ws.tempo) : win.length;
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
    const place = weightedPick(list, ws.draw(day, `${def.id}#place`));
    const bind = bindOf(place);
    attempt(ws, def, day, dailyChance(def, { days: seasonDays(ws.tempo), left: 1, m: modifierProduct(ws, def, day, bind) }), bind);
}

/** Every authored event, one day, in the fixed order; then the cascade (a dead chain path) until nothing more falls, the same day. */
export function eventsDay(ws, events, day) {
    for (const def of events) {
        ws.events[def.id] ??= { state: 'dormant' };
        if (FINISHED.has(ws.events[def.id].state)) continue;
        if (def.kind === 'recurring') recurring(ws, def, day);
        else oneEvent(ws, def, day);
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
