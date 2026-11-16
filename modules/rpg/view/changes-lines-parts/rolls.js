// What the reply's `rpg.resolve` receipt says it rolled ("3 exchanges", who against whom) and the rules numbers it was rolled with.

import { RESOLVE } from '../../index.js';
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
        if (receipt?.type !== RESOLVE || skipped.has(receipt.id)) continue;
        const result = receipt.data?.v2?.result;
        if (!isRecord(result)) continue;
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
        if (receipt?.type !== RESOLVE || skipped.has(receipt.id)) continue;
        const result = receipt.data?.v2?.result;
        if (isRecord(result)) return result.rules === undefined ? STANDARD : normalizeRules(result.rules);
    }
    return null;
}
