// Story Director: change-line field names and quest difficulty normalization.
import { QUEST_FIELDS } from './kinds.js';
import { stripMarkdown } from './shared-text.js';

// A quest's difficulty is one of four words. A missing or unreadable one is normal.
export const QUEST_DIFFICULTIES = Object.freeze(['easy', 'normal', 'hard', 'nightmare']);
const DIFFICULTY_WORDS = Object.freeze({
    easy: 'easy', trivial: 'easy', simple: 'easy', minor: 'easy', light: 'easy', low: 'easy',
    normal: 'normal', medium: 'normal', moderate: 'normal', average: 'normal', standard: 'normal', regular: 'normal',
    hard: 'hard', difficult: 'hard', tough: 'hard', challenging: 'hard', dangerous: 'hard', high: 'hard',
    nightmare: 'nightmare', deadly: 'nightmare', impossible: 'nightmare', extreme: 'nightmare', lethal: 'nightmare', insane: 'nightmare',
});

/** `easy | normal | hard | nightmare` for a written difficulty: the first word it knows, else normal. */
export function questDifficulty(value) {
    const words = stripMarkdown(value).toLowerCase().split(/[^\p{L}]+/u);
    const known = words.find(word => Object.hasOwn(DIFFICULTY_WORDS, word));
    return known ? DIFFICULTY_WORDS[known] : 'normal';
}
// A planned fight: who the foes are, as free text (`3 bandit, bandit
// captain (boss)`, `2 x dire wolf rank D`). Story Director only stores and schedules it; the
// fight itself is resolved by another extension, so the text is never parsed here.
// (0.9.19) `reach`: how a beat touches {{user}} wherever they are (a price, a door shut, a
// mood), free text the planner writes; the note shows it once the beat is due.
export const FIELDS = ['desc', 'now', 'then', 'on', 'due', 'shown', 'leg', 'arrive', 'place', 'people', 'encounter', 'reach', ...QUEST_FIELDS];
