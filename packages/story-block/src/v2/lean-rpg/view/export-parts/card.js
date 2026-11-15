// What a Party card's character gives a saved file, in the file's shape and inside its limits.

import { classOfLevel } from '../../formula.js';
import { FILE_LIMITS } from '../../charfile.js';
import { CREATION, STATS, USES } from '../../names.js';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const oneLine = (value, max) => [...String(value ?? '').replace(/\s+/g, ' ').trim()].slice(0, max).join('').trim();

/**
 * What a card's character gives a saved file, from the party record `character` (party-data.js): { level, soul, points, stats, skills } in the file's shape
 * (every value inside the file's limits, whatever the block held).
 */
export function characterOfCard(character) {
    const stats = Object.fromEntries(STATS.map(key => {
        const found = character.stats.find(stat => stat.key === key);
        return [key, clamp(Number.isSafeInteger(found?.value) ? found.value : CREATION.start, ...FILE_LIMITS.stat)];
    }));
    const skills = character.skills.slice(0, 5).map(skill => ({
        name: oneLine(skill.name, CREATION.skillName), about: oneLine(skill.about, CREATION.skillAbout),
        ...(STATS.includes(skill.stat) ? { stat: skill.stat } : {}), uses: USES.includes(skill.uses) ? skill.uses : USES[0],
        rank: clamp(Number.isSafeInteger(skill.rank) ? skill.rank : 0, 0, FILE_LIMITS.rank),
    }));
    return { level: clamp(character.level, ...FILE_LIMITS.level), soul: classOfLevel(clamp(character.level, ...FILE_LIMITS.level)), points: clamp(character.points, 0, FILE_LIMITS.points), stats, skills };
}
