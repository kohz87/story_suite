// The axis sentence templates and the quest phase wording the sentence grammar is built from.
export const AXIS = Object.freeze({
    trust: { up: ['My trust in {P} rose.', 'My trust in {P} grew.'], down: ['My trust in {P} fell.', 'My trust in {P} dropped.'] },
    affection: { up: ['My affection for {P} rose.', 'My affection for {P} grew.'], down: ['My affection for {P} fell.', 'My affection for {P} dropped.'] },
    desire: { up: ['My desire for {P} rose.', 'My desire for {P} grew.'], down: ['My desire for {P} fell.', 'My desire for {P} dropped.'] },
    tension: { up: ['The tension between {P} and me rose.', 'The tension between {P} and me grew.'], down: ['The tension between {P} and me fell.', 'The tension between {P} and me eased.'] },
});
export const AXES = Object.freeze(Object.keys(AXIS));
export const QUEST_VERB = Object.freeze({ opened: 'was opened', offered: 'was offered', accepted: 'was accepted', complete: 'was marked complete', failed: 'was marked failed' });
