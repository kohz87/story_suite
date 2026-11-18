// The rule mark that tells a live read from a replayed one.

// Rule mark: historical replies without this mark keep the prompt rules under which they were read.
export const backgroundRuleOn = (replaying, entry) => !replaying || entry?.backgroundRule === 1;
