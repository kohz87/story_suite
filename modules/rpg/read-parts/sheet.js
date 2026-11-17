// Reads the chat's RPG blocks into `{ characters, foes, problems }`.
import { fold } from './match.js';
import { definitionOf, fieldsOf, hiddenOf, shownFields } from './hidden.js';
import { isObject, int, text } from './shared-plain.js';
import { characterV1, skillsV1, foesV1, v1Of } from './v1-rows.js';

/**
 * The chat's RPG blocks: `{ characters, foes, problems }`.
 *   characters: [{ module, who, key, health, mana, stamina, size?, stats: { str…cha }, soul, xp, points, down, alive,
 *                  skills: [{ slot, name, about, rank, practice, stat, uses }] }]   (a Skills block joins the character its `who` names;
 *                  stat is one of STATS and uses 'stamina' | 'mana', or null for a block that has neither)
 *                  `size`: { health, stamina, mana } only for a Standard Character block, where those three are the blocks left)
 *   foes: the slots (six; an older block has four) of every Foes block in block order, [{ slot, module, name, count, level, class, hurt, size?, filled }] ([] without one; `level` 1–99, worked out from `class` for a block of the earlier rules, which has no `levelled`; `class` of a levelled group is the Soul Class its level stands for, which the fight XP table of the earlier rules still reads); `size`: the
 *         blocks a Standard group's Health has (`hurt` is the blocks left); `slot`
 *         counts on across blocks (1–4, then 5–8, …), `filled` = a name and a count above 0
 *   problems: plain sentences for blocks left out (no `who`, two characters of one name)
 */
export function readSheet(state, { withLeft = false } = {}) {
    const sheet = { characters: [], foes: [], problems: [] };
    const domain = state?.domains?.dataModules;
    if (!isObject(domain) || !isObject(domain.active)) return sheet;
    const ids = Object.keys(domain.active).sort();
    const skills = [];
    for (const id of ids) {
        const definition = definitionOf(domain, id);
        const role = definition?.role;
        const raw = fieldsOf(domain, id);
        if (!raw || typeof role !== 'string') continue;
        const hidden = hiddenOf(definition), fields = shownFields(raw, hidden);
        if (role === 'character') {
            // A companion who left the party (`left`) is kept on the Party tab but is not on the sheet the dice are rolled for.
            // (`withLeft`, for `party.levels`: read too, `left: true`; `sheetLevel` is the stated level or null.)
            const gone = fields.left === true;
            if (gone && !withLeft) continue;
            // (only Combat Rules v1's Character is read; any other is refused: no fight can be played on it)
            if (v1Of(fields) !== 'character') { sheet.problems.push(`The Character block "${id}" is not a Combat Rules v1 Character, so it is left out.`); continue; }
            const found = characterV1(id, fields, hidden.has('who') || withLeft ? definition.name : '', hidden);   // (`withLeft`: a blank Name uses the block's name, as the Party card does)
            if (found && withLeft) Object.assign(found, { left: gone, sheetLevel: int(fields.level) !== null || Object.hasOwn(fields, 'soul') ? found.level : null });   // (the level the card shows: clamped 1–99)
            if (!found) sheet.problems.push(`The Character block "${id}" has no name in its Who field, so it is left out.`);
            else if (!withLeft && sheet.characters.some(other => other.key === found.key)) sheet.problems.push(`Two Character blocks are called ${found.who}; only the first is used.`);
            else sheet.characters.push(found);
        } else if (role === 'skills') {
            const who = text(fields.who) || (hidden.has('who') ? text(definition.name) : '');
            if (v1Of(fields) !== 'skills') sheet.problems.push(`The Skills block "${id}" is not a Combat Rules v1 Skills block, so it is left out.`);
            else if (who) skills.push({ who, fields, hidden });
            else sheet.problems.push(`The Skills block "${id}" has no name in its Who field, so it is left out.`);
        } else if (role === 'foes') {
            if (v1Of(raw) === 'foes') sheet.foes.push(...foesV1(id, raw, sheet.foes.length, hidden));
            else sheet.problems.push(`The Foes block "${id}" is not a Combat Rules v1 Foes block, so it is left out.`);
        }
    }
    for (const block of skills) {
        const owner = sheet.characters.find(entry => entry.key === fold(block.who));
        if (owner && !owner.skills.length && owner.v1) owner.skills = skillsV1(block.fields, block.hidden);
    }
    return sheet;
}
