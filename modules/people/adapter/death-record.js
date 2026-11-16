// A dossier marked dead by a confirmed event (src/adapter/native-death.js).

import { manualLifeStateRecord } from '../core/terminal-lifecycle.js';

/** A dossier marked dead by a confirmed event: Delta's own explicit, terminal death record, with the event as its reason. */
export function confirmedDeath(npc, { event, now }) {
    const dead = manualLifeStateRecord(npc, 'deceased', now);
    dead.lifeStateReason = `Confirmed dead by the rules (event ${String(event).slice(0, 60)}).`;
    return dead;
}
