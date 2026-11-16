// Detecting open quests that a text says are given up.

import { NOT_BEFORE } from './shared-text.js';

// (0.9.6) The reader's own message (or the reply's narration) saying a job is given up: a
// sentence with one of these and the quest's key, or its giver's name. Only ever a hint: the
// note asks the story to close it, nothing is closed here.
export const GIVE_UP = /\b(?:give up|gave up|giving up|given up|forfeit(?:s|ed|ing)?|abandon(?:s|ed|ing)?|quit(?:s|ting)?|walk(?:s|ed|ing)? away from|back(?:s|ed|ing)? out of|call(?:s|ed|ing)? off|drop(?:s|ped|ping)? the (?:job|bounty|contract|quest|hunt|search))\b/i;

/** The open quests a text says are given up, by key: [key], in tracker order. */
export function givenUpIn(tracker, text) {
    const sentences = String(text ?? '').split(/(?<=[.!?…])\s+|\n+/).filter(Boolean);
    const said = sentences.filter(sentence => {
        const match = GIVE_UP.exec(sentence);
        return match && !NOT_BEFORE.test(sentence.slice(0, match.index));
    });
    if (!said.length) return [];
    const names = record => [record.key, String(record.fields?.giver ?? '').trim(), ...(record.aliases ?? [])].filter(name => name.length >= 3);
    const named = (sentence, name) => new RegExp(`(?<![\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`, 'iu').test(sentence);
    return (tracker?.records ?? [])
        .filter(record => record.kind === 'quest' && record.status === 'active')
        .filter(record => said.some(sentence => names(record).some(name => named(sentence, name))))
        .map(record => record.key);
}
