// The lines for a reply's receipts: companions who joined or left, the XP a won fight gave, and the practice the rolls earned.

import { CHECK_STEP, FIGHT, PRACTICE_STEP, RANK_NAMES, STATS_ANY as STATS, USES } from '../../index.js';
import { RPG_STRINGS, fill } from '../../strings.js';
import { isRecord, list, words, line } from './shared-line.js';

const C = RPG_STRINGS.changes;

/**
 * Companions who joined or left on this reply (a `+ party` or `- party` line, or the reader's Add to party), from the reply's own receipts
 * (`data.join`, join.js): a swipe or a delete takes the receipt and so the line away, and a block the replay skipped is not told.
 */
export function partyLines(record, problems = []) {
    const skipped = new Set(list(problems).flatMap(problem => list(problem?.receipts)));
    const out = [];
    for (const receipt of list(record?.receipts)) {
        const join = receipt?.data?.join;
        if (!isRecord(join) || skipped.has(receipt.id)) continue;
        const who = words(join.name);
        if (!who) continue;
        // (the signature skills the join seeded, as its receipt recorded them: one tile each, shown from the receipt and never worked out from the pack)
        const seeded = list(receipt.data?.sigSkills).filter(skill => isRecord(skill) && words(skill.name));
        const skillTiles = () => seeded.map(skill => line({ icon: 'fa-book-open', tone: 'good', text: words(skill.name),
            flag: fill(C.skillSignature, { rank: RANK_NAMES[skill.rank] ?? RANK_NAMES[0] }),
            note: fill(C.skillStatUses, { stat: STATS.includes(skill.stat) ? skill.stat.toUpperCase() : '', uses: USES.includes(skill.uses) ? skill.uses.charAt(0).toUpperCase() + skill.uses.slice(1) : '' }) }));
        const summary = (plain, many) => (seeded.length ? fill(seeded.length === 1 ? C.joinedSkillOne : many, { who, n: seeded.length }) : plain);
        if (join.op === 'added') out.push(line({ icon: 'fa-user-plus', tone: 'good', text: fill(C.joined, { who }), summary: summary(fill(C.joinedSummary, { who }), C.joinedSkillsSummary), note: C.joinedNote }), ...skillTiles());
        else if (join.op === 'back') out.push(line({ icon: 'fa-user-plus', tone: 'good', text: fill(C.returned, { who }), summary: summary(fill(C.joinedSummary, { who }), C.returnedSkillsSummary) }), ...skillTiles());
        else if (join.op === 'left') out.push(line({ icon: 'fa-user-minus', tone: 'info', text: fill(C.left, { who }), summary: fill(C.leftSummary, { who }), note: C.leftNote }));
    }
    return out;
}

/**
 * The XP code gave for a fight this reply won (fight.js), one line each: "Astra +12 XP (fight won)", from the step's own receipt
 * (`data.v2.result.fight`): a swipe or a delete takes the receipt and so the line away, and a step the replay skipped is not told.
 */
export function fightLines(record, problems = []) {
    const skipped = new Set(list(problems).flatMap(problem => list(problem?.receipts)));
    const out = [];
    for (const receipt of list(record?.receipts)) {
        if (receipt?.type !== FIGHT || skipped.has(receipt.id)) continue;
        const fight = receipt.data?.v2?.result?.fight;
        const bonus = fight?.outnumbered === 1 && [1.5, 2].includes(fight.multiplier) ? ` · ${fill(C.fightXpBonus, { multiplier: fight.multiplier })}` : '';
        for (const award of list(fight?.awards)) {
            const who = words(award?.who);
            if (!who || !Number.isSafeInteger(award.xp) || award.xp <= 0) continue;
            out.push(line({ icon: 'fa-trophy', tone: 'good', text: fill(C.fightXp, { who, xp: award.xp }) + bonus, summary: fill(C.fightXpSummary, { who, xp: award.xp }) + bonus, note: C.fightXpNote }));
        }
    }
    return out;
}

/**
 * The practice code gave for the skills this reply's rolls used (practice.js), one line each: "Astra's Shadow Cut +6 practice (rolled)", from the
 * step's own receipt (`data.v2.result.practice.skills`; a story check's `rpg.check` step carries its practice the same way): a swipe or a delete takes the
 * receipt and so the line away, and a step the replay skipped is not told.
 */
export function practiceLines(record, problems = []) {
    const skipped = new Set(list(problems).flatMap(problem => list(problem?.receipts)));
    const out = [];
    for (const receipt of list(record?.receipts)) {
        if ((receipt?.type !== PRACTICE_STEP && receipt?.type !== CHECK_STEP) || skipped.has(receipt.id)) continue;
        for (const entry of list(receipt.data?.v2?.result?.practice?.skills)) {
            const who = words(entry?.who), skill = words(entry?.skill);
            if (!who || !skill || !Number.isSafeInteger(entry.amount) || entry.amount <= 0) continue;
            out.push(line({ icon: 'fa-dumbbell', tone: 'good', text: fill(C.practice, { who, skill, amount: entry.amount }), summary: fill(C.practiceSummary, { who, skill, amount: entry.amount }), note: C.practiceNote }));
        }
    }
    return out;
}
