// Checking the player's starting record and the RPG settings with its level ranks.

import { YOU_FIELDS, YOU_RANK_FIELDS, YOU_RANK_LABEL_MAX, LEAN_RPG_FIELDS, LEAN_RPG_LIMITS, RPG_FORMULAS, RPG_NUMBER_KEYS, RPG_RANK_LIMITS, RPG_RANK_FIELDS, RPG_PLAYER_RANK_LIMITS, RPG_PLAYER_RANK_FIELDS } from '../../limits.js';
import { oneLine, foldKey } from '../../../../../../../core/text.js';
import { isObject, records } from '../core.js';
import { checkSkillSet } from './skill-sets.js';

// Your look (`content.you`, MODULES §F126): `{ "rank": { "label": "Guild rank" } }` makes a Rank part of {{user}}'s look in a story
// that uses this pack. The label is plain text of 1 to 30 characters that goes into the narrator's instructions, so no markup
// or macro; unknown keys are refused like any other content.
export function checkYou(value, add) {
    if (!isObject(value)) { add('BAD_CONTENT', 'content.you', 'content.you must be an object: { "rank": { "label": "Guild rank" } }.'); return null; }
    let ok = true;
    for (const key of Object.keys(value)) if (!YOU_FIELDS.includes(key)) { ok = false; add('UNKNOWN_FIELD', `content.you.${key}`, `"${key}" is not a content.you field (expected ${YOU_FIELDS.join(', ')}).`); }
    const rank = value.rank;
    if (rank === undefined) return ok ? {} : null;
    if (!isObject(rank)) { add('BAD_CONTENT', 'content.you.rank', 'content.you.rank must be an object: { "label": "Guild rank" }.'); return null; }
    for (const key of Object.keys(rank)) if (!YOU_RANK_FIELDS.includes(key)) { ok = false; add('UNKNOWN_FIELD', `content.you.rank.${key}`, `"${key}" is not a content.you.rank field (expected ${YOU_RANK_FIELDS.join(', ')}).`); }
    const label = typeof rank.label === 'string' ? oneLine(rank.label) : '';
    if (!label || label.length > YOU_RANK_LABEL_MAX || /[<>{}]/.test(label)) {
        add('BAD_CONTENT', 'content.you.rank.label', `content.you.rank.label must be plain text of 1 to ${YOU_RANK_LABEL_MAX} characters (no < > { }), such as "Guild rank".`);
        return null;
    }
    return ok ? { rank: { label } } : null;
}

// The RPG's skill sets (`content.rpg.skillSets`): ready-made skills the New character wizard offers, each with what the
// skill does, the stat it rolls with and what it uses (stamina unless it says mana). A set is 1 to 5 skills; a pack has up to 12 sets.
// Normalized to the list of sets, each `{ id, slug, pack, name, about, skills: [{ name, about, stat, uses }] }`.
export function checkRpg(value, packId, add) {
    if (!isObject(value)) { add('BAD_CONTENT', 'content.rpg', 'content.rpg must be an object: { "skillSets": [ … ] }.'); return []; }
    for (const key of Object.keys(value)) if (!LEAN_RPG_FIELDS.includes(key)) add('UNKNOWN_FIELD', `content.rpg.${key}`, `"${key}" is not a content.rpg field (expected ${LEAN_RPG_FIELDS.join(', ')}).`);
    if (Array.isArray(value.skillSets) && value.skillSets.length > LEAN_RPG_LIMITS.sets) {
        add('BAD_CONTENT', 'content.rpg.skillSets', `content.rpg.skillSets holds at most ${LEAN_RPG_LIMITS.sets} sets.`);
        return [];
    }
    const sets = records(value.skillSets, 'rpg.skillSets', { add, packId, check: (record, path, label) => checkSkillSet(record, path, label, add) });
    // The stat formula and its numbers (optional): one more record of the list, after the skill sets.
    const formula = value.formula, numbers = value.numbers;
    const levels = checkLevelRanks(value, packId, add);
    if (formula === undefined && numbers === undefined) return levels ? [...sets, levels] : sets;
    let ok = true;
    if (formula === 'classic') { ok = false; add('BAD_CONTENT', 'content.rpg.formula', 'content.rpg.formula "classic" is no longer supported: Classic rules were removed. Use "standard" or leave the formula out.'); }
    else if (formula !== undefined && !RPG_FORMULAS.includes(formula)) { ok = false; add('BAD_CONTENT', 'content.rpg.formula', `content.rpg.formula must be one of ${RPG_FORMULAS.join(', ')}.`); }
    const given = {};
    if (numbers !== undefined) {
        if (!isObject(numbers)) { ok = false; add('BAD_CONTENT', 'content.rpg.numbers', 'content.rpg.numbers must be an object of whole numbers, like { "foeBase": 5 }.'); } else {
            for (const [key, number] of Object.entries(numbers)) {
                if (!RPG_NUMBER_KEYS.includes(key)) { ok = false; add('UNKNOWN_FIELD', `content.rpg.numbers.${key}`, `"${key}" is not an RPG number (expected ${RPG_NUMBER_KEYS.join(', ')}).`); } else if (!Number.isSafeInteger(number)) { ok = false; add('BAD_CONTENT', `content.rpg.numbers.${key}`, `content.rpg.numbers.${key} must be a whole number.`); } else given[key] = number;
            }
        }
    }
    return [...sets, ...(ok ? [{ id: `${packId}/formula`, slug: 'formula', pack: packId, ...(formula !== undefined ? { formula } : {}), ...(Object.keys(given).length ? { numbers: given } : {}) }] : []), ...(levels ? [levels] : [])];
}

