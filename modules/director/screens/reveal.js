// Story Director v2, part screens: behind the scenes, hidden until the reader reveals it (v1's Director tab
// "Hide behind the scenes", Story Block v1's "Hide off-screen until revealed").
//
// What the world does where {{user}} is not (agendas, planned beats, clocks, secrets) is the story's
// to surprise the reader with, so the Director screen and the arc panel show only how much there is
// and a Reveal button, and none of it is put into the page until then. The prompt still gets all of it:
// only the reader's view is hidden. The choice is per chat and remembered in this browser (its storage,
// keyed by the chat's id), never story state: a swipe or a delete does not hide it again, and nothing
// is saved into the chat. The setting `screens.hideBehind` (on by default) turns the hiding off for
// every chat. Pure but for the browser's storage and SillyTavern's chat id, both injectable.
// Public face: re-exports its parts.

export { BEHIND, BEHIND_KINDS } from './reveal-parts/kinds.js';
export { browserStore, stChatId } from './reveal-parts/store.js';
export { HIDE_SETTING, MODULE_ID, createReveal, reveal } from './reveal-parts/choice.js';
