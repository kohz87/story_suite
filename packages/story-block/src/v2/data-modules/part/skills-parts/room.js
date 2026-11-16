// How many skill slots a character's level opens: the ones the block has open, and the ones the level wants.
import { fold, readSheet } from '../../../../../../../modules/rpg/read.js';
import { SKILL_SLOTS_MAX, skillSlots } from '../../../../../../../core/runtime/skill-slots.js';

// How many skill slots a Skills block has open: the slots it has, as far as its character's level opens them (names.js skillSlots); a Skills block no Character names is read at level 1.
export function skillRoom(state, definition, fields) {
    const capacity = Math.min(SKILL_SLOTS_MAX, Object.keys(definition.state ?? {}).filter(key => /^skill\d+$/u.test(key)).length);
    let level = 1;
    try { level = readSheet(state).characters.find(person => fold(person.who) === fold(fields.who))?.level ?? 1; } catch { level = 1; }
    return Math.min(capacity, skillSlots(level));
}
// The slots the character's level opens (names.js skillSlots), whatever the block has.
export function skillWant(state, fields) {
    let level = 1;
    try { level = readSheet(state).characters.find(person => fold(person.who) === fold(fields.who))?.level ?? 1; } catch { level = 1; }
    return skillSlots(level);
}
