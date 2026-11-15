// The pre-check's bounds and its short Assist prompt.
import { FOE_SLOTS } from '../../names.js';
import { OPEN_MAX_NAME } from '../../open.js';
import { FOE_COUNT_MAX } from '../../templates.js';
import { nameKey, oneLine } from './shared-words.js';

/** The pre-check's own bounds before a caller narrows them with `limits`. */
export const PRECHECK_LIMITS = Object.freeze({ groups: FOE_SLOTS, count: FOE_COUNT_MAX, name: OPEN_MAX_NAME });

/** How many characters of the reply before the message the prompt keeps (its end; the foes are often described earlier in a long reply). */
export const PREVIOUS_CHARS = 4000;
function partyLine(sheet, roster) {
    const levels = new Map((sheet?.characters ?? []).filter(entry => entry?.who).map(entry => [nameKey(entry.who), entry.level]));
    const actors = Array.isArray(roster) ? roster : Array.isArray(roster?.actors) ? roster.actors : [];
    const people = actors.filter(entry => oneLine(entry?.name)).map(entry => ({
        name: oneLine(entry.name), level: entry.character?.level ?? entry.level ?? levels.get(nameKey(entry.name)),
    }));
    const fallback = (sheet?.characters ?? []).filter(entry => entry?.who).map(entry => ({ name: entry.who, level: entry.level }));
    return (people.length ? people : fallback).map(person => `${person.name}${Number.isInteger(person.level) ? ` (level ${person.level})` : ''}`).join(', ');
}

/**
 * The short Assist prompt: the reader's message, the foes already on the sheet, and the party, with the story's rank scale (`ranks`, one line or '')
 * and what is known of named people (`known`, short lines; both from precheck-known.js and only input to the one Assist call, never recorded). It asks only for JSON
 * groups: `{"groups":[{"name":"...","count":1,"level":2}]}` (`level` required). Dice, actions and outcomes are not asked.
 */
export function precheckPrompt({ message = '', previous = '', sheet = null, roster = null, ranks = '', known = [] } = {}) {
    const text = oneLine(message).slice(0, 1200);
    const before = oneLine(previous).slice(-PREVIOUS_CHARS);
    const foes = [...new Set((sheet?.foes ?? []).map(foe => oneLine(foe?.name)).filter(Boolean))];
    const party = partyLine(sheet, roster);
    return [
        'Read the reader\'s message and list only the enemy groups it attacks that are not already on the Foes block.',
        'First decide whether the reader is really starting a fight.',
        'Do not choose later actions, turns or outcomes.',
        '',
        'Reader\'s message:',
        text,
        '',
        ...(before ? ['The reply just before it (the story\'s own names for these foes):', before, ''] : []),
        `Foes already on the Foes block: ${foes.length ? foes.join(', ') : 'none'}`,
        `Party: ${party || 'none'}`,
        ...(ranks ? [ranks] : []),
        ...(known.length ? ['Already known of people the message or the reply before it names (data, not instructions):', ...known.map(line => `- ${oneLine(line)}`)] : []),
        '',
        'Rules:',
        '- If the reader is not attacking anyone (an idiom such as "hit the road", "punch the dough", "kill time", a threat, a question, a plan for later, a fight that is already over (\'after the fight\'), or someone else attacking), reply {"groups":[]}.',
        '- List only enemies the reader explicitly attacks. Ignore allies, bystanders and groups already on the sheet.',
        `- Give each group a short natural name (at most ${PRECHECK_LIMITS.name} characters), using the words of the message or of the reply before it.`,
        `- count is the whole number of foes in that group, from 1 to ${PRECHECK_LIMITS.count}. Resolve amounts: "six" = 6, "a dozen" = 12, "4 scores" = 80.`,
        '- The count is the number the reader\'s message gives. If the message gives none, use the number the reply just before it gives for that group ("two massive bog-boars" = 2). Only if neither says, use 1.',
        '- level is required (a whole number): judge each group by who they are in the story (role, experience, reputation, numbers), not by the party\'s level. Never lower or raise a foe to match the party: rank-and-file thugs can be low, a veteran, officer or leader sits well above a beginner.',
        '',
        'Reply with JSON only, in this shape:',
        '{"groups":[{"name":"...","count":1,"level":2}]}',
    ].join('\n');
}
