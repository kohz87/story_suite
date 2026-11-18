// Story Suite v2: a reply whose only change block was left open and holds no line (HK-1): it counts as no block, so the repair is asked.

import { readParts } from '../capture/echo.js';
import { CUT_MARK, hiddenPairs } from '../capture/blocks.js';

// `text` ends with a hidden comment written for a block left open (hideBlock's `open` mark).
const endsOpen = text => {
    const last = hiddenPairs(text).at(-1);
    return !!last && !text.slice(last.end).trim() && new RegExp(`^[ \\t]+${CUT_MARK}\\b`).test(text.slice(last.bodyStart, last.bodyEnd));
};

/**
 * True when the reply's change blocks hold no line and the last one was left open (the model wrote the tag and stopped, or its close
 * never came), bare as it arrives or hidden with the `open` mark as Re-read finds it. A closed empty block is the model's "nothing
 * changed" and is not this.
 */
export function blankOpen(mes, tag = 'Changes') {
    const text = String(mes ?? '');
    const { blocks, bodies, strays } = readParts(text, tag, null, []);
    if (!blocks.length || strays.length || bodies.some(body => body.trim())) return false;
    return blocks.at(-1).open === true || endsOpen(text);
}
