// The foe pre-check's part that talks to the world (precheck.js is the pure reading): when a typed attack finds no foe standing, ask the Assist
// profile once (20 s at most) for the groups, hold them to the Foes rules. The groups are recorded with the fight's opening, so replay, Re-read and rebuild never ask a model again.
// A timeout, an error, an unreadable answer or no group gives nothing: the send goes on as it does without the pre-check.
import { withTimeout } from '../../assist/common.js';
import { PRECHECK_LIMIT_MS, PRECHECK_SETTING } from '../names.js';
import { bestiaryOf, knownLines, rankScale } from './precheck-known.js';
import { statedLevel } from './stated-level.js';
import { looksLikeAttack, parsePrecheck, precheckPrompt, vetGroups } from './precheck.js';

const ANSWER_TOKENS = 300;

/** Whether this message should be pre-checked at all: the setting, a typed attack, a standing foe or not. */
export const wantsPrecheck = (values, sheet, message) => values?.[PRECHECK_SETTING] !== false && sheet.characters.length > 0
    && !sheet.foes.some(foe => foe.filled && foe.hurt > 0) && looksLikeAttack(message);

/**
 * One Assist call → the vetted groups `[{ name, count, level? }]`, or [] (timeout, failure, nothing readable).
 * `callModel(prompt, { maxTokens, role, helper, timeoutMs })` is the host's queued Assist call; `query(name, args)` reads the rank scale and the dossiers (optional).
 */
export async function runPrecheck({ callModel, message, previous = '', sheet, values = {}, limit = PRECHECK_LIMIT_MS, timer, query = null }) {
    if (typeof callModel !== 'function') return [];
    try {
        const v1 = sheet.characters.some(character => character.v1 === true);
        const prompt = precheckPrompt({ message, previous, sheet, ranks: rankScale(query), known: knownLines(query, message, previous), v1 });
        const answer = await withTimeout(() => callModel(prompt, { maxTokens: ANSWER_TOKENS, role: 'quick', helper: 'precheck', timeoutMs: limit }), limit, timer);
        return vetGroups(parsePrecheck(answer), { message, previous, sheet, stated: name => statedLevel(query, name), bestiary: bestiaryOf(query), v1 });
    } catch { return []; }
}
