// World events, the daily step: minor templates, rolled and placed by code every day (spec v0.10 §5), after the authored events.
// A template with no eligible place does nothing (nothing recorded). Otherwise it rolls its daily chance (its own "N% per season",
// else 70% per season), picks a place size-weighted, and is blocked (the success discarded) when the place's region already had
// 2 minor happenings in the last 7 days. Per-place cooldowns hold. Templates set and clear conditions; they never touch named
// cast (they have no cast effects) and never land on a place under a placeStatus condition (unless they need it: a clearing path).
// One that sets a placeStatus condition at its place is never placed where a protected person lives (spec §2: refused). Major templates are the Director's.

import { dailyChance, rollChance } from './chance.js';
import { applyEffects } from './effects.js';
import { scaleDays, seasonDays } from './durations.js';
import { bindOf, placesFor, weightedPick } from './placement.js';
import { requiresHold } from './requires.js';
import { placeOf } from './cast-where.js';
import { groupOf } from './geo-scope.js';

export const DENSITY = Object.freeze({ perRegion: 2, days: 7 });
const DEFAULT_CHANCE = Object.freeze({ percent: 70, per: 'season' });

function cooled(ws, def, place, day) {
    if (!def.cooldown) return true;
    const last = ws.cooldowns[def.cooldown.perPlace ? `${def.id}@${place.name}` : def.id];
    return !Number.isInteger(last) || day - last >= scaleDays(def.cooldown.days, ws.tempo);
}

// Whether a protected, living person lives at the place or a district under it.
function protectedHere(ws, place) {
    const group = new Set(groupOf(ws.geo, place.name));
    return [...ws.people.values()].some(person => person.protected && ws.cast[person.id]?.died === undefined && group.has(placeOf(ws, person.id)));
}

/** The minor templates for one day. */
export function templatesDay(ws, templates, day) {
    ws.minors = ws.minors.filter(entry => day - entry.day < DENSITY.days);
    for (const def of templates) {
        if (def.severity !== 'minor') continue;
        // A template that needs a placeStatus condition at its place (reconstruction) is its clearing path, not an ordinary one.
        const clearing = def.needs.some(text => /@@?place$/.test(text) && ws.declared.get(text.split('@')[0])?.placeStatus === true);
        const status = def.sets.some(text => /@@?place(?::|$)/.test(text.replace(/\s+/g, '')) && ws.declared.get(text.split('@')[0].trim())?.placeStatus === true);
        const list = placesFor(ws, def.where, day, { template: !clearing }).filter(({ place }) => cooled(ws, def, place, day) && requiresHold(ws, def, day, bindOf(place)) && !(status && protectedHere(ws, place)));
        if (!list.length) continue;
        const chance = dailyChance({ certainty: 'possible', chance: def.chance ?? DEFAULT_CHANCE }, { days: seasonDays(ws.tempo), left: 1, m: 1 });
        const key = `template:${def.id}`;
        const roll = rollChance(ws.draw, day, key, chance);
        if (!roll.hit) continue;
        const place = weightedPick(list, ws.draw(day, `${key}#place`));
        const region = place.region || place.name;
        if (ws.minors.filter(entry => entry.region === region).length >= DENSITY.perRegion) {
            ws.log.push({ kind: 'density', key: def.id, day, why: `${region} already had ${DENSITY.perRegion} minor happenings this week` });
            continue;
        }
        const bind = bindOf(place);
        applyEffects(ws, { clear: def.clears, set: def.sets }, { kind: 'template', id: def.id, title: def.id, held: false }, day, bind);
        ws.minors.push({ region, day });
        ws.cooldowns[def.cooldown?.perPlace ? `${def.id}@${place.name}` : def.id] = day;
        const text = String(def.summary).replace(/\{place\}/g, place.name).replace(/\{region\}/g, region).replace(/\{realm\}/g, place.realm);
        ws.journal.push({ day, text, by: `template:${def.id}`, place: place.name, reach: def.reach });
        ws.log.push({ kind: 'minor', key: def.id, day, place: place.name });
    }
}
