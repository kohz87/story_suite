// World events, the daily step: the stretch a "N% per season" chance is spread over (spec rulings 27, 50). An event that requires a season
// anchor ("winter") spreads it over that calendar season's days, so tempo never changes its yearly odds; any other per-season chance
// is spread over 90 × tempo days in blocks from the step's first day. A chance of 100% fires once per stretch, on a seeded day inside it
// (the first eligible day from there on). Pure (reads `ws`).

import { anchorString } from './grammar.js';
import { wholeChance } from './chance.js';
import { seasonDays } from './durations.js';

/** The stretch the event's per-season chance covers on `day`: `{ start, length }`. */
export function stretchOf(ws, def, day) {
    const season = (def.requires ?? []).map(text => anchorString(text)).find(anchor => anchor?.kind === 'season');
    if (season && ws.cal) return ws.cal.stretch(day);
    const length = seasonDays(ws.tempo);
    return { start: ws.startDay + Math.floor((day - ws.startDay) / length) * length, length };
}

/** Whether the event's chance is "100% per season": once per stretch, on a seeded day. */
export const oncePerStretch = def => def.chance?.per === 'season' && wholeChance(def) >= 1 && def.certainty !== 'set-in-motion';

/** The seeded day inside the stretch from which a 100%-per-season event may fire. */
export const seededDay = (ws, def, stretch) => stretch.start + Math.floor(ws.draw(stretch.start, `${def.id}#day`) * stretch.length);
