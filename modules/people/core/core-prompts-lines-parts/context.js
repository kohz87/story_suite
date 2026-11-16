/* NPC State one-pass lines builder: the context part (changes every reply). Unwired: nothing sends it until N7.
   Today it holds the story events to look for (NSD12, G8): `eventWatch` [{ key (a note id), name, event }]; '' with none. */
import { hiddenNoteEventLinesParagraph } from '../core-prompts-capture-parts/hidden-notes.js';

export function buildLinesContext({ eventWatch = null } = {}) {
    return hiddenNoteEventLinesParagraph(eventWatch);
}
