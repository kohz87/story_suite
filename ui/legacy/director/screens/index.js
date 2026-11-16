// Story Director v2, part **screens** (SPEC §13, MODULES §A): the module's default screens, as data
// Story Block renders: `story-director/quests` (tab, screen), `story-director/director` (tab, screen),
// `story-director/status-card` (card, under each reply, from that reply's state). The story time and place are
// in the Status fold, not a HUD strip (Story Block's HUD shows party data only). Cards and packs restyle or replace any of
// them by id (§13.7). The Quests screen draws its threads as cards through the widget `story-director.quests` (quest-cards.js).
//
// The screens bind to the tracker's and quests' queries (`director.time`, `director.threads`,
// `quest.progress`, `quest.details`) and to four view queries this part adds (queries.js: `director.goal`,
// `director.next`, `quest.board`, `director.problems`), which work out what a template cannot
// (sorting, dates, each quest's status line and details, `{{user}}` in problem texts) from those same
// queries. No screen draws a command button (F95): quests follow the reader's words and the story. No commands, domains or change-line kinds of its own.
// The Director screen's device-wide spoiler switch is independent of the older Behind widget's per-chat
// Reveal choice (reveal.js, widget `story-director.behind`; setting `hideBehind`, on). The status card is
// on under every reply by default (`defaultOn: true`, MODULES §F24; the reader can turn it off).
// Public face: re-exports its parts.

export { DIRECTOR_ID, KIND_GROUPS } from './director.js';
export { QUESTS_ID } from './quests.js';
export { STATUS_CARD_ID } from './status-card.js';
export { BEHIND_WIDGET, PLAN_WIDGET, RIPPLES_WIDGET, behindWidget, createBehindWidget, planWidget, createRipplesWidget, ripplesWidget } from './behind.js';
export { QUESTS_WIDGET, chipOf, createQuestsWidget, isQuestThread, questsWidget, rowsOf } from './quest-cards.js';
export { BEHIND, BEHIND_KINDS, HIDE_SETTING, browserStore, createReveal, reveal } from './reveal.js';
export { calendarSetting, currentGoal, nextDue, planView, problemsList, readerWords, screenQueries } from './queries.js';
export { MODULE_ID, createScreensPart, part, screens } from './index-parts/part.js';
