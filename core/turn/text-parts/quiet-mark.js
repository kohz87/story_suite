// Quiet mark: finds a quiet generation's instruction in its prompt, and the limits for remembering such marks.

// A quiet generation is told apart by its instruction (GENERATION_STARTED's quiet_prompt): the longest line of it that holds no
// macro, at least this long (a shorter one could be anywhere). At most QUIET_KEEP are remembered, each for QUIET_WAIT_MS after its
// interceptor ran (its prompt is built well within that; one that never came, an aborted generation's, is forgotten).
export const QUIET_MARK_MIN = 12;
export const QUIET_KEEP = 8;
export const QUIET_WAIT_MS = 2 * 60_000;

/**
 * What a quiet generation's instruction is found by in its prompt: its longest line without a macro (SillyTavern runs its macros over
 * it after GENERATION_STARTED tells it, and NovelAI's form drops its brackets), or '' when no line of it is QUIET_MARK_MIN long.
 */
export function quietMark(text) {
    const pieces = String(text ?? '').split(/\{\{[\s\S]*?\}\}|<(?:USER|BOT|CHAR|CHARIFNOTGROUP|GROUP)>|[[\]\r\n]/i).map(piece => piece.trim());
    const best = pieces.reduce((longest, piece) => (piece.length > longest.length ? piece : longest), '');
    return best.length >= QUIET_MARK_MIN ? best : '';
}
