// Reads one Combat Rules v1 Character, Skills or Foes block's fields into the sheet's plain records (templates-parts/v1-*.js). The earlier blocks are read by rows.js, unchanged: a v1 block
// is known by a field only it has (`hp-max` on a Character, `tier1` on Foes, a `type1` without `uses1` on Skills), never by a setting.
import { fold } from './match.js';
import { int, text, TEXT_KEY } from './shared-plain.js';
import { LEVEL, STATS_V1 } from '../names.js';
import { SKILL_FIELDS_MAX } from '../../../core/runtime/skill-slots.js';

// (Kept free of combat/: the page start reaches this file, and the values a v1 block holds are already held to their bounds by the block checker. What a skill's rank is worth, and a
// foe's tier, are the combat files' to say: combat/skills.js rankOf(practice, level) and combat/foes.js foeStats.)

/** Which v1 block these fields are: 'character' (has `hp-max` and `wis`), 'skills' (a `type1` and no `uses1`), 'foes' (a `tier1`), else null: an earlier block, read by rows.js. */
export function v1Of(fields) {
    if (fields === null || typeof fields !== 'object') return null;
    if (Object.hasOwn(fields, 'hp-max') && Object.hasOwn(fields, 'wis')) return 'character';
    if (Object.hasOwn(fields, 'tier1')) return 'foes';
    return Object.hasOwn(fields, 'type1') && !Object.hasOwn(fields, 'uses1') ? 'skills' : null;
}

const held = (value, min, max, fallback) => Math.min(max, Math.max(min, int(value) ?? fallback));

/** One v1 Character: `{ module, who, key, v1, hp, mp, sp, max: { hp, mp, sp }, stats, level, cap, xp, points, alive, skills: [], hidden }`; null without a name. Bars are numbers held to 0..largest; `skills` is filled by readSheet. */
export function characterV1(id, fields, own = '', hidden = new Set()) {
    const who = text(fields.who) || text(own);
    if (!who) return null;
    const max = { hp: int(fields['hp-max']) ?? 0, mp: int(fields['mp-max']) ?? 0, sp: int(fields['sp-max']) ?? 0 };
    const stats = Object.fromEntries(STATS_V1.map(stat => [stat, int(fields[stat]) ?? 0]));
    return {
        module: id, who, key: fold(who), v1: true,
        hp: held(fields.hp, 0, max.hp, max.hp), mp: held(fields.mp, 0, max.mp, max.mp), sp: held(fields.sp, 0, max.sp, max.sp), max,
        stats, level: held(fields.level, LEVEL.min, LEVEL.max, 1), cap: held(fields.cap, LEVEL.min, LEVEL.max, LEVEL.max),
        xp: int(fields.xp) ?? 0, points: int(fields.points) ?? 0, alive: fields.alive !== false, skills: [],
        hidden: [...hidden].filter(key => !TEXT_KEY.test(key)),
    };
}

/**
 * The skills of a v1 Skills block: `{ slot, name, about, stat, type, practice, rank, hidden }`. `rank` (0..6) is the one the practice has earned (a hundred a rank); the rank in force
 * also needs the owner's level (combat/skills.js rankOf(practice, level)), which the fight reads when it builds the party.
 */
export function skillsV1(fields, hidden = new Set()) {
    const out = [];
    for (let n = 1; n <= SKILL_FIELDS_MAX; n += 1) {
        const name = text(fields[`skill${n}`]);
        if (!name) continue;
        out.push({
            slot: n, name, about: text(fields[`about${n}`]), stat: text(fields[`stat${n}`]).toLowerCase(), type: text(fields[`type${n}`]).toLowerCase(),
            practice: int(fields[`practice${n}`]) ?? 0, rank: int(fields[`rank${n}`]) ?? 0,
            hidden: ['rank', 'practice', 'stat', 'type'].filter(part => hidden.has(`${part}${n}`)),
        });
    }
    return out;
}

/** The slots of a v1 Foes block (six): `{ slot, local, module, name, count, level, tier, filled, v1, hurt, hidden }`; `hurt` is 1 for a filled slot, else 0 (the fight keeps each foe's HP). */
export function foesV1(id, fields, offset = 0, hidden = new Set()) {
    return [1, 2, 3, 4, 5, 6].filter(n => Object.hasOwn(fields, `foe${n}`)).map(n => {
        const name = hidden.has(`foe${n}`) ? (text(fields[`foe${n}`]) ? `Foe ${offset + n}` : '') : text(fields[`foe${n}`]);
        const count = int(fields[`count${n}`]) ?? 0, tier = text(fields[`tier${n}`]).toLowerCase();
        return { slot: offset + n, local: n, module: id, name, count, level: held(fields[`level${n}`], LEVEL.min, LEVEL.max, 1), tier,
            filled: Boolean(name && count > 0), v1: true, hurt: name && count > 0 ? 1 : 0, hidden: ['count', 'level', 'tier'].filter(part => hidden.has(`${part}${n}`)) };
    });
}
