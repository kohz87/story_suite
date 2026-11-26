// World events, the daily step: the ref inside a "<condition>@<ref>" string (a `set:` or `cleared:` anchor, a cast move's `until`),
// written as the map names it, so a file id or an alias meets the key the conditions are stored under. Pure.

import { resolveRef } from './geo.js';

/** "<condition>@<ref>" with the map's name for the ref; with no "@", or a ref the map does not know, as written. */
export function withMapName(geo, id) {
    const cut = id.indexOf('@');
    const found = cut < 0 ? null : resolveRef(geo, id.slice(cut + 1));
    return found ? `${id.slice(0, cut)}@${found.name}` : id;
}
