// {{user}}'s look (`~ you rank: … | wearing: … | condition: …`, and the `scene.you` command): their Rank when a pack gives one,
// what they wear and how they are. Descriptive only; the story's line or a reader's edit sets the parts. Pure.
// Public face: re-exports its parts.

export { rankLabelIn, guildOf, rankAgrees } from './you-parts/rank.js';
export { setYou, captureYou } from './you-parts/commands.js';
export { youText, youParts } from './you-parts/text.js';
export { youNote } from './you-parts/note.js';
export { lookOf, clearLook } from './you-look.js';
export { wornWords } from './worn-words.js';
