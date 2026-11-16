// The game view's header (UI stage 5a): the `ss.hero` block at the top of every screen of the game view, read from the
// head state. The lead is the party's own character (`party.pc`; without a party module, the reader's persona
// name), its HP, MP and SP pools, the level under the Terms' word and its conditions. The scene is `scene.place`,
// `scene.weather` and the story time (`director.time`, Story Director; formatted by the host's `fmt.time`), and, while
// `story-block.you` is on, the persona's rank, what they wear and how they are (`scene.you`, with the editor's command). The editor's
// date and time fields come from `clock` (`director.time`'s `parts` and `director.calendar`'s months and era; none from a Story Director that
// does not answer `parts`). Every read goes through `query(name, args)` and falls back to nothing: a missing module shows no bar, not an error.
//
// The portrait is the first safe picture of: the persona's avatar (`/thumbnail?type=persona&file=…`), the character
// card's avatar (`/thumbnail?type=avatar&file=…`), a picture a module answers for the lead (`npc.portrait`, Delta's
// query, asked with `{ name }`), else '' (the hero draws the initial). Nothing here runs a command.
//
// The reader's SillyTavern is read through `readHeroContext()` (getContext(): name1, characters and characterId; the
// current persona's file from the context when it has one, else from the page: personaFileOnPage). Tests pass their own
// context and document.
// Public face: re-exports its parts.

export { personaAvatarUrl, cardAvatarUrl, portraitCandidates, portraitOf } from './game-header-parts/avatars.js';
export { personaFileOnPage, readHeroContext, pictureOf } from './game-header-parts/hero-context.js';
export { conditionIcon, conditionLeft } from './game-header-parts/conditions.js';
export { clockProps } from './game-header-parts/clock.js';
export { gameHeroProps, headerControlItems } from './game-header-parts/hero-props.js';
