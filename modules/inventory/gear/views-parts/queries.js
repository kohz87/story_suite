// Builds the four gear queries (`inventory.statBonus`, `inventory.gear`, `gear.view`, `gear.carry`) over the supplied readers.

import { carryAnswer } from '../carry.js';
import { statBonus, gearAnswer } from './answers.js';
import { gearView } from './view.js';

/**
 * The two gear queries: `inventory.gear` and `gear.carry` (`items.carry`'s answer from Story Block's own rules, asked only when no
 * carry module answers `items.carry`; a query of that name would clash with a carry module's). Both answer null while `on()` is false.
 */
export function createGearQueries({ on, kit = () => false, empty = () => false, condOf, carryOf, penalty, feature, names = () => '', owners = () => [] }) {
    // (`recorded: true`, asked by a roll that carries a gear record, answers whatever the switch says now: the record decides, gear.js `wearGear`)
    // (`inventory.gear` has no `feature`: the registry would answer null for it while the switch is off, and a roll that carries a gear record asks it then)
    const gate = (fn, recorded = false) => Object.assign((state, args, tools) => (on() || args?.recorded === true ? fn(state, args, tools) : null), recorded ? {} : { feature });
    // The mount rows, as the (feature-gated) `mounts.list` query gives them: none while Mounts is off.
    const mountsOf = tools => { try { const rows = tools?.query?.('mounts.list'); return Array.isArray(rows) ? rows : []; } catch { return []; } };
    return {
        'inventory.statBonus': gate((state, args) => statBonus(state, typeof args?.owner === 'string' && args.owner ? args.owner : 'party', condOf)),
        'inventory.gear': gate((state, args, tools) => gearAnswer(state, args, { condOf, carryOf, penalty, mounts: mountsOf(tools) }), true),
        'gear.view': gate((state, args, tools) => gearView(state, args, { kit, empty, condOf, carryOf, penalty, mounts: mountsOf(tools), names: id => names(state, tools, id), owners: () => owners(state, tools) })),
        'gear.carry': gate((state, args, tools) => carryAnswer(state, args, { carryOf, mounts: mountsOf(tools) })),
    };
}
