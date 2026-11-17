// The party: one record per Character block, the reader's own character first.

import { STANDARD_NUMBERS, levelOfClass } from '../../formula.js';
import { characterBars, growthOf, scaleOf, statsOfFields } from '../../blocks.js';
import { actorsOf } from '../../../data-modules/adapters.js';
import { LEVEL } from '../../names.js';
import { soulLabelOf } from '../../soul.js';
import { rpgBlocks } from './blocks.js';
import { fold, textOf, whole } from './shared-basics.js';
import { levelOf, levelText } from './levels.js';
import { soulName } from './words.js';
import { skillsOf } from './skills.js';
import { isV1Character, v1Bars, v1Stats } from './v1-bars.js';

/**
 * The party: one record per Character block (per attached character for a character-scope block), the reader's own
 * character first (`own` is their name), then block order. Each: `{ module, subject, name, own, alive, left (a companion who left the party), points, level, cap, levelText ("Lv 14 · Guild F"),
 * soul / soulName / soulLabel (the level standing in for the old Soul Class), xp, bars: { health, mana, stamina: { value, max, word, tone, text?, blocks? } } (a
 * Standard block's bars: `max` is its size from the stats, `text` "Hurt · 4 of 6"), growth (the Standard "next block / next luck" numbers, blocks.js `growthOf`, or null), stats: [{ key, label, value, min, max }],
 * skills, skillsBlock, definition, fields }`.
 */
export function readParty(state, { own = '', roleOf, ranks = [], playerRank = null } = {}) {
    const blocks = rpgBlocks(state, { roleOf });
    const actors = actorsOf(state);
    const skillBlocks = blocks.filter(block => block.role === 'skills');
    const characters = blocks.filter(block => block.role === 'character').map(block => {
        const { fields, definition } = block;
        const name = textOf(fields.who) || actors[block.subject]?.name || definition.name;
        // (only a Combat Rules v1 Character is a party member; any other block is not drawn)
        if (!isV1Character(definition)) return null;
        const v1 = true, bars = v1Bars(definition, fields), stats = v1Stats(definition, fields);
        // `level`, `xp` and `cap` (Levels). A block made before them has the Soul Class: its level is the one the class stood for (formula.js levelOfClass).
        const soul = whole(fields.soul, 1);
        const levelled = Boolean(definition.state?.level) && typeof definition.state.level === 'object';
        const level = levelled ? levelOf(fields.level) : levelOfClass(soul), cap = levelOf(fields.cap, LEVEL.max);
        const mine = skillBlocks.find(item => textOf(item.fields.who) && fold(item.fields.who) === fold(name))
            ?? (skillBlocks.length === 1 && !textOf(skillBlocks[0].fields.who) ? skillBlocks[0] : null);
        return { module: block.module, subject: block.subject, name, own: false, ...(v1 ? { v1: true } : {}), alive: fields.alive !== false, left: fields.left === true, points: Math.max(0, whole(fields.points)),
            soul, level, cap, ...(levelled ? { levelled: true } : {}), levelText: levelText(level, { ranks, playerRank, state, subject: block.subject }),
            soulName: levelled ? String(level) : soulName(definition.state?.soul, soul), soulLabel: soulLabelOf(levelled ? definition.state.level : definition.state?.soul), xp: Math.min(LEVEL.xpPerLevel, Math.max(0, whole(fields.xp))), bars, stats,
            skills: mine ? skillsOf(mine) : [], skillsBlock: mine ? { module: mine.module, definition: mine.definition } : null, definition, fields, order: block.order,
            growth: !v1 && characterBars(definition, fields) ? growthOf(statsOfFields(fields), { statMax: whole(definition.state?.vit?.max, STANDARD_NUMBERS.statMax), scale: scaleOf(definition.state?.health) }) : null, scale: scaleOf(definition.state?.health) };
    }).filter(Boolean);
    const mineAt = own ? characters.findIndex(character => fold(character.name) === fold(own)) : -1;
    if (mineAt >= 0) characters[mineAt].own = true;
    return mineAt > 0 ? [characters[mineAt], ...characters.filter((_, at) => at !== mineAt)] : characters;
}
