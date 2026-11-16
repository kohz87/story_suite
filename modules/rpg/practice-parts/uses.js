// Reads which skills a reply's roll record used, and finds the roll that carries a practice per use.
import { RESOLVE, practiceOf } from '../names.js';
import { fold } from '../read.js';
import { isObject, text } from './shared-values.js';

/**
 * The skills a roll record used: [{ who, skill, n }] in a fixed order (character, then skill). A line counts when it names a skill (an untrained
 * roll names none); an area attack, which is one line per foe it hits, counts once for a round. `result`: `data.v2.result` of an `rpg.resolve` receipt.
 */
export function usesOf(result) {
    const count = new Map();
    const note = (line, area) => {
        const skill = text(line?.skill), who = text(line?.pc?.who);
        if (!skill || !who) return;
        const key = `${fold(who)}\u0000${fold(skill)}`;
        const found = count.get(key) ?? { who, skill, n: 0, rounds: new Set() };
        if (area === undefined) found.n += 1;
        else if (!found.rounds.has(area)) { found.rounds.add(area); found.n += 1; }
        count.set(key, found);
    };
    const lines = (list, round) => { for (const line of Array.isArray(list) ? list : []) note(line, line?.area === true ? round : undefined); };
    lines(result?.checks, 'checks');
    lines(result?.opening, 'opening');
    (Array.isArray(result?.rounds) ? result.rounds : []).forEach((round, at) => lines(round?.lines, `r${at}`));
    return [...count.values()].sort((a, b) => fold(a.who).localeCompare(fold(b.who)) || fold(a.skill).localeCompare(fold(b.skill))).map(({ who, skill, n }) => ({ who, skill, n }));
}

/** The reply's roll that carries a practice per use: the last `rpg.resolve` receipt among `receipts`, its result, else null. */
export function rollOf(receipts) {
    const found = (Array.isArray(receipts) ? receipts : []).findLast(receipt => receipt?.type === RESOLVE && isObject(receipt.data?.v2?.result) && receipt.data.v2.result.v === 1);
    return found && practiceOf(found.data.v2.result.practice) !== null ? found.data.v2.result : null;
}
