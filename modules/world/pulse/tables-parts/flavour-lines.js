// Finds the flavour lines for a kind, place group and weather and picks one.

import { FLAVOUR_MORE } from '../flavour-more.js';
import { pickIndex } from './draws.js';
import { DEFAULT_GROUP } from './place-groups.js';
import { FLAVOUR } from './flavour-data.js';

const WEATHERS = Object.freeze(['rain', 'wind', 'fog', 'snow', 'heat']);

/** The weather words the ENV_SHIFT lines know: a line with another weather never shows. */
export const weatherOf = weather => (WEATHERS.includes(weather) ? weather : null);

/** The flavour lines of `kind` at this place group and weather (templates, unfilled); [] for none. */
export function flavourLines(kind, group = DEFAULT_GROUP, weather = null, wide = false) {
    // `wide` (pulse step version 2+): the extra fallback lines join the list; an older step keeps the short list so its pick replays.
    const lines = wide ? [...(FLAVOUR[kind] ?? []), ...(FLAVOUR_MORE[kind] ?? [])] : (FLAVOUR[kind] ?? []);
    const now = weatherOf(weather);
    return lines.filter(line => line.group === group && (line.weather === undefined || line.weather === now)).map(line => line.text);
}

/** The flavour template of `kind` picked with one `line` draw; '' when the kind has no line here. */
export function flavourFor(kind, unit, { group = DEFAULT_GROUP, weather = null, wide = false } = {}) {
    const lines = flavourLines(kind, group, weather, wide);
    const at = pickIndex(lines.length, unit);
    return at < 0 ? '' : lines[at];
}
