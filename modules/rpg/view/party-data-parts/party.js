// The party: one record per Character block, the reader's own character first.

import { STATS } from '../../index.js';
import { STANDARD_NUMBERS, levelOfClass } from '../../formula.js';
import { characterBars, growthOf, scaleOf, statsOfFields } from '../../blocks.js';
import { actorsOf } from '../../../../packages/story-block/src/v2/data-modules/adapters.js';
import { LEVEL } from '../../names.js';
import { soulLabelOf } from '../../soul.js';
import { rpgBlocks } from './blocks.js';
import { fold, textOf, whole } from './shared-basics.js';
import { levelOf, levelText } from './levels.js';
import { soulName, stageWord } from './words.js';
import { BARS, stageMax, stageTone } from './stages.js';
import { blockBar } from './bar-text.js';
import { skillsOf } from './skills.js';

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
        const bars = Object.fromEntries(BARS.map(key => {
            const schema = definition.state?.[key], blocks = blockBar(key, schema, fields);
            if (blocks) return [key, blocks];
            const max = stageMax(key, schema), value = Math.min(max, Math.max(0, whole(fields[key], max)));
            return [key, { value, max, word: stageWord(key, schema, value), tone: stageTone(value, max) }];
        }));
        const stats = STATS.map(key => {
            const schema = definition.state?.[key] ?? {};
            const label = typeof schema.label === 'string' && schema.label && [...schema.label].length <= 4 ? schema.label : key.toUpperCase();
            return { key, label, value: whole(fields[key], schema.min ?? 1), min: whole(schema.min, 1), max: whole(schema.max, 20) };
        });
        // `level`, `xp` and `cap` (Levels). A block made before them has the Soul Class: its level is the one the class stood for (formula.js levelOfClass).
        const soul = whole(fields.soul, 1);
        const levelled = Boolean(definition.state?.level) && typeof definition.state.level === 'object';
        const level = levelled ? levelOf(fields.level) : levelOfClass(soul), cap = levelOf(fields.cap, LEVEL.max);
        const mine = skillBlocks.find(item => textOf(item.fields.who) && fold(item.fields.who) === fold(name))
            ?? (skillBlocks.length === 1 && !textOf(skillBlocks[0].fields.who) ? skillBlocks[0] : null);
        return { module: block.module, subject: block.subject, name, own: false, alive: fields.alive !== false, left: fields.left === true, points: Math.max(0, whole(fields.points)),
            soul, level, cap, ...(levelled ? { levelled: true } : {}), levelText: levelText(level, { ranks, playerRank, state, subject: block.subject }),
            soulName: levelled ? String(level) : soulName(definition.state?.soul, soul), soulLabel: soulLabelOf(levelled ? definition.state.level : definition.state?.soul), xp: Math.min(LEVEL.xpPerLevel, Math.max(0, whole(fields.xp))), bars, stats,
            skills: mine ? skillsOf(mine) : [], skillsBlock: mine ? { module: mine.module, definition: mine.definition } : null, definition, fields, order: block.order,
            growth: characterBars(definition, fields) ? growthOf(statsOfFields(fields), { statMax: whole(definition.state?.vit?.max, STANDARD_NUMBERS.statMax), scale: scaleOf(definition.state?.health) }) : null, scale: scaleOf(definition.state?.health) };
    });
    const mineAt = own ? characters.findIndex(character => fold(character.name) === fold(own)) : -1;
    if (mineAt >= 0) characters[mineAt].own = true;
    return mineAt > 0 ? [characters[mineAt], ...characters.filter((_, at) => at !== mineAt)] : characters;
}
