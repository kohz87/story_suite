// World events, the daily step: the display name of a region (`content.regions`, spec ruling 42), by its id, name or alias, and of any
// condition's ref; the text itself when none is given. Pure.

import { resolveRef } from './geo.js';

const low = text => String(text ?? '').trim().toLowerCase();

/** A stored condition ref as the reader sees it: the place's or realm's name on the map, a region's display name, else the text itself. */
export const refLabel = (geo, ref) => regionLabel(geo, resolveRef(geo, ref)?.name ?? ref);

/** `regionLabel(geo, ref)` → the region's name as `content.regions` gives it (geo.regionNames), else `ref`. */
export const regionLabel = (geo, ref) => geo.regionNames?.get(low(ref)) ?? ref;
