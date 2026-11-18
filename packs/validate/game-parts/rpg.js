// The job: checking a game pack's `content.rpg` (the format 3 checks, plus `pull`, and the player rank's module inside the same pack).

import { GAME_RPG_FIELDS, RPG_PULL_FIELDS, RPG_PULL_LIMITS } from '../../limits.js';
import { isObject } from '../core.js';
import { checkRpg } from '../items.js';

/**
 * Skill sets, formula, ranks and level cap are checked as before (checkRpg). `pull: { abilities?: 1 to 6, stance?: true | false }` tunes how a person's
 * NPC State record becomes a sheet; it is kept as one more record, `{ id, slug: 'pull', pack, abilities?, stance? }`. `playerRank.module` must name a data
 * module of this same pack (`moduleSlugs`): a game pack cannot rely on another one being installed. → the list of records.
 */
export function checkGameRpg(value, { packId, moduleSlugs, add, warn }) {
    if (!isObject(value)) return checkRpg(value, packId, add, warn);
    const { pull, ...rest } = value;
    for (const key of Object.keys(rest)) if (!GAME_RPG_FIELDS.includes(key)) add('UNKNOWN_FIELD', `content.rpg.${key}`, `"${key}" is not a content.rpg field (expected ${GAME_RPG_FIELDS.join(', ')}).`);
    const records = checkRpg(Object.fromEntries(Object.entries(rest).filter(([key]) => GAME_RPG_FIELDS.includes(key))), packId, add, warn);
    const module = records.find(record => record.slug === 'ranks')?.playerRank?.module;
    if (module !== undefined && !moduleSlugs.includes(module.replace(`pack.${packId}/`, ''))) {
        add('UNKNOWN_REF', 'content.rpg.playerRank.module', `playerRank.module "${module}" is not a data module of this pack (content.dataModules): a game pack's rank comes from its own modules.`);
    }
    if (pull === undefined) return records;
    const at = 'content.rpg.pull';
    const { min, max } = RPG_PULL_LIMITS;
    let ok = true;
    const bad = (path, message) => { ok = false; add('BAD_CONTENT', path, message); };
    if (!isObject(pull)) bad(at, 'content.rpg.pull must be { "abilities": 4, "stance": true }.');
    else {
        for (const key of Object.keys(pull)) if (!RPG_PULL_FIELDS.includes(key)) { ok = false; add('UNKNOWN_FIELD', `${at}.${key}`, `"${key}" is not a pull field (expected ${RPG_PULL_FIELDS.join(', ')}).`); }
        if (pull.abilities !== undefined && (!Number.isInteger(pull.abilities) || pull.abilities < min || pull.abilities > max)) bad(`${at}.abilities`, `pull.abilities must be a whole number from ${min} to ${max}.`);
        if (pull.stance !== undefined && typeof pull.stance !== 'boolean') bad(`${at}.stance`, 'pull.stance must be true or false.');
    }
    return ok ? [...records, { id: `${packId}/pull`, slug: 'pull', pack: packId, ...(pull.abilities !== undefined ? { abilities: pull.abilities } : {}), ...(pull.stance !== undefined ? { stance: pull.stance } : {}) }] : records;
}
