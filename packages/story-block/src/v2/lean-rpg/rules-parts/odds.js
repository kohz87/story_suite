// The exact odds of a roll under a set of numbers, and the subject (a character) the odds are shown for.
import { FORMULA } from '../names.js';
import { FOE_LEVEL } from '../foes.js';
import { foeBonus, levelBonus, levelOfClass, statPart } from '../formula.js';
import { hasLevels } from './levels.js';
import { normalizeRules } from './normalize.js';

// What a foe of `foeClass` (its level, under levelled numbers) adds to its die.
const foeSide = (r, foeClass, hard = false) => (hasLevels(r) ? r.foeBase + levelBonus(foeClass, hard ? FOE_LEVEL.hardDivisor : r.levelDivisor) : foeBonus(foeClass, r));

/**
 * The exact chances of one roll under `rules`: the party member's d20 + `bonus` against a foe's d20 + the foe's base + the
 * Soul Class weight × `foeClass`, the outcome rule of resolve.js (a natural 20 succeeds, a natural 1 fails, a total that
 * reaches the foe's succeeds, one within `costMargin` short is a success at a cost). Counts all 400 pairs of dice.
 * `hard`: the harder-foes rule, where the foe adds level / 4 (board/flags.js hardFightFor); only levelled numbers read it.
 * → { success, cost, fail }, whole percentages each rounded on its own (they may add up to 99 or 101).
 */
export function oddsFor(rules, { bonus, foeClass, hard = false }) {
    const r = normalizeRules(rules), die = FORMULA.die;
    let success = 0, cost = 0, fail = 0;
    for (let mine = 1; mine <= die; mine += 1) {
        for (let theirs = 1; theirs <= die; theirs += 1) {
            const total = mine + bonus, against = theirs + foeSide(r, foeClass, hard);
            if (mine === die || (mine !== 1 && total >= against)) success += 1;
            else if (mine !== 1 && total >= against - r.costMargin) cost += 1;
            else fail += 1;
        }
    }
    const percent = count => Math.round((count * 100) / (die * die));
    return { success: percent(success), cost: percent(cost), fail: percent(fail) };
}

/**
 * Who the odds are shown for: the reader's own character (by name, else the first Character block), the skill they are best
 * at (highest rank, the first on a tie; none: their best stat untrained), against a foe of their own Soul Class.
 * `sheet` is readSheet's answer, `own` the reader's name, `names` = { rank: [...], soul: [...] } the words for ranks and classes; `standard`
 * adds the character's stats and the skill's resource, which the Standard formula needs.
 * → null (no character), else { who, label, stat, statValue, soul, rank, rankName, soulName (the Character block's own word for it), skill, bonus (under `rules`), foeClass }.
 */
export function oddsSubject(sheet, own, { rankNames, soulNames, fold, standard = false }) {
    const characters = sheet?.characters ?? [];
    const mine = own ? characters.find(entry => fold(entry.who) === fold(own)) : null;
    const who = mine ?? characters[0];
    if (!who) return null;
    const best = who.skills.reduce((top, skill) => (!top || skill.rank > top.rank ? skill : top), null);
    const strongest = Object.entries(who.stats).filter(([, value]) => Number.isInteger(value)).reduce((top, entry) => (!top || entry[1] > top[1] ? entry : top), null);
    // (Standard: a skill with no stat of its own, or no skill, rolls the type's own: INT for a mana skill, else STR.)
    const fallback = standard ? (best?.uses === 'mana' ? 'int' : 'str') : strongest?.[0] ?? null;
    const stat = best?.stat && Number.isInteger(who.stats[best.stat]) ? best.stat : fallback;
    if (!stat || !Number.isInteger(who.stats[stat])) return null;
    const rank = best?.rank ?? 0;
    return {
        who: who.who, stat, statValue: who.stats[stat], soul: who.soul, level: who.level ?? levelOfClass(who.soul), rank, skill: best?.name ?? null, foeClass: who.soul, foeLevel: who.level ?? levelOfClass(who.soul),
        ...(standard ? { stats: who.stats, uses: best?.uses ?? null } : {}),
        rankName: best ? rankNames[rank] ?? String(rank) : '', soulName: who.soulWord ?? soulNames[who.soul - 1] ?? String(who.soul),
    };
}

/** The bonus the subject rolls with under `rules` (the stat's share, the Soul Class and the skill rank), and the odds against a foe of their class. */
export function subjectOdds(rules, subject) {
    const r = normalizeRules(rules);
    // Standard: the skill's stat in the main slot with half of DEX (a stamina skill is physical, a mana skill magic), halved.
    const stat = statPart(subject.uses === 'mana' ? 'magic' : 'physical', subject.stats ?? { [subject.stat]: subject.statValue }, { skillStat: subject.stat }).value;
    const levels = hasLevels(r);
    const bonus = stat + (levels ? levelBonus(subject.level, r.levelDivisor) : r.classWeight * subject.soul) + subject.rank;
    return { bonus, ...oddsFor(r, { bonus, foeClass: levels ? subject.foeLevel : subject.foeClass, hard: subject.hard === true }) };
}
