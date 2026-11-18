// The stage word the battle log tells for a bar that moved. A Combat Rules v1 bar is plain numbers with no stage word of its own, so its word comes from the stage lists.
import { STAGES, stageWord } from '../../names.js';

/** "Tired" for a bar `{ value, max, word, numbers }` of `key` (health, mana, stamina): the bar's own word, else (a numbers bar) the stage word for its value, else ''. */
export function barWord(key, bar) {
    if (bar?.word) return bar.word;
    return bar?.numbers ? stageWord(STAGES[key], bar.value, bar.max) : '';
}
