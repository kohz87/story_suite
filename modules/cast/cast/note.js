// Story Director v2, part **cast**: what the narrator is told (pure).
//
// Nothing fixed: the narrator writes no cast lines, and an unmet person is never in its text. The one thing it is told is a meeting,
// in the reply it happens in: who comes into the scene (the words of their pack entry that show them: who they are, how they look,
// how they speak, what they want) and why now, so the scene brings them in. Nothing at all while no one is met in this reply, and
// no static text, so a story with no cast in its packs sends the same prompt as before.
// Public face: re-exports its parts.

export { meetingFresh, cueOf } from './note-parts/cue.js';
export { cueLines, pinned, tail } from './note-parts/tail.js';
