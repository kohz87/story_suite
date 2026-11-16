// The lines for what a settled Combat Rules v1 fight paid, from the fight receipt's own record (`data.v2.result.paid`, board/v1-award.js): "Astra +12 XP (fight won)" and "Astra's Shadow Cut +6 practice (rolled)".
// The same words as the old fight's lines; a swipe or a delete takes the receipt and so the lines away, and a settle the replay skipped is not told.
import { fightResults } from '../../board/results.js';
import { RPG_STRINGS, fill } from '../../strings.js';
import { isRecord, list, words, line } from './shared-line.js';

const C = RPG_STRINGS.changes;

/** The XP and practice lines of the v1 fights among `record`'s receipts (in order: each fight's XP, then its practice). */
export function v1PaidLines(record, problems = []) {
    const skipped = new Set(list(problems).flatMap(problem => list(problem?.receipts)));
    return fightResults(record?.receipts).filter(({ receipt, result }) => !skipped.has(receipt.id) && result.board?.v1 === 1 && isRecord(result.paid)).flatMap(({ result }) => [
        ...list(result.paid.xp).flatMap(entry => {
            const who = words(entry?.who);
            return who && Number.isSafeInteger(entry.xp) && entry.xp > 0 ? [line({ icon: 'fa-trophy', tone: 'good', text: fill(C.fightXp, { who, xp: entry.xp }), summary: fill(C.fightXpSummary, { who, xp: entry.xp }), note: C.fightXpNote })] : [];
        }),
        ...list(result.paid.practice).flatMap(entry => {
            const who = words(entry?.who), skill = words(entry?.skill);
            return who && skill && Number.isSafeInteger(entry.amount) && entry.amount > 0 ? [line({ icon: 'fa-dumbbell', tone: 'good', text: fill(C.practice, { who, skill, amount: entry.amount }), summary: fill(C.practiceSummary, { who, skill, amount: entry.amount }), note: C.practiceNote })] : [];
        }),
    ]);
}
