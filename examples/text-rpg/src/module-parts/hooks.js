// `beforeGenerate`: offers the reply's dice as a system step on a normal send, a regenerate or a swipe.
import { DOMAIN } from '../domain/shape.js';
import { floorIndex } from '../rules/difficulty.js';
import { active } from './active.js';
import { liveConditions, minutesOf } from './conditions.js';
import { players } from './members.js';
import { recordable, rulesOf } from './rules-now.js';

const OFFERED = ['normal', 'regenerate', 'swipe'];

// What the domain knows: the reader's conditions and the threat the latest rolled reply named (0 when unknown).
function floorOf(view) {
    const slice = view.state?.domains?.[DOMAIN];
    const last = Object.values(slice?.dice ?? {}).at(-1);
    return floorIndex({ threat: last?.threat ?? 0, conditions: liveConditions(players(slice)[0], minutesOf(view.state)).length });
}

/** `hooks.beforeGenerate(view, info)` → `{ commands: [textRpg.dice] }` or null. */
export function beforeGenerate(view, info = {}) {
    if (!active(view) || info?.commit === false) return null;
    const type = String(info?.type ?? 'normal').toLowerCase();
    if (!OFFERED.includes(type)) return null;
    const rules = recordable(rulesOf(view));
    return { commands: [{ type: 'textRpg.dice', payload: { floor: floorOf(view), own: type !== 'normal', ...(minutesOf(view.state) !== null ? { clock: minutesOf(view.state) } : {}), ...(rules ? { rules } : {}) } }] };
}
