// World events, the daily step: the ref inside a "<condition>@<ref>" string (a `set:` or `cleared:` anchor, a cast move's `until`).
// The conditions are stored under the map's name for the ref: the daily step reads a ref place first, the narrator's set and clear
// read it as the condition's scope, so one text may name two stored keys. A read takes them all. The map's names are read only where
// a pack opted into file ids (geo.js): with none, and for any other pack's place, the text counts as written. Pure.

import { resolveRef } from './geo.js';
import { resolveAs } from './geo-scope.js';
import { entryActive } from './holds-read.js';

// `[place-first name, scope name]` of "<condition>@<ref>" as keys (those the map knows); `[]` with no "@" or no opted-in pack.
function mapKeys(ws, id) {
    const cut = id.indexOf('@');
    if (cut < 0 || !ws.geo.slugs) return [];
    const name = id.slice(0, cut);
    const ref = id.slice(cut + 1);
    const found = [resolveRef(ws.geo, ref), resolveAs(ws.geo, ref, ws.declared.get(name)?.scope)];
    return found.filter(each => each && (each.kind !== 'place' || each.place.fileIds)).map(each => `${name}@${each.name}`);
}

/** Every key "<condition>@<ref>" may be stored under: the place-first name, the scope name and the text as written. */
export const refKeys = (ws, id) => [...new Set([...mapKeys(ws, id), id])];

/** "<condition>@<ref>" as it is kept: the map's name where both readings give one name, else as written (refKeys reads it). */
export function withMapName(ws, id) {
    const names = new Set(mapKeys(ws, id));
    return names.size === 1 ? [...names][0] : id;
}

/** Whether the condition "<condition>@<ref>" is active at `minute` under any of its keys. */
export const refActive = (ws, id, minute) => refKeys(ws, id).some(key => entryActive(ws.table[key], minute));
