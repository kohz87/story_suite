// Story Director v2, part **cast**: the narrator's line for a sought person who is elsewhere (the reader's card stays nameless: apply-parts/travel.js).
//
// The narrator is told who they are (the public face, face.js) and where they are, that they are not in this scene, and to use them by this name
// if the story goes to them or needs someone of their role. The narration uses the name only after someone in the story says it. Worded for any
// persona (no verb agrees with {{user}}). Pure: read from the pack entry and the stored `where`, so a swipe, a rewind or a reload sends the same line.

import { flat } from '../domain.js';
import { faceOf } from './face.js';

/** `[Cast] ...` text for `entry` at `where` (the stored rumor's place), or '' with no entry. */
export function rumorLine(entry, where = '') {
    if (!entry?.name) return '';
    const place = flat(where);
    return `Someone sought is not in this scene: ${faceOf(entry)}${place ? `, at ${place}` : ''}. If the story goes to them or needs someone of their role, use this person by this name rather than making up someone new; the narration uses the name only after someone in the story says it.`;
}
