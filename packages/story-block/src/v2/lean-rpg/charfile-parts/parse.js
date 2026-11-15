// Reads a character file's text into a clean file or a plain-words refusal.

import { STATS } from '../names.js';
import { SKILL_FIELDS_MAX, SKILL_SLOTS_MAX, UTILITY_SLOTS } from '../../skill-slots.js';
import { classOfLevel, levelOfClass } from '../formula.js';
import { RPG_STRINGS, fill } from '../strings.js';
import { CHAR_FILE, CHAR_VERSION, FILE_LIMITS } from './limits.js';
import { readItem, readSkill } from './read-entries.js';
import { bad, isRecord, whole } from './shared-reading.js';

const F = RPG_STRINGS.file;

/**
 * Reads a file's text. → `{ ok: true, file }` with `file` = { level, soul, points, stats, skills, items?, money? } (clean copies, `items` and `money`
 * only when the file had them), or `{ ok: false, message }`.
 */
export function parseCharacterFile(text) {
    try {
        if (typeof text !== 'string' || !text.trim()) return bad(F.empty);
        if (new TextEncoder().encode(text).length > FILE_LIMITS.bytes) return bad(F.tooBig);
        let data;
        try { data = JSON.parse(text); } catch { return bad(F.notJson); }
        if (!isRecord(data) || !Object.hasOwn(data, CHAR_FILE)) return bad(F.notCharacter);
        if (data[CHAR_FILE] !== CHAR_VERSION) return bad(F.version);
        // A file of this build says `level` (1..99); one made before levels has only the Soul Class, which stands for the level 10n - 5.
        const hasLevel = data.level !== undefined;
        if (hasLevel ? !whole(data.level, ...FILE_LIMITS.level) : !whole(data.soul, ...FILE_LIMITS.soul)) return bad(F.soul);
        if (hasLevel && data.soul !== undefined && !whole(data.soul, ...FILE_LIMITS.soul)) return bad(F.soul);
        if (!whole(data.points, 0, FILE_LIMITS.points)) return bad(fill(F.points, { max: FILE_LIMITS.points }));
        if (!isRecord(data.stats)) return bad(F.stats);
        const stats = {};
        for (const stat of STATS) {
            if (!whole(data.stats[stat], ...FILE_LIMITS.stat)) return bad(fill(F.stat, { stat: stat.toUpperCase() }));
            stats[stat] = data.stats[stat];
        }
        const rawSkills = data.skills ?? [];
        if (!Array.isArray(rawSkills) || rawSkills.length > SKILL_FIELDS_MAX) return bad(fill(F.skills, { max: SKILL_FIELDS_MAX }));
        const skills = [];
        for (const [at, entry] of rawSkills.entries()) {
            const skill = readSkill(entry);
            if (!skill) return bad(fill(F.skill, { n: at + 1 }));
            skills.push(skill);
        }
        const utility = skills.filter(skill => skill.type === 'utility').length;
        if (utility > UTILITY_SLOTS || skills.length - utility > SKILL_SLOTS_MAX) return bad(F.skillPools);
        const level = hasLevel ? data.level : levelOfClass(data.soul);
        const file = { level, soul: data.soul ?? classOfLevel(level), points: data.points, stats, skills };
        if (data.items !== undefined) {
            if (!Array.isArray(data.items) || data.items.length > FILE_LIMITS.items) return bad(fill(F.items, { max: FILE_LIMITS.items }));
            file.items = [];
            for (const [at, entry] of data.items.entries()) {
                const item = readItem(entry);
                if (!item) return bad(fill(F.item, { n: at + 1, max: FILE_LIMITS.qty }));
                file.items.push(item);
            }
        }
        if (data.money !== undefined) {
            if (!whole(data.money, 0, FILE_LIMITS.money)) return bad(fill(F.money, { max: FILE_LIMITS.money.toLocaleString('en-US') }));
            file.money = data.money;
        }
        return { ok: true, file };
    } catch {
        return bad(F.notJson);
    }
}
