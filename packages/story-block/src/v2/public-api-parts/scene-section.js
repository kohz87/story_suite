// Reads the scene section (place, time, weather, who is present) of the public paths.

import { isObject, text } from './shared-basics.js';
import { put } from './shared-put.js';

// "06:40 am" in a calendar's own text, else the minute of the day as 24-hour time.
const CLOCK = /\b\d{1,2}:\d{2}(?:\s*[ap]\.?m\.?)?/i;
function clockParts(time) {
    if (!isObject(time) || !Number.isInteger(time.minutes)) return { time: undefined, date: undefined };
    const said = typeof time.text === 'string' ? time.text.trim() : '';
    const found = said.match(CLOCK);
    const minute = isObject(time.parts) && Number.isInteger(time.parts.minutes) ? time.parts.minutes : ((time.minutes % 1440) + 1440) % 1440;
    const clock = found ? found[0].trim() : `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    const date = found ? said.replace(found[0], '').replace(/\s{2,}/g, ' ').replace(/^[\s,;·-]+|[\s,;·-]+$/g, '').replace(/,\s*,/g, ',') : said;
    return { time: clock, date: date || undefined };
}

export function sceneSection(ask) {
    const map = new Map();
    const place = ask('scene.place', {});
    put(map, 'scene.place', text(place?.name) || undefined);
    put(map, 'scene.place.kind', text(place?.kind) || undefined);
    put(map, 'scene.place.region', text(place?.region) || undefined);
    const clock = clockParts(ask('director.time', {}));
    put(map, 'scene.time', clock.time);
    put(map, 'scene.date', clock.date);
    put(map, 'scene.weather', text(ask('scene.weather', {})?.text) || undefined);
    const present = ask('scene.present', {});
    if (Array.isArray(present)) put(map, 'scene.present', present.map(person => text(isObject(person) ? person.name : person)).filter(Boolean));
    return map;
}
