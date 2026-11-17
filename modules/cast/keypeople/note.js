// Story Director v2, part **keypeople**: what the narrator is told (pure).
//
// static (the feature's, the same bytes every reply): the fixed paragraph (STATIC_TEXT) and the `away` grammar line; no `key` line and no death sentence (deaths are NPC State's, read by nsd.js).
// tail: `[Key people] Away from the scene:` and one line per away key person, within the Key people token budget (a
// setting, 300 by default, no upper limit; the host's overall tail budget still caps everything):
//   `Ren: away, scouting the north road, back Goldwane 18; latest: reached Wolfmere Outpost.`
// Ordered by the soonest return (no date last), then the latest step; over budget, the rest are left out of that reply
// (they are still tracked). A back date that has passed moves nobody: the line says "due back" and the narrator brings them.
// Public face: re-exports its parts.

export { TAIL_HEADER, GRAMMAR, STATIC_TEXT } from './note-parts/prompt-text.js';
export { tokensOf, keyPeopleOn } from './note-parts/settings.js';
export { awayEntries } from './note-parts/entries.js';
export { awayLine, keyTail } from './note-parts/lines.js';
export { tail } from './note-parts/tail.js';
