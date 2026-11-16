// The text of bars: a Standard block bar's reading, the choices of a bar's edit and the growth line.

import { barOf, sizeOf, spreadWord, wordsOf } from '../../blocks.js';
import { soakGrowth } from '../../soak.js';
import { RPG_STRINGS, fill } from '../../strings.js';
import { whole } from './shared-basics.js';
import { stageWord } from './words.js';
import { stageTone } from './stages.js';

/** The bar's own reading when its field is a Standard block bar: `{ value, max, word, text, tone, blocks: true }` (`text`: "Hurt · 4/6"), else null. */
export function blockBar(key, schema, fields, fieldKey = key) {
    const bar = barOf(schema);
    if (!bar) return null;
    const size = sizeOf(schema, fields, fieldKey), value = Math.min(size, Math.max(0, whole(fields?.[fieldKey], size)));
    const word = spreadWord(wordsOf(bar), value, size);
    return { value, max: size, word, text: fill(RPG_STRINGS.blocks.of, { word, n: value, max: size }), tone: stageTone(value, size), blocks: true };
}

// "Soak +3 (next at VIT 16)": what VIT soaks of a foe's hit in a marked fight (soak.js), from the VIT a roll uses (gear included).
const soakLine = vit => { const { s, next } = soakGrowth(vit); return fill(next === null ? RPG_STRINGS.blocks.soakTop : RPG_STRINGS.blocks.soak, { n: s, next: next ?? '' }); };

/**
 * The line under a Standard character's skills (mockup step 1): "Health 6 blocks (VIT 10, next at 15) · Stamina 5 (AGI 10, next at 15) · Mana 4 (INT 5, next at 10) ·
 * Edge 0..+3 (next at LUK 11) · Soak +3 (next at VIT 16)" (Soak only for a character with the doubled bars, from `soakVit`, the VIT a roll uses). `growth` is `growthOf` (blocks.js); a stat at its maximum has no next block, and the edge window steps at LUK 5, 7, 11, 13, 15, 17 and 19.
 */
export function growthText(growth, soakVit = null) {
    const B = RPG_STRINGS.blocks;
    const bar = (word, group) => fill(group.next === null ? B[`${word}Top`] : B[word], { n: group.blocks, stat: group.value, next: group.next ?? '' });
    const sign = n => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
    return [bar('growthHealth', growth.health), bar('growthStamina', growth.stamina), bar('growthMana', growth.mana),
        fill(growth.luck.next === null ? B.luckTop : B.luck, { min: sign(growth.luck.min), max: sign(growth.luck.max), next: growth.luck.next ?? '' }),
        ...(Number.isFinite(soakVit) ? [soakLine(soakVit)] : [])].join(' · ');
}

/** The choices of a bar's edit (the pencil): every count from empty to full, "Hurt · 4/6" for a block bar, the stage word for a stage bar. */
export function barOptions(key, schema, bar, fields, fieldKey = key) {
    if (bar?.blocks) return Array.from({ length: bar.max + 1 }, (_, value) => ({ value, label: fill(RPG_STRINGS.blocks.of, { word: spreadWord(wordsOf(barOf(schema)), value, bar.max), n: value, max: bar.max }) }));
    return Array.from({ length: bar.max + 1 }, (_, value) => ({ value, label: stageWord(key, schema, value) }));
}
