// `beforeGenerate`: offers the reply's dice as a system step on a normal send, a regenerate or a swipe.
import { DOMAIN } from '../domain/shape.js';
import { floorIndex } from '../rules/floor.js';
import { gearOf } from './gear.js';
import { matchupOf } from './matchup.js';
import { active } from './active.js';
import { liveConditions, minutesOf } from './conditions.js';
import { players } from './members.js';
import { recordable, rulesOf } from './rules-now.js';

const OFFERED = ['normal', 'regenerate', 'swipe'];

// What the domain knows: the reader's conditions.
function floorOf(view) {
    const slice = view.state?.domains?.[DOMAIN];
    return floorIndex({ conditions: liveConditions(players(slice)[0], minutesOf(view.state)).length });
}

/** `hooks.beforeGenerate(view, info)` → `{ commands: [textRpg.dice] }` or null. */
export function beforeGenerate(view, info = {}) {
    if (!active(view) || info?.commit === false) return null;
    const type = String(info?.type ?? 'normal').toLowerCase();
    if (!OFFERED.includes(type)) return null;
    const rules = recordable(rulesOf(view));
    const matchup = matchupOf(view.state?.domains?.[DOMAIN], member => gearOf(view.query, member).cap, minutesOf(view.state));
    return { commands: [{ type: 'textRpg.dice', payload: { floor: floorOf(view), ...(matchup ? { matchup } : {}), own: type !== 'normal', ...(minutesOf(view.state) !== null ? { clock: minutesOf(view.state) } : {}), ...(rules ? { rules } : {}) } }] };
}
