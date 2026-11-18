// Story Director v2, part screens: the Quests tab drawn as cards, widget `story-director.quests` (bound to
// `director.threads`). Display only: it reads the threads the tab lists today (a quest, an old chat's quest
// record, or any thread with a goal) and changes nothing; no button here acts on the story (F95), only "More"
// on a cut description and the Finished fold. Text only through textContent (WAVE rule 7).
//
// The look is Story Block's quest card (block-layouts.js drawCards, host.css `.ss-b-*`) as Story Director's own copy
// (`sd-q-*`, in quests.js's CSS), on Story Block's tokens with fallbacks. Active and offered quests come first, in
// tracker order, under "Active (n)"; the ones that ended are folded under "Finished (n)". Which descriptions and
// whether Finished are open is remembered across redraws (`memory`, per page, keyed by the thread's id).
// Public face: re-exports its parts.

export { chipOf, isQuestThread, rowsOf } from './quest-cards-parts/rows.js';
export { QUESTS_WIDGET, createQuestsWidget, questsWidget } from './quest-cards-parts/widget.js';
