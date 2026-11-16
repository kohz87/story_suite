// Gives a story-made item its numbers (slot, rarity, stats) from what its line says, within the rarity ceiling.

import { isPlainObject } from '../../../scene/domains/common.js';
import { GEAR } from './constants.js';
import { gearSlotOf } from './slots.js';
import { gearRarityOf } from './rarity.js';
import { statsOf, withinBudget, gearBudget } from './budget.js';
import { statsFor } from './stat-choice.js';
import { soakCap } from './soak.js';

const RANK = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary']);

/**
 * The numbers a story-made item gets (the `item.define` step for `story-block.gear`): its `slot` (only while it has none),
 * `rarity` (only when the line names one), `soak` (`soak: N`, held to the slot's cap) and `stats`: the ones the line names (`said.stats`, { DEX: 2 }), else the kind's or the
 * slot's, held to the rarity's budget. Other numbers on the line are never read. A rarity word reaches `epic` at most unless
 * `allowLegendary` (the same reply completed a quest or won a hard fight, or a module's reward) and to `ceiling` (the place's `loot.maxRarity`). A slot makes plain goods equipment.
 */
export function gearDefine(def, said = {}, { allowLegendary = false, ceiling = null, onHeld = null } = {}) {
    if (!def || typeof def !== 'object') return def;
    if (def.slot === null || def.slot === undefined) {
        const slot = gearSlotOf(said.slot ?? said.kind, def.name);
        if (slot) {
            def.slot = slot;
            if (def.kind === 'goods') def.kind = 'equipment';
        }
    }
    const rarity = gearRarityOf(said.rarity);
    if (rarity) {
        // The ceiling: epic for the story's own words (legendary only when earned), lowered further by the place's `loot.maxRarity`.
        let top = allowLegendary ? 'legendary' : GEAR.storyRarityMax;
        if (RANK.includes(ceiling) && RANK.indexOf(ceiling) < RANK.indexOf(top)) top = ceiling;
        def.rarity = RANK.indexOf(rarity) > RANK.indexOf(top) ? top : rarity;
        if (def.rarity !== rarity) onHeld?.(rarity, def.rarity);
    }
    if (def.slot && (!isPlainObject(def.stats) || !Object.keys(def.stats).length)) {
        const named = withinBudget(statsOf(said.stats), gearBudget(def), said.ordered === true);
        def.stats = Object.keys(named).length ? named : (statsFor(def, null, said.finesse === true));
    }
    // The soak a line names (`| soak: 2`): a whole number held to the slot's cap (body 2, off-hand 2, head 1, the rest none), so a line cannot mint it.
    const asked = Number(/^\s*\+?(\d{1,3})\s*$/.exec(String(said.soak ?? ''))?.[1]);
    const soak = def.slot ? Math.min(asked, soakCap(def.slot)) : 0;
    if (soak > 0) def.soak = soak;
    return def;
}
