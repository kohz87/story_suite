// World events, the daily step: the display name of a region (`content.regions`, spec ruling 42), by its id, name or alias; the text itself when none is given. Pure.

const low = text => String(text ?? '').trim().toLowerCase();

/** `regionLabel(geo, ref)` → the region's name as `content.regions` gives it (geo.regionNames), else `ref`. */
export const regionLabel = (geo, ref) => geo.regionNames?.get(low(ref)) ?? ref;
