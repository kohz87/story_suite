// Story Suite v2: hideBlock, a reply with its bare change blocks moved into one hidden comment.

import { strayLines, dropLines } from '../capture/stray.js';
import { readParts, STORY_WORD } from '../capture/echo.js';
import {
    blockBody, sectionTags, replacePairs, hiddenPairs, reasoningPairs, blank,
    commentSafe, wholeLines, CUT_MARK, HIDDEN_MARKER,
} from '../capture/blocks.js';
import { trimEnd } from '../capture/lines.js';
import { LEGACY_MARK } from '../capture/legacy.js';

/**
 * `mes` with its bare <Changes> blocks moved into one hidden comment at the end, so
 * SillyTavern shows nothing of them and Re-read can still find them. Already hidden: unchanged.
 * `from`, `skip`, `tail`, `cut` (continuation()): only blocks that end after `from`, from the `skip`th bare
 * block on (a Continue's own text), are moved; the ones before are left as they are. A block left
 * open is kept with the word `open` after the marker, so a Continue can tell it goes on with it, and its
 * unfinished last line is kept beside it (<Changes-cut>). With `heads`, the change lines a capture left in
 * the story are listed in it (<Changes-story>), so a Re-read leaves them too. `legacy`: the block was read from a v1
 * envelope (adoptLegacy), which the comment says.
 */
export function hideBlock(mes, tag = 'Changes', { from = 0, skip = 0, tail = false, cut = null, stopped = false, heads = null, legacy = false } = {}) {
    const given = String(mes ?? '');
    // `heads` (grammarHeads): the change lines written in the story near the block (strayLines) are
    // taken out of the story and kept after the blocks, in a block of their own.
    const found = heads ? strayLines(given, heads, { tag, from, tail, stopped }) : { taken: [], problems: [] };
    const left = found.problems.filter(item => item.keep).map(item => item.line);
    // Taking whole lines out after `from` leaves `from`, `skip` and `tail` true of the text.
    const text = dropLines(given, found.taken);
    // (Echoes are judged as extractBlock judges them: against this read's blocks and, for a Continue, the
    // reply's earlier reads, readParts.)
    const { blocks: bare, bodies: whole, emptied, strays, echoes, repeated } = readParts(text, tag, { from, skip, tail, cut }, found.taken);
    if (!bare.length && !found.taken.length && !left.length) return text;
    // C2-6: the bodies were found in the text with reasoning blanked (what extractBlock reads), so
    // reasoning inside a block is left in the story where it stood, never written back as spaces.
    const thoughts = reasoningPairs(replacePairs(text, hiddenPairs(text), blank));
    let story = text;
    for (const block of [...bare].reverse()) {
        const inside = thoughts.filter(pair => pair.start >= block.start && pair.end <= block.end).map(pair => text.slice(pair.start, pair.end));
        story = story.slice(0, block.start) + inside.join('\n') + story.slice(block.end);
    }
    // (Spaces left at line ends, where reasoning was blanked, go.)
    const lineEnds = body => body.split('\n').map(line => line.trimEnd()).join('\n');
    const open = bare.at(-1)?.open === true;
    // The lines taken from the story are their own body, marked as the story's (`<tag story>`); a body that
    // held only echoes of an earlier read's story lines (readParts) is left out.
    const body = (text, mark = '') => `<${tag}${mark}>\n${commentSafe(lineEnds(text))}\n</${tag}>`;
    const kept = bare.map((block, i) => (emptied[i] ? null : body(blockBody(whole[i])))).filter(part => part !== null);
    const taken = strays.length ? [body(strays.map(line => line.line).join('\n'), ` ${STORY_WORD}`)] : [];
    const parts = open ? [...taken, ...kept] : [...kept, ...taken];
    const names = sectionTags(tag);
    if (left.length) parts.push(`<${names.story}>\n${commentSafe(left.join('\n'))}\n</${names.story}>`);
    const echoed = [...echoes.map(line => line.line), ...repeated];
    if (echoed.length) parts.push(`<${names.echo}>\n${commentSafe(echoed.join('\n'))}\n</${names.echo}>`);
    // The unfinished line, unless a tag sits in it (then no Continue can finish it as a line).
    const unfinished = open ? wholeLines(bare.at(-1)).cut : '';
    if (unfinished && !unfinished.includes('<')) parts.push(`<${names.cut}>\n${commentSafe(unfinished)}\n</${names.cut}>`);
    // A block left open (the reply was cut off in it) is said so, for a Continue (continuation()).
    // `legacy`: the block was read from a v1 envelope (adoptLegacy), said so a Re-read tells it again (legacyRead).
    const mark = `${open ? ` ${CUT_MARK}` : ''}${legacy && bare.length ? ` ${LEGACY_MARK}` : ''}`;
    return `${trimEnd(story)}\n\n<!-- ${HIDDEN_MARKER}${mark}\n${parts.join('\n')}\n-->`;
}

// --- Change lines written in the story (fix-encounter) ---------------------------------------------
// Models put a change line in the story now and then, on its own line just before the block (or with
// no block at all): "! encounter 8 Weir Rat — cellar pack | tier: weak". Such a line is read as one of
// the reply's changes and hidden like the block, but narrowly: only a whole line that starts exactly
// as a kind's grammar line does (its `heads`, grammarHeads: the op, one space, the kind in lower case),
// parses, and sits near the end of the reply: in its last STRAY_PARAGRAPHS story paragraphs before the
// first block, or after it. A paragraph made only of change lines is not counted, so taking its lines
// out never brings an earlier line into reach (Re-read reads what the live capture left). A line with
// `-` (a Markdown bullet too) is taken only from a paragraph of change lines. A line close to one but
// not taken (another op, a capital, a colon, too far up) is told as a Problem, never dropped quietly.
// The lines taken are read after the blocks, and hideBlock keeps them after the blocks in the hidden
// comment, so the live capture and every Re-read read them in the same order.
