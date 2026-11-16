// Story Director v2, part **cast**: reading Lean RPG Foes slots and detecting leftover fights from pulse records.

import { isRecord } from '../domain.js';
import { slotValue } from '../../../rpg/slot.js';

/**
 * Whether a Lean RPG fight is open in `state`: a Foes block (a data module with the role `foes`) with a live slot: a name, a count above
 * 0 and health above 0. This is Story Block's own reading (lean-rpg/read.js `foesOf` + gate.js `fightLive`; it offers no query for it):
 * a slot is filled with a name and a count above 0, and live when its `hurt` (Classic: the stage index, Standard: the blocks left; a
 * whole number either way, a missing or other value reads 0) is above 0. A slot at 0 is Down; a block of Down groups only is a won fight.
 * The narrator never empties a slot, it only sets health, so the filled slot of a won fight stays.
 */
export function leanFight(state) {
    return foesSignature(state) !== '';
}

/**
 * The live Foes slots as one text (`1:Ridge cutpurses:2:3|...`), '' for none: what `leanFight` reads, kept so a caller can tell a fight that moves
 * (a slot set, a count or its health changed) from a leftover (the same text reply after reply: the narrator never empties a won fight's slot).
 */
export function foesSignature(state) {
    const domain = state?.domains?.dataModules;
    if (!isRecord(domain) || !isRecord(domain.active)) return '';
    const live = [];
    for (const id of Object.keys(domain.active)) {
        const definition = domain.pins?.[domain.active[id]?.hash]?.definition;
        const fields = domain.instances?.[id]?.chat?.fields;
        if (!isRecord(definition) || definition.role !== 'foes' || !isRecord(fields)) continue;
        for (let slot = 1; slot <= 4; slot += 1) {
            if (typeof fields[`foe${slot}`] === 'string' && fields[`foe${slot}`].trim() && Number.isSafeInteger(fields[`count${slot}`]) && fields[`count${slot}`] > 0
                && Number.isSafeInteger(fields[`hurt${slot}`]) && fields[`hurt${slot}`] > 0) live.push(`${slot}:${fields[`foe${slot}`].trim()}:${fields[`count${slot}`]}:${fields[`hurt${slot}`]}`);
        }
    }
    return live.join('|');
}

/**
 * Whether the Foes slots are a leftover: set, and the same text on each of the last `replies` recorded world-pulse results (`results`, oldest
 * first, each with the `foes` it saw): the narrator never empties a won fight's slot, so a fight that does not move is not a fight. The world
 * pulse and the chance meetings both read it, so one stuck slot gives the same answer in both.
 */
export function foesLeftover(state, results, replies = 2) {
    const foes = foesSignature(state);
    const list = Array.isArray(results) ? results : [];
    return foes !== '' && list.length >= replies && list.slice(-replies).every(entry => entry?.foes === foes);
}

/** The world pulse's recorded results of replies before `at` (`state.domains.director.pulse`), oldest first: what `foesLeftover` reads. */
export function pulseResults(state, at = null) {
    const results = slotValue(state?.domains?.director?.pulse)?.results;
    return (Array.isArray(results) ? results : []).filter(entry => isRecord(entry) && entry.at !== at);
}
