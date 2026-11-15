// Regex patterns matching quest completion and failure wording.

// A quest closed with one of these was not done: it ended without the work being finished.
export const FAILED = /\b(?:fail|abandon|gave up|give up|given up|giving up|forfeit|quit\b|walked away|backed out|called off|withdr[eao]w|expired|missed|too late|cancel|refused|declined|botched)/i;
// (0.9.1) How a model says something is over without a `-` line: `~ Quest — step: done`,
// `status: completed`, `outcome: failed`. Only a value that is one of these words, alone or
// before punctuation ("completed — the wolves are dead"): "complete the ritual" is a step.
export const OVER_VALUE = /^(?:done|complete|completed|finished|fulfilled|accomplished|resolved|succeeded|success|turned in|handed in|delivered|over|closed|failed|failure|abandoned|given up|gave up|forfeit|forfeited|quit|withdrawn|called off|expired|cancell?ed)\s*(?:$|[.,;:!—–(-])/i;
// A `!` on a quest that says it was finished or failed ("! Sheep-killer — wolves slain, reward paid").
// (0.9.27) Or the pay for it: "voucher paid", "bounty collected".
export const QUEST_OVER_TEXT = /\b(?:complet|finish|fulfil|accomplish|done\b|turned in|handed in|(?:reward|bounty|voucher|fee|payment)(?:ed)?\s+(?:paid|collected|received|claimed)|paid out|paid in full)/i;
// (0.9.5) A quest still open whose own progress reads as over ("step: wolf slain, reward
// collected"): finished or failed words in its step or now. Not its goal or description, which
// say what the job is ("complete the ritual").
export const LOOKS_OVER = /\b(?:completed|finished|fulfilled|accomplished|done\b(?!\s+with)|turned in|handed in|delivered|(?:reward|bounty|voucher|fee|payment)(?:ed)?\s+(?:paid|collected|received|claimed)|paid out|paid in full|failed|abandoned|gave up|given up|forfeit(?:ed)?|quit\b|walked away|backed out|called off|expired|too late)/i;
