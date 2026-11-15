// Predicates checking whether a step or closing reason ends or takes on a job.

import { FAILED, LOOKS_OVER, QUEST_OVER_TEXT } from './over-patterns.js';

// (0.9.42) A quest's step that opens with the ending and goes on to confirm it: "Completed and
// turned in to Fenna" (the rest says turned in), or with a `reward:` that reads as paid in the
// same line ("reward: Claimed 2 gold"). "done tracking, now the den" is still a step.
const OVER_START = /^(?:done|completed|finished|fulfilled|accomplished|cleared|turned in|handed in|delivered|failed|abandoned)\b\s*(?:and|&|,|—|–|-|;)\s*(.+)$/i;
const REWARD_TAKEN = /^(?:claimed|collected|received|paid|taken|pocketed|got)\b/i;
export const overStep = (value, op) => {
    const rest = value.match(OVER_START)?.[1] ?? '';
    if (!rest) return false;
    return LOOKS_OVER.test(rest) || QUEST_OVER_TEXT.test(rest) || REWARD_TAKEN.test(String(op?.fields?.reward ?? op?.extra?.reward ?? '').trim());
};
export const QUEST_OVER_FIELDS = ['step', 'now'];
// (0.9.13) A `-` that says the job was taken on, not ended: "- Hook Sheepfold Wolves — accepted
// by Wessel" beside the `+ quest` it became. Not when it also speaks of pay or an ending.
const TAKEN_ON = /\b(?:accept(?:s|ed)?|tak(?:es|en|ing) (?:on|up)|took (?:on|up)|signed (?:on|up|for)|agreed to|became (?:a |the )?(?:quest|bounty|contract|job)|(?:now|turned into|converted (?:in)?to|promoted to|upgraded to) (?:a |the )?(?:quest|bounty|contract|job))\b/i;
const NOT_TAKEN_ON = /\b(?:reward|paid|pay(?:ment)?|coin|silver|gold|copper|fee)\b/i;
export const endsJob = reason => QUEST_OVER_TEXT.test(reason) || FAILED.test(reason) || LOOKS_OVER.test(reason);
export const takenOn = reason => TAKEN_ON.test(reason) && !NOT_TAKEN_ON.test(reason) && !QUEST_OVER_TEXT.test(reason) && !FAILED.test(reason) && !LOOKS_OVER.test(reason);
