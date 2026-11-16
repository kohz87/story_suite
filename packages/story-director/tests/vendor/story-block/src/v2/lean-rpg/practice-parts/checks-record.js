// Reads a check step's recorded input and the story-check results a reply's receipts hold.
import { CHECK_STEP, PRACTICE } from '../names.js';
import { diceOf, tableOf } from '../checks/dice.js';
import { isObject } from './shared-values.js';
import { CHECK_LINES } from './shared-limits.js';

const OUTCOMES = ['success', 'cost', 'fail'];

const keptNumber = value => Number.isSafeInteger(value);
const keptText = value => typeof value === 'string' && value.length > 0 && [...value].length <= 80;

// One recorded result, checked: the same plain record workChecks makes, or null.
function resultFrom(entry) {
    if (!isObject(entry) || !['who', 'what', 'stat', 'rankName', 'difficulty'].every(key => keptText(entry[key])) || !OUTCOMES.includes(entry.outcome)) return null;
    if (!['rank', 'dc', 'die', 'bonus', 'total'].every(key => keptNumber(entry[key]))) return null;
    const unlisted = entry.unlisted === 'member' || entry.unlisted === 'skill' ? { unlisted: entry.unlisted } : {};
    const practice = isObject(entry.practice) && keptText(entry.practice.skill) && entry.practice.n === 1 && keptNumber(entry.practiceGained) ? { practice: { skill: entry.practice.skill, n: 1 }, practiceGained: entry.practiceGained } : {};
    return { who: entry.who, what: entry.what, stat: entry.stat, utility: entry.utility === true, rank: entry.rank, rankName: entry.rankName, difficulty: entry.difficulty, dc: entry.dc, die: entry.die,
        bonus: entry.bonus, total: entry.total, outcome: entry.outcome, decisive: entry.decisive === true, ...unlisted, ...practice };
}

// The step's input as recorded: { lines, dice, inOrder? } (the narrator's lines, and the dice, rules and practice recorded with the reply; `inOrder`: the reply was marked `diceInOrder`; dice null: none was offered), or null.
export function inputOf(payload) {
    const lines = payload?.lines;
    if (!Array.isArray(lines) || lines.length > CHECK_LINES || !lines.every(line => typeof line === 'string' && line.length > 0 && line.length <= 200)) return null;
    const dice = payload.dice === null ? null : diceOf(payload.dice);
    if (payload.dice !== null && !dice) return null;
    if (payload.table !== undefined && (!Array.isArray(payload.table) || !dice)) return null;
    if (payload.spent !== undefined && (!Array.isArray(payload.spent) || payload.spent.length > 1024 || !payload.spent.every(entry => isObject(entry) && keptText(entry.who) && keptText(entry.skill) && Number.isSafeInteger(entry.amount) && entry.amount >= 1 && entry.amount <= PRACTICE.max))) return null;
    return { lines: [...lines], dice, ...(payload.practice === true ? { practice: true } : {}), ...(payload.inOrder === true ? { inOrder: true } : {}), ...(payload.table ? { table: tableOf(payload.table) } : {}), ...(payload.spent ? { spent: payload.spent.map(({ who, skill, amount }) => ({ who, skill, amount })) } : {}) };
}

/** The story-check results a reply's receipts hold, excluding blocks that replay skipped. */
export function checksOf(receipts, problems = []) {
    const skipped = new Set((Array.isArray(problems) ? problems : []).flatMap(problem => Array.isArray(problem?.receipts) ? problem.receipts : []));
    const found = (Array.isArray(receipts) ? receipts : []).findLast(receipt => receipt?.type === CHECK_STEP && !skipped.has(receipt.id) && receipt.data?.v2?.checks?.v === 1 && Array.isArray(receipt.data.v2.checks.results));
    return found ? found.data.v2.checks.results.map(resultFrom).filter(Boolean) : [];
}
