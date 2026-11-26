// World events on the host: the player's holding as anchors (switch story-director.world-events). After a reply's lines, the day a
// founded holding (`fact:pc-holding-founded`) and one with a seat (`fact:pc-seat-claimed`) were first seen is written in the ledger,
// each once. That is only the day: whether a fact counts is asked of the holding as it stands (holding-facts.js), because a later
// reply's ledger slot is written whole and can still carry the day of a founding that was deleted.

import { markLedger } from '../conditions/ledger.js';
import { clockOf } from '../capture/text.js';
import { worldEventsOn } from '../capture/world-parts/switch.js';
import { WORLD_EVENTS_FEATURE } from '../conditions/feature.js';
import { knownAnchors } from './learned.js';
import { holdingFacts } from './holding-facts.js';

export const HOLDING = 'chronicle.world.holding';
const DAY = 1440;

/** The anchors the holding makes that are not recorded yet (`holding`: the `dataModules.holding` answer, null before a founding). */
export function holdingAnchors(holding, known = new Set()) {
    return holdingFacts(holding).filter(key => !known.has(key));
}

/** Whether a reply's state holds a holding anchor the world has not recorded (the hook asks before it sends the command). */
export function holdingDue(view) {
    if (!view?.state?.domains?.dataModules || typeof view.query !== 'function') return false;
    let holding = null;
    try { holding = view.query('dataModules.holding', {}); } catch { holding = null; }
    return holdingAnchors(holding, knownAnchors(view.state.domains.chronicle)).length > 0;
}

function record(ctx) {
    if (ctx.cause !== 'system' || ctx.caller) return ctx.fail('REFUSED', 'The holding is recorded only by code after a reply.');
    if (!worldEventsOn(ctx)) return ctx.fail('REFUSED', 'World events are off.');
    const now = clockOf(ctx);
    if (now === null) return { summary: '', narrate: false, data: { anchors: [] } };
    const chronicle = ctx.draft('chronicle');
    let holding = null;
    try { holding = ctx.query('dataModules.holding', {}); } catch { holding = null; }
    const anchors = holdingAnchors(holding, knownAnchors(chronicle));
    if (!anchors.length) return { summary: '', narrate: false, data: { anchors: [] } };
    markLedger(chronicle, { day: Math.floor(now / DAY), anchors });
    return { summary: `World: your holding is known (fact ${anchors.map(key => key.slice(5)).join(', ')} written).`, narrate: false, data: { anchors } };
}

/** The command, tagged with the feature and internal (never from a click or the sdk). */
export const holdingCommand = Object.assign(record, { feature: WORLD_EVENTS_FEATURE });
Object.defineProperty(holdingCommand, 'internal', { value: true, enumerable: true });
