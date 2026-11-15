// Story Director v2, chronicle part: the pinned [Earlier days] cue and the older day lines. Pure.

import { cut } from '../days.js';
import { BACKLOG_STATIC, backlogLines } from './backlog-lines.js';

/** The pinned cue is the sentence plus the newest day's line, about 80 tokens (Story Block counts four characters a token). */
export const BACKLOG_PIN_CHARS = 320;

/**
 * The [Earlier days] cue as one pinned text (`{ text, keep: true }`, from `beforeGenerate`): the explaining sentence, the tag and the newest day's
 * line, together at most BACKLOG_PIN_CHARS, so they stand or fall together and the static prompt never changes mid-chat. A pinned cue is kept
 * whatever the host's tail budget says, so it is small: it costs every other section its size under a tight budget. The older day lines are
 * ordinary optional tail lines (`backlogOlder`), cut first as before. `[]` when the block has no lines.
 */
export function backlogCue(view) {
    const lines = backlogLines(view);
    if (lines.length < 2) return [];
    const head = `${BACKLOG_STATIC}\n${lines[0]}\n`;
    return [{ text: `${head}${cut(lines[1], Math.max(0, BACKLOG_PIN_CHARS - head.length))}`, keep: true }];
}

/** The day lines after the newest one: optional tail lines (the budget drops them first), each dated, so one needs no tag. */
export function backlogOlder(view) {
    return backlogLines(view).slice(2);
}
