// Cue-word matching: tokenising text and finding the cue words (plain or negated) in it.

const DESCRIPTION_MAX = 2000;

export const tokensOf = text => String(text ?? '').slice(0, DESCRIPTION_MAX).toLowerCase().split(/[^a-z]+/);
// A word shortly before a cue that turns it round ("has no family", "never honest", "doesn't care": n't leaves a lone "t").
const NEGATORS = new Set(['no', 'not', 'never', 'without', 'nor', 'neither', 'none', 'nobody', 'nothing', 'cannot', 'hardly', 'barely', 'lack', 'lacks', 'lacking', 'low', 'little', 'weak', 'poor', 't']);
const NEGATION_REACH = 3;
const MATCH = (word, token) => token === word || (word.length >= 6 && token.startsWith(word));
// The cue words of `words` found in the tokens (whole words, or a prefix for words of six letters or more): { pos, neg }, the distinct
// words said plainly and the ones a negator stands just before. A token in `skip` (the person's own name or role) is no evidence.
export function cueHits(words, tokens, skip) {
    const pos = [];
    const neg = [];
    tokens.forEach((token, at) => {
        if (!token || skip?.has(token)) return;
        const word = words.find(item => MATCH(item, token));
        if (!word) return;
        const negated = tokens.slice(Math.max(0, at - NEGATION_REACH), at).some(before => NEGATORS.has(before));
        const into = negated ? neg : pos;
        if (!into.includes(word)) into.push(word);
    });
    return { pos, neg };
}
export const hitsOf = (words, tokens) => cueHits(words, tokens).pos;
