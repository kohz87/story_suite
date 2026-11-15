/* One-pass narration capture: finding, removing and parsing the hidden quick-scan block. */
import { parseScanJson } from './scan-json.js';

// One-pass narration capture (opt-in). The roleplay model ends its reply with the quick-scan JSON
// inside a hidden comment; the block is removed from the stored message before any lineage key or
// transcript reads it. The block never reaches past the start of another extension's block (an HTML
// comment such as Story Block's <!-- STORY_SUITE_V2 envelope, Story Block's <Changes> block, or any
// tag after a blank line), so their text stays whole whichever comes first, even when Delta's block
// is never closed. Within that bound a closing `-->` at the very end wins, so one inside the JSON
// cannot split the block. The tag and trailing-fence near-misses are accepted only from a reply asked
// for the block.
const NARRATION_CAPTURE_COMMENT = /<!--\s*npc_state_delta\b((?:(?!<!--|<changes\b|\n[ \t]*\n[ \t]*<)[\s\S])*?)-->\s*$|<!--\s*npc_state_delta\b((?:(?!<!--|<changes\b|\n[ \t]*\n[ \t]*<)[\s\S])*?)-->|<!--\s*npc_state_delta\b((?:(?!<!--|<changes\b|\n[ \t]*\n[ \t]*<)[\s\S])*)/gi;
const NARRATION_CAPTURE_NEAR_MISS = /<npc_state_delta\b[^>]*>((?:(?!<!--|<changes\b|\n[ \t]*\n[ \t]*<)[\s\S])*?)(?:<\/npc_state_delta>|(?=<!--|<changes\b|\n[ \t]*\n[ \t]*<)|$)|```(?:json)?\s*(\{\s*"npcs"(?:(?!```)[\s\S])*)```\s*$/gi;
const NARRATION_CAPTURE_CLOSED = /(?:-->|<\/npc_state_delta>|```)\s*$/i;

function removeNarrationCaptureBlocks(source, pattern, found) {
    return source.replace(pattern, (whole, ...groups) => {
        found.raw = String(groups.slice(0, -2).find(group => group !== undefined) ?? '').trim();
        found.status = NARRATION_CAPTURE_CLOSED.test(whole) ? 'found' : 'unterminated';
        return '';
    });
}

export function extractNarrationCapture(text, { lenient = false } = {}) {
    const source = String(text ?? '');
    const found = { raw: '', status: 'none' };
    const clean = removeNarrationCaptureBlocks(lenient ? removeNarrationCaptureBlocks(source, NARRATION_CAPTURE_NEAR_MISS, found) : source, NARRATION_CAPTURE_COMMENT, found);
    return found.status === 'none' ? { text: source, ...found } : { text: clean.replace(/\s+$/, ''), ...found };
}

export function parseNarrationCapture(raw) {
    if (!String(raw ?? '').trim()) return null;
    try { return parseScanJson(raw); } catch { return null; }
}
