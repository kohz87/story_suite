// World events, the daily step: an authored event's summary and name in words. An event with no bound place (a one-off or a chain stage)
// has its placeholders cut (event-title.js); a summary that cannot stand without them takes them from the event's own `where`. Pure.

import { fillSummary, labelOf, titleOf } from './event-title.js';
import { resolveRef } from './geo.js';
import { regionLabel } from './region-label.js';
import { textPlace } from './shown-place.js';

/** The binding the event's `where` names: its first place, else its first region or realm; null for none. */
function whereBind(geo, def) {
    const found = (def.where?.refs ?? []).map(ref => resolveRef(geo, ref)).filter(Boolean);
    const first = found.find(each => each.kind === 'place') ?? found[0];
    if (!first) return null;
    if (first.kind === 'place') return { place: first.name, regionName: first.place.regionName || first.place.region, realm: first.place.realm };
    const name = regionLabel(geo, first.name);
    return { place: name, regionName: name, realm: first.kind === 'realm' ? first.name : geo.regionRealm.get(first.name.toLowerCase()) ?? '' };
}

/** `bind` as text names it: a part of a town by its town (shown-place.js). The stored bind is not changed. */
export const townBind = (geo, bind) => (bind?.place ? { ...bind, place: textPlace(geo, bind.place, bind.regionName || bind.region) } : bind);

/**
 * `{ text, label }` for `def` bound to `bind` (or not) with the outcome's name: `text` is the summary filled ('' with no authored summary),
 * `label` the name a reader or a prompt may be given (the title, else the summary without its outcome and closing mark; '' for none).
 */
export function eventWords(geo, def, bind = null, outcome = '') {
    if (def.summary === def.id) return { text: '', label: titleOf(def.title, def.id) };
    // A recurring event's `where` is the pool it may be placed in, not where it happened.
    const fallback = bind || def.template || def.kind === 'recurring' ? null : whereBind(geo, def);
    const shown = townBind(geo, bind);
    return {
        text: fillSummary(def.summary, shown, outcome) || (fallback ? fillSummary(def.summary, fallback, outcome) : ''),
        label: labelOf(def, shown) || (fallback ? labelOf(def, fallback) : ''),
    };
}
