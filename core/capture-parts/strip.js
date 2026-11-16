// Story Suite v2: stripBlock, a reply without its change blocks, for display and the prompt history.

import { dropLines, strayLines } from '../capture/stray.js';
import { findBlocks, commentParts, sectionTags, replacePairs, hiddenPairs } from '../capture/blocks.js';
import { trimEnd } from '../capture/lines.js';
import { stripLegacy } from '../capture/legacy.js';

/**
 * `mes` without its <Changes> blocks (bare or hidden), for display and for the prompt history.
 * Whitespace left at the end is trimmed.
 */
export function stripBlock(mes, tag = 'Changes', { heads = null } = {}) {
    // (A v1 envelope goes too: it is never shown or sent, adoptLegacy.)
    const given = stripLegacy(mes);
    // `heads` (grammarHeads): the change lines written in the story near the block go too.
    const raw = heads ? dropLines(given, strayLines(given, heads, { tag }).taken) : given;
    // A hidden comment goes when it holds a block, or only the lines left in the story or a cut line.
    const ours = pair => {
        const body = raw.slice(pair.bodyStart, pair.bodyEnd);
        if (findBlocks(body, tag).length) return true;
        const parts = commentParts(raw, pair, tag);
        return parts.story.length > 0 || parts.cut !== null || body.includes(`<${sectionTags(tag).echo}>`)
            || parts.assist.length > 0 || parts.next.length > 0;
    };
    let text = replacePairs(raw, hiddenPairs(raw), pair => (ours(pair) ? '' : raw.slice(pair.start, pair.end)));
    const blocks = findBlocks(text, tag);
    for (const block of blocks.reverse()) text = text.slice(0, block.start) + text.slice(block.end);
    return trimEnd(text);
}
