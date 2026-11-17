// What the reader's own character calls the Soul Class (the Difficulty card's Custom fields say it).

import { fold, readSheet } from '../../read.js';
import { SOUL_LABEL } from '../../soul.js';

/** What the reader's own character calls the Soul Class (their name's Character block, else the first), else "Soul Class". */
export function soulLabelFor(state, own) {
    const characters = readSheet(state)?.characters ?? [];
    const mine = own ? characters.find(entry => fold(entry.who) === fold(own)) : null;
    return (mine ?? characters[0])?.soulLabel ?? SOUL_LABEL;
}
