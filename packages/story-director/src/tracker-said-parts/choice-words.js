// Regex patterns for reader acceptance, agreement, refusal, and chosen endings.

// (0.9.15) Choices about a job are the reader's: taking it on, turning it down, giving it up.
// The model's line for one counts only when the reader's own message (the one the reply answers)
// made it, naming the job (its key, its giver or a word of its name). The story keeps the
// outcomes: done, failed, expired. A main quest is the story's to give, and a job the story
// moves on (a step under way) is one the character is already doing.
// (0.9.27) "We" as well as "I", and going along: "we'll join the hunt", "count us in".
// (0.9.32) Taking a notice off a board, or several at once: "took down all three contracts".
export const ACCEPT_WORDS = /\b(?:accept(?:s|ed|ing)?|take (?:it|this|that|the|on|up|them|down|all|both|these|those)|takes (?:it|the|on|up|them|down|all|both)|took (?:it|the|on|up|them|down|all|both|these|those)|taking (?:it|the|on|up|them|down|all|both)|(?:tore|pulled|ripped) (?:down|off) (?:the|all|both|them|these|those)|(?:i|we)(?:'?ll| will| shall) (?:take|do|handle|join|help|see to)|join(?:s|ed)? (?:the|you|your|in)|agree(?:s|d)? to|sign(?:s|ed)? (?:up|on)|count (?:me|us) in|(?:i'?m|we'?re) in|(?:i'?m|we'?re) up for|up for it|let'?s do (?:it|this)|deal|choose|chose|pick(?:s|ed)?)\b/i;
// (0.9.27) Plain yes words: they take a job only when the reply's one new quest is the question.
export const AGREE_WORDS = /^\W*(?:yes|yeah|aye|sure|okay|ok|alright|all right|very well|of course|fine)\b/i;
export const REFUSE_WORDS = /\b(?:refuse[sd]?|refusing|declin(?:e|es|ed|ing)|turn(?:s|ed|ing)? (?:it |that |this |them )?down|no thanks|pass(?:es|ed)? on|not interested)\b/i;
// A closing reason that is the reader's decision rather than the story's outcome.
export const CHOSEN_END = /\b(?:abandon|gave up|give up|given up|giving up|forfeit|quit\b|walked away|backed out|withdr[eao]w|refus|declin|turned down|passed on)/i;
