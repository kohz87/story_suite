// The foes a Foes block holds, and the foes of the whole state.

import { levelOfClass } from '../../formula.js';
import { isHardBar } from '../../foes.js';
import { rpgBlocks } from './blocks.js';
import { textOf, whole } from './shared-basics.js';
import { levelOf, levelText } from './levels.js';
import { stageWord } from './words.js';
import { stageMax } from './stages.js';
import { blockBar } from './bar-text.js';

export const FOE_SLOTS = 6;

/** The foes a Foes block holds: `[{ slot, name, count, level, levelText ("Rank F · Lv 7"), hurt, word, max?, text?, blocks? }]` (a Standard group has its size `max`, the `text` "Hurt · 4 of 6"), empty slots left out (a slot is filled with a name and a count above 0, as the fight board reads it). */
export function foesOf(block, { ranks = [] } = {}) {
    const out = [];
    for (let slot = 1; slot <= FOE_SLOTS; slot += 1) {
        const name = textOf(block.fields[`foe${slot}`]);
        const count = whole(block.fields[`count${slot}`], 0);
        if (!name || count <= 0) continue;
        const schema = block.definition.state?.[`hurt${slot}`], blocks = blockBar('health', schema, block.fields, `hurt${slot}`);
        const hurt = blocks ? blocks.value : whole(block.fields[`hurt${slot}`], stageMax('health', schema));
        // `level{n}` (Levels); a chat made before them keeps its `class{n}`, whose level is the one the older rules stood for (formula.js levelOfClass).
        const level = Object.hasOwn(block.fields, `level${slot}`) ? levelOf(block.fields[`level${slot}`]) : levelOfClass(whole(block.fields[`class${slot}`], 1));
        out.push({ slot, name, count, level, levelled: Object.hasOwn(block.fields, `level${slot}`), levelText: levelText(level, { ranks, foe: true }), hurt,
            word: blocks ? blocks.word : stageWord('health', schema ?? block.definition.state?.health, hurt), ...(blocks ? { max: blocks.max, text: blocks.text, blocks: true } : {}), ...(blocks && isHardBar(schema) ? { hard: true } : {}) });
    }
    return out;
}

/** The foes in the state, across Foes blocks: `[{ name, count, level, levelText, hurt, word, slot }]`. */
export function readFoes(state, { roleOf, ranks = [] } = {}) {
    return rpgBlocks(state, { roleOf }).filter(block => block.role === 'foes').flatMap(block => foesOf(block, { ranks }));
}
