// Choices and Inner chatter: reading one `? choice` or `~ chatter` line into its value.

import { lineBody } from '../capture.js';
import { cutPoints, flatten } from './text.js';
import { CHOICE_KEEP } from './limits.js';
import { CHATTER_CHARS, NAME_CHARS } from './chatter-limits.js';

const HAS_WORD = /[\p{L}\p{N}]/u;

// A thought wrapped in one pair of `*` or `_` (italics, as models write thoughts) loses the pair.
const unwrap = text => {
    const found = /^([*_])([^*_][\s\S]*?)\1$/u.exec(text);
    return found ? found[2].trim() : text;
};

/** A `? choice` line → { value: { text } } | { error }. */
export function readChoice(line) {
    const text = flatten(lineBody(line?.raw ?? ''));
    if (!HAS_WORD.test(text)) return { error: 'the choice has no text (write "? choice What to do next")' };
    return { value: { text: cutPoints(text, CHOICE_KEEP) } };
}

// The speaker's name ends at the first colon, or at a dash with a space before it, within the first
// NAME_CHARS + 20 characters (a long title, "Captain of the Watch").
const SPEAKER = /^(.{1,60}?)\s*(?::|：|\s[—–-])\s*(.*)$/su;

/** A `~ chatter` line → { value: { name, text } } | { error }. */
export function readChatter(line) {
    const body = flatten(lineBody(line?.raw ?? ''));
    const found = SPEAKER.exec(body);
    if (!found) return { error: 'it names no one (write "~ chatter Name: the thought")' };
    const name = flatten(found[1].replace(/^[*_"“”'‘’]+|[*_"“”'‘’]+$/g, ''));
    const text = unwrap(flatten(found[2]));
    if (!HAS_WORD.test(name)) return { error: 'it names no one (write "~ chatter Name: the thought")' };
    if (!HAS_WORD.test(text)) return { error: `there is no thought after ${cutPoints(name, NAME_CHARS)}` };
    return { value: { name: cutPoints(name, NAME_CHARS), text: cutPoints(text, CHATTER_CHARS) } };
}
