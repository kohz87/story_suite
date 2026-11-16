// Story Director: fixed pacing and encounter cues for the note.

// How a schedule meets a scene, about 70 tokens; only when something is scheduled. Without
// it a model handed "Due now: the warrant is filed" tends to stop the scene and stage it.
export const PACING = [
    'Pacing: the world keeps its schedule and the scene keeps its flow. Bring a due item in only where it fits: on-screen if {{user}} is there to see it, otherwise later as news, signs or aftermath.',
    'Never cut into or bend the current scene for a beat, and never decide what {{user}} does. What cannot fit yet happens off-screen (!) or slips (~ on: later).',
].join(' ');
// The same, when a capture call writes the changes and the model writes none.
export const PACING_NO_CHANGES = PACING.replace(/ What cannot fit yet happens off-screen \(!\) or slips \(~ on: later\)\./, ' What cannot fit yet can happen off-screen or later.');
// Added to the Pacing line only while a due or arriving record carries an encounter, about 35
// tokens. The fight is resolved by another extension; a storyteller left
// alone would narrate the whole fight and decide how it ends, so it stops at the first blow.
export const ENCOUNTER_CUE = 'A due fight starts when the scene reaches it: show the foes appear and stop at the first blow; the fight is resolved outside the story.';
