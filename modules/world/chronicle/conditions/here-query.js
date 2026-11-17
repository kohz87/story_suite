// `chronicle.conditionsHere`: the conditions in scope where the party is, for the World tab (switch story-director.world-events; null while it is off). Pure.

import { toolsQuery } from '../queries-parts/shared-ask.js';
import { calendarFrom, dateText } from '../queries-parts/clock.js';
import { scenePlaceOf } from '../pick-parts/nearness.js';
import { hereConditions } from '../world-note-parts/here.js';
import { effectsText } from '../world-note-parts/build.js';
import { isInt } from '../domain-parts/shared-basics.js';
import { WORLD_EVENTS_FEATURE } from './feature.js';

const clean = text => String(text ?? '').replace(/,? \d{1,2}:\d{2}.*$/, '');

/**
 * `{ place?: string }` (default: the scene's place) → `{ place, conditions: [{ key, name, ref, since, sinceText, why, means, told }] }`, narrowest first:
 * `since` is the story minute the condition began, `sinceText` its date, `why` the reason the story or an event gave, `means` what the pack says it is and
 * `told` the effects the narrator is told ("all goods ×1.3, grain ×2"). `[]` when there is no place.
 */
export const conditionsHereQuery = Object.assign((state, args, tools) => {
    const query = toolsQuery(tools);
    const place = typeof args?.place === 'string' && args.place.trim() ? args.place.trim() : scenePlaceOf(query, state);
    if (!place) return { place: '', conditions: [] };
    const calendar = calendarFrom(query);
    const conditions = hereConditions(query, place).map(entry => ({
        key: entry.key, name: entry.name, ref: entry.ref, since: isInt(entry.since) ? entry.since : null, sinceText: isInt(entry.since) ? clean(dateText(calendar, entry.since)) : '',
        why: typeof entry.why === 'string' ? entry.why : '', means: entry.declared.means ?? '', told: effectsText(entry.declared.effects),
    }));
    return { place, conditions };
}, { feature: WORLD_EVENTS_FEATURE });