// The level ranks (`content.rpg.ranks`: names for bands of levels, `[{ name, from, to }]`) and the level cap (`content.rpg.levelCap`, 1..99). The bands run
// on from level 1 with no gap or overlap (each `from` is the one after the last `to`), up to 99 at most; a name is plain text of 1 to 12 characters and
// is not repeated; up to 20 bands. → one record `{ id, slug: 'ranks', pack, ranks?, levelCap? }`, or null when nothing valid is given (the problems are said).
function checkLevelRanks(value, packId, add) {
    const L = RPG_RANK_LIMITS;
    const { ranks, levelCap, playerRank } = value;
    if (ranks === undefined && levelCap === undefined && playerRank === undefined) return null;
    let ok = true;
    const bad = (path, message) => { ok = false; add('BAD_CONTENT', `content.rpg.${path}`, message); };
    const out = [];
    if (ranks !== undefined) {
        if (!Array.isArray(ranks) || !ranks.length) bad('ranks', 'content.rpg.ranks must be a list of bands: [{ "name": "F", "from": 1, "to": 9 }, …].');
        else if (ranks.length > L.entries) bad('ranks', `content.rpg.ranks holds at most ${L.entries} bands.`);
        else ranks.forEach((rank, index) => {
            const at = `ranks[${index}]`;
            if (!isObject(rank)) return bad(at, `content.rpg.${at} must be an object: { "name": "F", "from": 1, "to": 9 }.`);
            for (const key of Object.keys(rank)) if (!RPG_RANK_FIELDS.includes(key)) { ok = false; add('UNKNOWN_FIELD', `content.rpg.${at}.${key}`, `"${key}" is not a rank field (expected ${RPG_RANK_FIELDS.join(', ')}).`); }
            const name = typeof rank.name === 'string' ? oneLine(rank.name) : '';
            if (!name || name.length > L.name || /[<>{}]/.test(name)) bad(`${at}.name`, `content.rpg.${at}.name must be plain text of 1 to ${L.name} characters (no < > { }).`);
            else if (out.some(other => foldKey(other.name) === foldKey(name))) { ok = false; add('DUPLICATE', `content.rpg.${at}.name`, `content.rpg.${at}.name repeats "${name}"; a rank is named once.`); }
            const { from, to } = rank;
            if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 1 || to > L.maxLevel || to < from) return bad(at, `content.rpg.${at} needs whole levels 1 to ${L.maxLevel} with "from" not above "to".`);
            const next = out.length ? out[out.length - 1].to + 1 : 1;
            if (from !== next) return bad(`${at}.from`, `content.rpg.${at}.from must be ${next}: ranks run on from level 1 in order, with no gap and no overlap.`);
            if (name && name.length <= L.name) out.push({ name, from, to });
        });
    }
    let cap;
    if (levelCap !== undefined) {
        if (!Number.isSafeInteger(levelCap) || levelCap < 1 || levelCap > L.maxLevel) bad('levelCap', `content.rpg.levelCap must be a whole number from 1 to ${L.maxLevel}.`);
        else cap = levelCap;
    }
    let player;
    if (playerRank !== undefined) {
        const P = RPG_PLAYER_RANK_LIMITS;
        if (!isObject(playerRank)) bad('playerRank', 'content.rpg.playerRank must be an object: { "module": "guild-membership", "field": "letter", "label": "Guild" }.');
        else {
            for (const key of Object.keys(playerRank)) if (!RPG_PLAYER_RANK_FIELDS.includes(key)) { ok = false; add('UNKNOWN_FIELD', `content.rpg.playerRank.${key}`, `"${key}" is not a playerRank field (expected ${RPG_PLAYER_RANK_FIELDS.join(', ')}).`); }
            const given = {};
            for (const [key, max] of [['module', P.ref], ['field', P.ref], ['label', P.label]]) {
                const text = typeof playerRank[key] === 'string' ? oneLine(playerRank[key]) : '';
                if (!text || text.length > max || /[<>{}]/.test(text)) bad(`playerRank.${key}`, `content.rpg.playerRank.${key} must be plain text of 1 to ${max} characters (no < > { }).`);
                else given[key] = text;
            }
            if (ok) player = given;
        }
    }
    if (!ok) return null;
    return { id: `${packId}/ranks`, slug: 'ranks', pack: packId, ...(out.length ? { ranks: out } : {}), ...(cap !== undefined ? { levelCap: cap } : {}), ...(player ? { playerRank: player } : {}) };
}
