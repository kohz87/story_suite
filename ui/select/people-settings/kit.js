// Builders for one People settings row: where it reads in NPC State's settings bucket and how a change writes back.

import { clamp, row } from './kit-more.js';

/** A number row over bucket `key`: shown as stored (else `dflt`), written the way the old panel's box wrote it: whole number cut to min..max, a blank is `dflt`. */
export const intRow = (group, key, label, store, dflt, { min, max, hint = null, unit = null, tags = [], fallback = dflt } = {}) => row(group, key, 'num', label, {
  hint, unit, tags, store, dflt, reset: [[store, dflt]], read: b => b[store] ?? dflt, write: v => [[store, clamp(min, max, fallback)(v)]],
});

/** A number row for a setting the host's own schema cuts (the sdk's `settings.set` applies min and max), written as given. */
export const schemaRow = (group, key, label, store, dflt, { hint = null, unit = null } = {}) => row(group, key, 'num', label, {
  hint, unit, store, dflt, reset: [[store, dflt]], read: b => b[store] ?? dflt, write: v => [[store, v]],
});

export const swRow = (group, key, label, store, dflt, { hint = null } = {}) => row(group, key, 'sw', label, {
  hint, store, dflt, reset: [[store, dflt]], read: b => (b[store] === undefined ? dflt : b[store] !== false && Boolean(b[store])), write: v => [[store, Boolean(v)]],
});

/** A segmented row whose labels map to stored values (`pairs`: [[label, value], ...]). */
export const segRow = (group, key, label, store, dflt, pairs, { hint = null } = {}) => row(group, key, 'seg', label, {
  hint, store, dflt, reset: [[store, dflt]], options: pairs.map(p => p[0]),
  read: b => (pairs.find(p => p[1] === (b[store] ?? dflt)) ?? pairs.find(p => p[1] === dflt))[0],
  write: v => { const hit = pairs.find(p => p[0] === v); return hit ? [[store, hit[1]]] : null; },
});
