// World events, the daily step: minor templates, rolled and placed by code every day (spec v0.10 §5), after the authored events.
// A template with no eligible place does nothing (nothing recorded). Otherwise it rolls its daily chance (its own "N% per season",
// else 70% per season), picks a place size-weighted, and is blocked (the success discarded) when the place's region already had
// 2 minor happenings in the last 7 days. Per-place cooldowns hold. Templates set and clear conditions; they never touch named
// cast (they have no cast effects) and never land on a place under a placeStatus condition (unless they need it: a clearing path).
// One that sets a placeStatus condition at its place is never placed where a protected person lives (spec §2: refused). A major template (resettlement, reconstruction) is rolled too, under the major caps and the 45-day timer of its realm (spec rulings 47, E8); a major open template is still the Director's.

import { dailyChance, rollChance } from './chance.js';
import { applyEffects } from './effects.js';
import { scaleDays, seasonDays } from './durations.js';
import { bindOf, placesFor, weightedPick } from './placement.js';
import { modifierProduct, requiresHold } from './requires.js';
import { capBlock, takeSlots } from './caps.js';
import { protectedHere } from './protected-here.js';
import { perHolds, rollOpen, settleOpen } from './open-day.js';
import { textPlace } from './shown-place.js';

export const DENSITY = Object.freeze({ perRegion: 2, days: 7 });
const DEFAULT_CHANCE = Object.freeze({ percent: 70, per: 'season' });

function cooled(ws, def, place, day) {
    if (!def.cooldown) return true;
    const last = ws.cooldowns[def.cooldown.perPlace ? `${def.id}@${place.name}` : def.id];
    return !Number.isInteger(last) || day - last >= scaleDays(def.cooldown.days, ws.tempo);
}

/** The minor templates for one day. */
export function templatesDay(ws, templates, day) {
    ws.minors = ws.minors.filter(entry => day - entry.day < DENSITY.days);
    if (ws.pending.length) settleOpen(ws, day);
    for (const def of templates) {
        const major = def.severity === 'major';
        if (major && def.open) continue;
        // A template that needs a placeStatus condition at its place (reconstruction) is its clearing path, not an ordinary one.
        const clearing = def.needs.some(text => /@@?place$/.test(text) && ws.declared.get(text.split('@')[0])?.placeStatus === true);
        const status = def.sets.some(text => /@@?place(?::|$)/.test(text.replace(/\s+/g, '')) && ws.declared.get(text.split('@')[0].trim())?.placeStatus === true);
        const list = placesFor(ws, def.where, day, { template: !clearing }).filter(({ place }) => cooled(ws, def, place, day) && requiresHold(ws, def, day, bindOf(place)) && !(status && protectedHere(ws, place)));
        if (!list.length) continue;
        const key = `template:${def.id}`;
        // The place is picked first so likelier_if / less_if can read its @place / @region / @realm.
        const place = weightedPick(list, ws.draw(day, `${key}#place`));
        const chance = dailyChance({ certainty: 'possible', chance: def.chance ?? DEFAULT_CHANCE }, { days: seasonDays(ws.tempo), left: 1, m: modifierProduct(ws, def, day, bindOf(place)) });
        const roll = rollChance(ws.draw, day, key, chance);
        if (!roll.hit) continue;
        const region = place.region || place.name;
        if (major) {
            const block = capBlock(ws, [place.realm], day);
            if (block) { ws.log.push({ kind: 'cap', key: def.id, day, why: block }); continue; }
            takeSlots(ws, [place.realm], day);
        } else if (ws.minors.filter(entry => entry.region === region).length >= DENSITY.perRegion) {
            ws.log.push({ kind: 'density', key: def.id, day, why: `${region} already had ${DENSITY.perRegion} minor happenings this week` });
            continue;
        }
        if (def.open && !perHolds(ws, def, place, day)) {
            ws.log.push({ kind: 'budget', key: def.id, day, why: `${region} has had its open slot for this template` });
            continue;
        }
        const bind = bindOf(place);
        if (def.open) {
            ws.minors.push({ region, day });
            ws.cooldowns[def.cooldown?.perPlace ? `${def.id}@${place.name}` : def.id] = day;
            rollOpen(ws, def, place, day);
            ws.log.push({ kind: 'minor', key: def.id, day, place: place.name });
            continue;
        }
        applyEffects(ws, { clear: def.clears, set: def.sets }, { kind: 'template', id: def.id, title: def.id, held: false }, day, bind);
        if (!major) ws.minors.push({ region, day });
        ws.cooldowns[def.cooldown?.perPlace ? `${def.id}@${place.name}` : def.id] = day;
        const text = String(def.summary).replace(/\{place\}/g, textPlace(ws.geo, place.name, place.regionName || region)).replace(/\{region\}/g, place.regionName || region).replace(/\{realm\}/g, place.realm);
        ws.journal.push({ day, text, by: `template:${def.id}`, place: place.name, reach: def.reach });
        ws.log.push({ kind: 'minor', key: def.id, day, place: place.name });
    }
}
