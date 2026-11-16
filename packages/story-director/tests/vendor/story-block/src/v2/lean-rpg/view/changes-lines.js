// The RPG's lines in "Changed this reply" (mockup 12-auto-lines): "Rolled for you: 3 exchanges" from the reply's recorded
// rolls, and the automatic rises, "Wessel reached Lv 15 (+1 point to spend)" and "Iron Breath: Adept → Expert", worked out from the
// state before the reply and the reply's own (the level and rank rules raise them; the display names come from the
// fields' `names`). They come in the shape `replyCardLines` gives (ui-host.js adds them to the card's `moduleLines`).
// Pure: no DOM.
// Public face: re-exports its parts.

export { exchangesOf, rulesOfReply } from './changes-lines-parts/rolls.js';
export { partyLines, fightLines, practiceLines } from './changes-lines-parts/receipts.js';
export { rpgReplyLines } from './changes-lines-parts/reply.js';
