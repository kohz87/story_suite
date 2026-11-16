// The condition words, their price factors, the word shown after a name and the price by condition.

// The condition words (a piece's cond 0…100) and what a piece is worth in each: Good is unmarked, the rest show their word after the
// name in the prompt, and every price read through `inventory.items` is the def's value times the factor.
export const CONDITION = Object.freeze({
    good: Object.freeze({ min: 70, factor: 1 }),
    worn: Object.freeze({ min: 40, factor: 0.75 }),
    torn: Object.freeze({ min: 1, factor: 0.5 }),
    broken: Object.freeze({ min: 0, factor: 0.2 }),
});

/** good | worn | torn | broken for a condition 0…100 (a missing one is as new). */
export function condWord(cond) {
    const n = Number.isFinite(cond) ? cond : 100;
    return n >= CONDITION.good.min ? 'good' : n >= CONDITION.worn.min ? 'worn' : n >= CONDITION.torn.min ? 'torn' : 'broken';
}

/** The word the prompt shows after a name (`Cane Sword (worn)`), or '' for Good. */
export const condMark = cond => (condWord(cond) === 'good' ? '' : condWord(cond));

/** What a piece of condition `cond` is worth: `value` × the condition's factor (Good 100%, Worn 75%, Torn 50%, Broken 20%), whole. */
export const valueByCond = (value, cond) => Math.round(value * CONDITION[condWord(cond)].factor);
