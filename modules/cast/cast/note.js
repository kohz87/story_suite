// Story Director v2, part **cast**: what the narrator is told (pure).
//
// Nothing fixed: the narrator writes no cast lines. It is told a meeting, in the reply it happens in: who comes into the scene (the words of
// their pack entry that show them: who they are, how they look, how they speak, what they want) and why now, so the scene brings them in;
// and, while the world's own people are at the scene's place, who they are by name, role and look (note-parts/here.js), so it invents no
// double of them. No static text, so a story with no cast in its packs sends the same prompt as before.
// Public face: re-exports its parts.

export { meetingFresh, cueOf, strangerLabel } from './note-parts/cue.js';
export { cueLines, pinned, tail } from './note-parts/tail.js';
export { hereLine, HERE_MAX } from './note-parts/here.js';
