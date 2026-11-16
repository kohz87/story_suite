// Story Director v2, chronicle part: beforeGenerate and tail context hooks.

import { backlogCue, backlogOlder, digestCommands, digestTailLine, noteCommands } from '../digest.js';
import { chronicleTail } from '../note.js';
import { beforeGenerate as surfaceHook } from '../pick.js';
import { threadsOn } from '../../threads.js';

/**
 * `beforeGenerate(view)`: the last reply's day facts, the digest when a day ended, then the world events' pick (while the threads feature is on);
 * and the [Earlier days] block as a pinned cue (it is kept whatever the tail budget says, and its sentence goes with it).
 */
export function beforeGenerate(view) {
    const commands = [...noteCommands(view), ...digestCommands(view), ...(threadsOn(view) ? surfaceHook(view)?.commands ?? [] : [])];
    const lines = backlogCue(view);
    return commands.length || lines.length ? { ...(commands.length ? { commands } : {}), ...(lines.length ? { lines } : {}) } : undefined;
}

/** `context.tail(view)`: the [World] lines (while the threads feature is on) and the last day's line after a time skip (optional). The [Earlier days] cue is pinned (beforeGenerate); its older day lines are optional. */
export function tail(view) {
    const out = threadsOn(view) ? chronicleTail(view) : { lines: [], optional: [] };
    const optional = [...out.optional, digestTailLine(view), ...backlogOlder(view)].filter(Boolean);
    return optional.length ? { lines: out.lines, optional } : out;
}
