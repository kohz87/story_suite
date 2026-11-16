// What the Fight tab reads: the filled foe slots with their bars, and whether any foe is there.

import { barOptions, foesOf, rpgBlocks, stageMax, stageTone } from '../party-data.js';

/** The foes of every Foes block, filled slots only: `foesOf`'s records with where each one is kept (for the pencil), its health bar and the words of its stages. */
export function readFight(state, { roleOf, ranks = [] } = {}) {
    return rpgBlocks(state, { roleOf }).filter(block => block.role === 'foes').flatMap(block => foesOf(block, { ranks }).map(foe => {
        const schema = block.definition.state?.[`hurt${foe.slot}`], max = foe.blocks ? foe.max : stageMax('health', schema);
        return { ...foe, module: block.module, subject: block.subject, max, tone: stageTone(Math.min(foe.hurt, max), max), down: foe.hurt <= 0,
            stages: barOptions('health', schema, { max, blocks: foe.blocks }), locked: schema?.edit === false };
    }));
}

/** Whether any foe slot is filled (the Fight tab shows only then). */
export const hasFoes = (state, options) => rpgBlocks(state, options).some(block => block.role === 'foes' && foesOf(block).length > 0);
