// Cuts the pulse's text to a word and builds its "World this reply" tail line.

import { plainSlot } from '../tables.js';

// The note line is at most 40 tokens (4 chars each): the label and TAIL_CHARS of text stay under 150; BRIEF_CHARS is the version 2 narrator brief.
export const TAIL_CHARS = 128;
export const BRIEF_CHARS = 330;

/** `text` plain and cut at a word to at most `max` characters (no cut when it fits). */
export function cutWord(text, max = TAIL_CHARS) {
    const flat = plainSlot(text, 400);
    if (flat.length <= max) return flat;
    const cut = flat.slice(0, max);
    const space = cut.lastIndexOf(' ');
    return (space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–—]+$/, '');
}

/** The tail line for an effect's text: "World this reply: …", plain and cut at a word to TAIL_CHARS; '' when there is no text. */
export function worldLine(text, max = TAIL_CHARS) {
    const body = cutWord(text, max);
    return body ? `World this reply: ${body}` : '';
}
