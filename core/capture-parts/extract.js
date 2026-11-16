// Story Suite v2: extractBlock, the text inside a reply's change block.

import { strayLines, inOrder } from '../capture/stray.js';
import { readParts } from '../capture/echo.js';
import { blockBody } from '../capture/blocks.js';
import { parseLine } from '../capture/lines.js';

// Every function here is linear in the length of the reply: a looping model can write a run of
// thousands of spaces or blank lines, and the text is read again for every later prompt (turn.js).
// So there are no regexes that can retry from each place in a run (`\s+$`, `\n\s*$`, `\s*x|\s+y`);
// those spots are plain loops.

// A display line whose kind its comment marks as off (markOff): counted as a line, never read.
const OFF_LINE = '(read while its feature was off)';

/**
 * The text inside the reply's <Changes> block (or `tag`), or null when there is none. Found
 * whether the block is bare or already hidden in Story Suite's comment; several blocks are
 * read as one, in order, so no line is lost. Blocks inside closed reasoning are not read.
 * `at` ({ from, skip, tail?, cut? }, from continuation()): only the bare blocks a Continue added are read,
 * without their lines that repeat a line an earlier read of the reply took from the story (FB-1).
 * An open block's unfinished last line is left out (wholeLines); `stopped` is accepted and changes nothing.
 * `heads` (grammarHeads): change lines written in the story near the block (strayLines) are read
 * too, after the blocks, and count as a block when there is none.
 * `display` (extras.js displayLines): a line of a kind its hidden comment marks as off is not read.
 */
export function extractBlock(mes, tag = 'Changes', at = null, { stopped = false, heads = null, display = false } = {}) {
    const found = heads ? strayLines(mes, heads, { tag, from: at?.from ?? 0, tail: at?.tail === true, stopped }).taken : [];
    const { blocks, bodies: whole, emptied, strays } = readParts(mes, tag, at, found);
    if (!blocks.length && !strays.length) return null;
    // (A Continue's block that held only echoes of the reply's story lines is read as an empty one.)
    const bodies = blocks.map((block, i) => {
        const body = blockBody(whole[i]);
        if (!display || !block.off?.size) return body;
        return body.split('\n').map(line => {
            const parsed = line.trim() ? parseLine(line) : { error: 'blank' };
            return !parsed.error && block.off.has(parsed.kind) ? OFF_LINE : line;
        }).join('\n');
    }).filter((body, i) => !emptied[i] || i === blocks.length - 1);
    return inOrder(bodies, strays, blocks.at(-1)?.open === true).join('\n');
}
