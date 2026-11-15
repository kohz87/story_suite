// Telling whether a chat differs from its stored lineage only in Story Suite's own hidden blocks.
import { fingerprintMessage } from './fingerprint.js';
import { messageFingerprint, seenText } from './shared-message-fingerprint.js';

// Story Suite's own hidden blocks in a reply: the STORY_SUITE_V2 comment and Story Block's <Changes> family
// (Changes, Changes-assist, Changes-assist-next, -story, -cut, -echo). Taken out, what is left is the story text
// and any other extension's block (the hosted npc_state_delta one-pass block included).
const STORY_SUITE_COMMENT = /<!--\s*STORY_SUITE_V2\b[\s\S]*?-->/gi;
const STORY_SUITE_CHANGES = /<(Changes(?:-[a-z]+)*)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
export function stripStorySuiteBlocks(text) {
    return String(text ?? '').replace(STORY_SUITE_COMMENT, '').replace(STORY_SUITE_CHANGES, '').replace(/\s+$/, '');
}

// What is left of a reply once Story Suite's blocks are out, compared without line-ending style or trailing-space differences.
function storyTextOf(text) {
    return stripStorySuiteBlocks(text).replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '');
}

// True when the live chat differs from the stored lineage only in Story Suite's own hidden blocks: same length, at least one reply
// differs, and each differing reply has an earlier text (the one the stored lineage hashed) that is the same without them, line endings and
// trailing spaces aside. A reply whose earlier text is not known (a replaced message object, a first sight) is not proven, so it counts as a real edit.
export function onlyStorySuiteBlocksChanged(stored, chat) {
    const messages = Array.isArray(chat) ? chat : [];
    if (!Array.isArray(stored) || stored.length !== messages.length) return false;
    let changed = false;
    for (let i = 0; i < stored.length; i += 1) {
        const message = messages[i];
        if (stored[i] === fingerprintMessage(message)) continue;
        const past = seenText.get(message)?.past || [];
        const was = past.findLast(text => stored[i] === messageFingerprint({ is_user: message?.is_user, mes: text }, false));
        if (was == null || storyTextOf(was) !== storyTextOf(message?.mes)) return false;
        changed = true;
    }
    return changed;
}
