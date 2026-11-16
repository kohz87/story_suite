// The odds shown for the reader's own character, and what they call the Soul Class.

import { CLASS_NAMES, RANK_NAMES } from '../../names.js';
import { hardFightFor } from '../../board/flags.js';
import { DIFFICULTIES, hasLevels, STANDARD_PRESETS, oddsSubject, presetOf, subjectOdds } from '../../rules.js';
import { applyGear } from '../../gear.js';
import { fold, readSheet } from '../../read.js';
import { RPG_STRINGS, fill } from '../../strings.js';
import { SOUL_LABEL, soulShortOf } from '../../soul.js';

const S = RPG_STRINGS.settings;

/**
 * The odds shown: `{ label, now: { success, cost, fail }, compare: [{ name, success, cost, fail }] }` for the reader's own
 * character (`own`, else the first Character block; their best skill) against a foe of their Soul Class, under `rules`, and the
 * same fight under each preset the reader has not chosen (all three for Custom). Null while the story has no character.
 */
export function oddsView(state, own, rules, gear = null) {
    // (With gear in fights on, the odds are for the stats the character rolls with: gear.js.)
    const sheet = applyGear(readSheet(state), gear);
    const subject = oddsSubject(sheet, own, { rankNames: RANK_NAMES, soulNames: CLASS_NAMES, fold, standard: true });
    if (!subject) return null;
    // (the foe's level ÷ 4 of the harder-foes rule when a fight on this sheet would play it, foes.js hardFightFor)
    subject.hard = hardFightFor(sheet);
    const words = { who: subject.who, stat: subject.stat.toUpperCase(), value: subject.statValue, dex: subject.stats?.dex ?? '?', soul: subject.soulName, rank: subject.rankName, label: soulLabelOfSheet(sheet, own), short: soulShortOf(soulLabelOfSheet(sheet, own), 'Class') };
    const chosen = presetOf(rules), presets = STANDARD_PRESETS;
    const text = subject.skill ? S.oddsForStandard : S.oddsForStandardUntrained;
    return {
        label: fill(text, words),
        now: pick(subjectOdds(rules, subject)),
        compare: DIFFICULTIES.slice(0, 3).filter(name => name !== chosen).map(name => ({ name, ...pick(subjectOdds(hasLevels(rules) ? { ...presets[name], levelDivisor: rules.levelDivisor } : presets[name], subject)) })),
    };
}

/** What the reader's own character calls the Soul Class (their name's Character block, else the first), else "Soul Class". */
export function soulLabelFor(state, own) {
    return soulLabelOfSheet(readSheet(state), own);
}
const soulLabelOfSheet = (sheet, own) => {
    const characters = sheet?.characters ?? [];
    const mine = own ? characters.find(entry => fold(entry.who) === fold(own)) : null;
    return (mine ?? characters[0])?.soulLabel ?? SOUL_LABEL;
};

const pick = ({ success, cost, fail }) => ({ success, cost, fail });
