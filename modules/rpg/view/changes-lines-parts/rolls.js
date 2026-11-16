// What the reply's `rpg.resolve` receipt says it rolled ("3 exchanges", who against whom) and the rules numbers it was rolled with.

import { isRollReceipt } from '../../board/results.js';
import { STANDARD, normalizeRules } from '../../rules.js';
import { isRecord, list, words } from './shared-line.js';

/**
 * What the reply's `rpg.resolve` receipt says it rolled: `{ exchanges, pairs }` ("Wessel vs Sluice Rat A") or null.
 * The rolls piece's summary is `result.summary = { exchanges, acts: [{ kind, who, target, … }] }` (`exchanges` = rounds told); a record
 * without it is counted by its rounds.
 */
export function exchangesOf(record, problems = []) {
    const skipped = new Set(list(problems).flatMap(problem => list(problem?.receipts)));
    for (const receipt of list(record?.receipts)) {
        if (!isRollReceipt(receipt) || skipped.has(receipt.id)) continue;
        const result = receipt.data?.v2?.result;
        if (!isRecord(result)) continue;
        // A Combat Rules v1 fight (`board.v1`): its rounds are lists of rows ('attack', who, how, target, …); the exchanges are the ones THIS settle played, the pairs the heroes' blows.
        if (isRecord(result.board) && result.board.v1 === 1) {
            const played = list(result.rounds).length, pairs = [];
            for (const row of list(result.rounds).flat()) {
                const pair = Array.isArray(row) && row[0] === 'attack' && words(row[1]) && words(row[3]) ? `${words(row[1])} vs ${words(row[3])}` : '';
                if (pair && !pairs.includes(pair)) pairs.push(pair);
            }
            if (played > 0) return { exchanges: played, pairs };
            continue;
        }
        const summary = isRecord(result.summary) ? result.summary : result;
        const rounds = list(result.rounds);
        const exchanges = Number.isSafeInteger(summary.exchanges) ? summary.exchanges : rounds.length;
        if (!(exchanges > 0)) continue;
        const acts = list(summary.acts);
        const pairs = [];
        for (const act of acts) {
            if (!isRecord(act) || act.kind !== 'act') continue;
            const who = words(act.who), target = words(act.target);
            const pair = who && target ? `${who} vs ${target}` : '';
            if (pair && !pairs.includes(pair)) pairs.push(pair);
        }
        return { exchanges, pairs };
    }
    return null;
}

/**
 * The numbers the reply's own roll was made with (`result.rules`, recorded with it), else null when the reply has no roll. A roll
 * recorded before the numbers were kept was made with Standard's. A display for that reply uses these, never today's settings.
 */
export function rulesOfReply(record, problems = []) {
    const skipped = new Set(list(problems).flatMap(problem => list(problem?.receipts)));
    for (const receipt of list(record?.receipts)) {
        if (!isRollReceipt(receipt) || skipped.has(receipt.id)) continue;
        const result = receipt.data?.v2?.result;
        if (isRecord(result)) return result.rules === undefined ? STANDARD : normalizeRules(result.rules);
    }
    return null;
}
