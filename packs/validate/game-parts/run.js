// The job: running the game pack's own section checks in order and collecting what they keep.

import { isObject } from '../core.js';
import { checkGameCalendar } from './calendar.js';
import { checkGameWeather } from './weather.js';
import { checkGameStart, checkPacing } from './start.js';
import { checkGameRpg } from './rpg.js';

/**
 * The sections only a game pack has: `calendar`, `weather` (which reads the calendar's seasons), `start`, `pacing` and `rpg`. `given` is the pack's content cut
 * down to its kind's keys. A section that does not check is left out and said once. → `{ calendar, weather, start, pacing, rpg }` (each null or absent when not given or refused).
 */
export function checkGameSections({ given, packId, add, warn }) {
    const calendar = given.calendar === undefined ? null : checkGameCalendar(given.calendar, add);
    const weather = given.weather === undefined ? null : checkGameWeather(given.weather, { add, warn, seasons: calendar?.seasons });
    const start = given.start === undefined ? null : checkGameStart(given.start, add);
    const pacing = given.pacing === undefined ? null : checkPacing(given.pacing, add);
    const moduleSlugs = Array.isArray(given.dataModules) ? given.dataModules.filter(isObject).map(module => module.slug) : [];
    const rpg = given.rpg === undefined ? undefined : checkGameRpg(given.rpg, { packId, moduleSlugs, add, warn });
    return { calendar, weather, start, pacing, rpg };
}
