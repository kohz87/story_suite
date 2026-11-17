// The world note's lines (pure): conditions here, news that has reached here, today's authored cue.

import { keyOf } from '../domain.js';
import { agoText, nowFrom } from '../queries.js';
import { scenePlaceOf } from '../pick.js';
import { WORLD_NOTE_BUDGET, worldEventsOn } from './feature.js';

export const WORLD_NOTE_HEADER = '[World now]';
const MAX_CHARS = WORLD_NOTE_BUDGET * 4;
const MAX_CONDITIONS = 3;
const MAX_NEWS = 2;
const MAX_PART = 110;

function ask(view, name, args) {
    if (typeof view?.query !== 'function') return null;
    try {
        return view.query(name, args) ?? null;
    } catch {
        return null;
    }
}

const clip = (text, room) => {
    const flat = String(text ?? '').replace(/\s+/g, ' ').trim().replace(/[.!?…]+$/, '');
    return flat.length <= room ? flat : `${flat.slice(0, Math.max(0, room - 1)).replace(/\s+\S*$/, '')}…`;
};
const key = name => keyOf(String(name ?? '')).replace(/^the\s+/, '');
const isInt = value => Number.isSafeInteger(value);

// Conditions that hold at the scene: its own place first, then its route, region and realm.
function nearConditions(view, place, now) {
    const list = ask(view, 'chronicle.conditions', {});
    if (!Array.isArray(list) || !place) return [];
    const here = ask(view, 'atlas.place', { name: place });
    const routes = ask(view, 'atlas.routes', { place });
    const names = new Map([[key(place), 0], [key(here?.region), 1], [key(here?.realm), 1]]);
    for (const route of Array.isArray(routes) ? routes : []) if (route?.name) names.set(key(route.name), 1);
    names.delete('');
    return list
        .filter(condition => condition && typeof condition.name === 'string' && names.has(key(condition.ref)))
        .sort((a, b) => names.get(key(a.ref)) - names.get(key(b.ref)) || (b.since ?? 0) - (a.since ?? 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .slice(0, MAX_CONDITIONS)
        .map(condition => {
            const since = isInt(now) && isInt(condition.since) ? agoText(now - condition.since) : '';
            const why = condition.why ? `: ${clip(condition.why, 50)}` : '';
            return `${condition.name} at ${condition.ref}${since ? ` (since ${since})` : ''}${why}`;
        });
}

// A news item still rumour at this place carries the tag `rumour` (the pulse's own rumour events carry a `rumour` text); a fact has none.
const isRumour = entry => entry.tag === 'rumour' || (entry.tag === undefined && typeof entry.rumour === 'string');

function heardLines(view, place, now) {
    const heard = ask(view, 'world.heardHere', { place, now });
    return (Array.isArray(heard) ? heard : [])
        .filter(entry => entry && typeof entry.name === 'string')
        .sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .slice(0, MAX_NEWS)
        .map(entry => `${entry.name}${isRumour(entry) ? ' (rumour)' : ''}${entry.summary ? ` — ${clip(entry.summary, MAX_PART - entry.name.length - (isRumour(entry) ? 9 : 0))}` : ''}`);
}

/** `worldNote(view)` → the note's lines (`[]` while the feature is off or there is nothing to say), within about 160 tokens. */
export function worldNote(view) {
    if (!worldEventsOn(view) || !view?.state?.domains?.chronicle) return [];
    const place = scenePlaceOf(typeof view.query === 'function' ? (name, args) => view.query(name, args) : null, view.state);
    const now = nowFrom(typeof view.query === 'function' ? (name, args) => view.query(name, args) : null, view.state);
    const conditions = nearConditions(view, place, now);
    const heard = place ? heardLines(view, place, now) : [];
    const cue = ask(view, 'world.cueToday', { now });
    const cueText = clip(typeof cue === 'string' ? cue : cue?.text, 140);
    const body = [
        conditions.length ? `Conditions here: ${conditions.join('; ')}.` : '',
        heard.length ? `News that has reached here: ${heard.join('; ')}.` : '',
        cueText ? `Today: ${cueText}.` : '',
    ].filter(Boolean);
    if (!body.length) return [];
    const out = [WORLD_NOTE_HEADER];
    let used = WORLD_NOTE_HEADER.length;
    for (const line of body) {
        const room = MAX_CHARS - used - 1;
        const cut = line.length <= room ? line : room > 24 ? `${clip(line, room - 2)}.` : '';
        if (!cut) continue;
        out.push(cut);
        used += 1 + cut.length;
    }
    return out.length > 1 ? out : [];
}
