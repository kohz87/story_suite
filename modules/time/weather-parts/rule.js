// Story Director v2, part time: the weather by rule for where the story stands, and the afterCapture hook that asks for it.

import { HOST_WEATHER_FEATURE, WEATHER_COMMAND, WEATHER_FEATURE } from './names.js';
import { hashOf, regionOf, tableFor, weatherKey } from './pick.js';
import { seasonOf } from './seasons.js';
import { text, tryQuery } from './shared-text.js';

// The chat's calendar config (the tracker's `director.calendar`: the reader's, else the pack's, else Gregorian).
function calendarConfigOf(query) {
    const config = tryQuery(query, 'director.calendar', {});
    return config && typeof config === 'object' && Array.isArray(config.months) && config.months.length ? config : null;
}

/** The weather by rule for where the story stands: `{ key, text, season, region }`. */
export function weatherFor(state, query) {
    const minutes = state?.domains?.director?.time?.minutes;
    const region = regionOf(state, query);
    const key = weatherKey(minutes, region);
    const packWeather = tryQuery(query, 'packs.weather', {});
    let season = null;
    try { season = seasonOf(calendarConfigOf(query), minutes, packWeather?.seasons); } catch { season = null; }
    const list = tableFor(packWeather, season, region);
    return { key, text: list[hashOf(key) % list.length], season: season?.name ?? '', region };
}

const featureOn = (view, id) => (typeof view?.feature === 'function' ? view.feature(id) !== false : true);

// Whether Story Block has the `scene.weather` command (its live module list); true when it cannot be asked.
function hostHasCommand() {
    try {
        const modules = globalThis.StoryBlock?.sdk?.modules?.();
        if (!Array.isArray(modules)) return true;
        const core = modules.find(entry => entry?.id === 'story-block');
        return !core || !Array.isArray(core.commands) || core.commands.includes(WEATHER_COMMAND);
    } catch {
        return true;
    }
}

/**
 * `afterCapture(view)`: `{ commands: [scene.weather] }` when the day's weather is not set for where the story
 * stands: the rule's weather for a new day or region, or a mark on the story's own `~ weather` (kept for the
 * rest of that day and place). Nothing while the weather or this feature is off, or Story Block has no
 * `scene.weather`.
 */
export function weatherHook(view) {
    const state = view?.state;
    if (!state?.domains?.scene || !featureOn(view, WEATHER_FEATURE) || !featureOn(view, HOST_WEATHER_FEATURE) || !hostHasCommand()) return undefined;
    const now = weatherFor(state, view.query);
    const current = state.domains.scene.weather;
    if (current?.key === now.key) return undefined;
    // The story wrote the weather (no key): its word stands for this day and place.
    const payload = text(current?.text) && !current.key ? { key: now.key } : { text: now.text, key: now.key };
    return { lines: [], commands: [{ type: WEATHER_COMMAND, payload }] };
}
