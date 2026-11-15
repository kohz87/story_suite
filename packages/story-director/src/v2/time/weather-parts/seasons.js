// Story Director v2, part time: the season of a story day, from the pack's seasons or the built-in year split, and the built-in table.

import { makeCalendar } from '../../../calendar.js';
import { fold } from './shared-text.js';

export const SEASONS = Object.freeze(['winter', 'spring', 'summer', 'autumn']);

/** The built-in table: a temperate land by season, and a mild one for a story without a clock. */
export const TEMPERATE = Object.freeze({
    winter: Object.freeze(['hard frost, clear and cold', 'grey skies, a raw wind', 'light snow falling', 'freezing fog at dawn',
        'sleet on a north wind', 'cold, still and overcast', 'thin sun, bitter cold', 'heavy snow, low cloud']),
    spring: Object.freeze(['soft rain, mild', 'showers and bright spells', 'cool and breezy, high cloud', 'warm sun, a light breeze',
        'morning mist, clearing later', 'grey drizzle', 'blustery, clouds racing', 'clear and fresh']),
    summer: Object.freeze(['hot and clear', 'warm, hazy sunshine', 'humid, thunder by evening', 'bright and breezy',
        'sultry and still', 'a summer storm rolling in', 'warm with high cloud', 'clear skies, a cool night']),
    autumn: Object.freeze(['cool and misty', 'steady rain, a cold wind', 'crisp and clear', 'low grey cloud, drizzle',
        'gusty, leaves on the wind', 'fog in the hollows', 'mild and overcast', 'first frost, bright sun']),
    any: Object.freeze(['mild and overcast', 'clear and fair', 'light rain', 'a fresh breeze, scattered cloud', 'grey and still', 'bright, high cloud']),
});

/** Where `minutes` falls in its year on `config` (normalizeCalendar's shape): `{ month, dayOfYear, yearDays }`. */
function placeInYear(config, minutes) {
    const calendar = makeCalendar(config);
    const date = calendar.fromAbs(minutes);
    const months = config.months;
    const before = months.slice(0, date.month).reduce((sum, month) => sum + month.days, 0);
    const yearDays = months.reduce((sum, month) => sum + month.days, 0) || 1;
    return { month: months[date.month]?.name ?? '', dayOfYear: before + date.day - 1, yearDays };
}

/** The built-in season of a day: the year split as on Earth's northern half (winter around the year's turn). */
export function seasonByYear(dayOfYear, yearDays) {
    const twelfth = ((dayOfYear + 0.5) / yearDays) * 12;
    return SEASONS[Math.floor(((Math.floor(twelfth) + 1) % 12) / 3)];
}

/**
 * The day's season: `{ name, builtIn }`. `name` the pack's season holding the month when its `seasons` name
 * one, else the built-in season; `builtIn` the built-in season (for the built-in table). Null without a clock.
 */
export function seasonOf(config, minutes, seasons = []) {
    if (!Number.isSafeInteger(minutes) || !config?.months?.length) return null;
    const at = placeInYear(config, minutes);
    const builtIn = seasonByYear(at.dayOfYear, at.yearDays);
    const own = (Array.isArray(seasons) ? seasons : []).find(season => (season?.months ?? []).some(month => fold(month) === fold(at.month)));
    return { name: own ? fold(own.name) : builtIn, builtIn };
}
