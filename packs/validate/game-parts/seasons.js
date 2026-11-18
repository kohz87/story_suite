// The job: checking a game pack's `calendar.seasons` against the calendar's own months.

import { GAME_CALENDAR_LIMITS } from '../../limits.js';
import { oneLine, foldKey } from '../../../core/text.js';
import { isObject } from '../core.js';

/**
 * `seasons: [{ name, months: [month name] }]`, at most 12. A month is named by the calendar's own name (any case, or its number) and sits in one
 * season only; a season name is used once. → the normalized list (month names as the calendar spells them), or null when anything is wrong (said).
 */
export function checkSeasons(seasons, months, add) {
    const L = GAME_CALENDAR_LIMITS;
    const at = 'content.calendar.seasons';
    if (!Array.isArray(seasons) || !seasons.length || seasons.length > L.seasons) { add('BAD_CALENDAR', at, `seasons must be a list of 1 to ${L.seasons} { "name", "months" }.`); return null; }
    let ok = true;
    const bad = (path, message) => { ok = false; add('BAD_CALENDAR', path, message); };
    const used = new Set();
    const names = new Set();
    const out = [];
    seasons.forEach((season, index) => {
        const here = `${at}[${index}]`;
        if (!isObject(season) || Object.keys(season).some(key => key !== 'name' && key !== 'months')) return bad(here, `${here} must be { "name", "months" }.`);
        const name = typeof season.name === 'string' ? oneLine(season.name, L.seasonName) : '';
        if (!name || season.name.length > L.seasonName) bad(`${here}.name`, `name must be text of 1 to ${L.seasonName} characters (a season, like "winter").`);
        else if (names.has(foldKey(name))) bad(`${here}.name`, `the season "${name}" is listed twice.`);
        else names.add(foldKey(name));
        if (!Array.isArray(season.months) || !season.months.length || season.months.length > L.seasonMonths) return bad(`${here}.months`, `months must be a list of 1 to ${L.seasonMonths} of the calendar's months.`);
        const list = [];
        for (const given of season.months) {
            const month = typeof given === 'string' ? months.find(entry => foldKey(entry.name) === foldKey(given)) : Number.isInteger(given) ? months[given - 1] : undefined;
            if (!month) { bad(`${here}.months`, `${JSON.stringify(given)} is not one of the calendar's months.`); continue; }
            if (used.has(foldKey(month.name))) { bad(`${here}.months`, `"${month.name}" is in two seasons.`); continue; }
            used.add(foldKey(month.name));
            list.push(month.name);
        }
        out.push({ name, months: list });
    });
    return ok ? out : null;
}
