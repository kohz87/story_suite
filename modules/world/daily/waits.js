// World events, the daily step: `waits_for`, a scene beat that waits for the party. While its window is open it is rolled only on a day the
// party is in (or next to) its region, and on the window's last day it fires anyway, wherever the party is: like a set-in-motion deadline
// (`forced`: over the caps, no Director veto). On an earlier day it waits for, a set-in-motion event fires and a likely or possible one rolls
// its ordinary chance. A ×0 modifier still blocks, except a set-in-motion event on its last day, as without `waits_for`. Pure (on `ws`).

import { waitMet } from './near.js';

/** Today's chance for a waiting event, `chance` its ordinary one and `last` whether today ends its window: the chance to roll, or null when it waits. */
export function waitedChance(ws, def, chance, { day, last }) {
    if (!last && !waitMet(ws, def)) {
        ws.log.push({ kind: 'waits', key: def.id, day });
        return null;
    }
    if (chance.blocked) return chance;
    if (last) return { p: 1, blocked: false, forced: true };
    return def.certainty === 'set-in-motion' ? { p: 1, blocked: false } : chance;
}
