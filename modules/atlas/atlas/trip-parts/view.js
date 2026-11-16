// Builds the reader-facing trip view and narrator status lines.

import { parseLocation } from '../../places.js';
import { keyOf } from '../domain.js';
import { DAY, daysWord, isInt, tidy } from './shared-constants.js';
import { positionOf, tripOf } from './state.js';
import { isOver } from './status.js';
import { dateText, legTime, paceText } from './format.js';

/**
 * The trip for readers, at story minute `now` (`here`: {{user}}'s place name; `calendar`): null when there is none or it is over;
 * else `{ to, phase: 'road' | 'arrived', by, pace, mount, short, unit, setOut, legs, leg, legCount, along, of, fraction, from, next,
 * arrive, route, row, tail, reached, delays }` where each of `legs` is `{ index, from, to, km, kind, days, time, arrive, state:
 * 'done' | 'now' | 'next', along?, fraction? }`.
 */
export function tripView(atlas, { now, here = '', calendar }) {
    const trip = isInt(now) ? tripOf(atlas) : null;
    if (!trip || isOver(trip, now, here)) return null;
    const pos = positionOf(trip, now);
    const when = minutes => dateText(calendar, minutes, now);
    const legs = trip.legs.map((leg, index) => ({
        index: index + 1, from: leg.from, to: leg.to, km: leg.km, kind: leg.kind, days: leg.days, time: legTime(leg, trip.unit), arrive: when(leg.arrive),
        state: leg.arrive <= now ? 'done' : index === pos.index ? 'now' : 'next',
        ...(index === pos.index && !pos.arrived ? { along: pos.along, fraction: Math.round(pos.fraction * 1000) / 1000 } : {}),
    }));
    const final = trip.legs.at(-1);
    const route = [trip.legs[0].from, ...trip.legs.map(leg => leg.to)];
    const arrived = pos.arrived;
    const arriveText = when(final.arrive);
    const pace = paceText(trip);
    // The place {{user}} is at by the story's own word, to tell what has not been written yet.
    const placeKey = keyOf(parseLocation(here).name);
    const passed = trip.legs.filter(leg => leg.arrive <= now).at(-1) ?? null;
    const reached = passed && placeKey !== keyOf(passed.to) ? { place: passed.to, date: when(passed.arrive) } : null;
    const view = {
        to: trip.to, phase: arrived ? 'arrived' : 'road', by: trip.by, pace, mount: trip.mount, short: trip.short, unit: trip.unit,
        setOut: when(trip.setOut), legs, leg: pos.index + 1, legCount: legs.length, along: pos.along, of: pos.of, fraction: Math.round(pos.fraction * 1000) / 1000,
        from: pos.leg.from, next: pos.leg.to, arrive: arriveText, route, reached, delays: trip.delays.map(delay => ({ text: `${daysWord(tidy(delay.minutes / DAY))}${delay.because ? `: ${delay.because}` : ''}` })),
    };
    view.row = arrived
        ? `Arrived at ${final.to}${arriveText ? `, ${arriveText}` : ''}`
        : [route.join(' → '), pace, `leg ${view.leg} of ${view.legCount}`, `arrive ${final.to}${arriveText ? ` ${arriveText}` : ''}`].join(' · ');
    return view;
}

/**
 * What the narrator is told while a trip is on (`view` from tripView), as lines: "On the road: …" and, when a leg's arrival has passed
 * and the story has not moved the place, "{{user}} has reached …: write ~ place …".
 */
export function tripLines(view) {
    if (!view) return [];
    const lines = [];
    if (view.reached) lines.push(`{{user}} has reached ${view.reached.place}${view.reached.date ? ` (${view.reached.date})` : ''}: write ~ place ${view.reached.place}.`);
    if (view.phase === 'road') {
        const now = view.legs[view.leg - 1];
        const then = view.legs.slice(view.leg).slice(0, 3).map(leg => `${leg.to}${leg.arrive ? `, ${leg.arrive}` : ''}`);
        const more = view.legs.length - view.leg - then.length;
        lines.push(`On the road: ${now.from} → ${now.to}, ${view.along} of ${view.of} km${now.arrive ? `, arrive ${now.arrive}` : ''}${then.length ? `; then ${then.join('; then ')}` : ''}${more > 0 ? `; and ${more} more` : ''}.`);
    }
    return lines;
}
