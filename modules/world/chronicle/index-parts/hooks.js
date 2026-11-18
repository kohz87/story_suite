// Story Director v2, chronicle part: beforeGenerate and tail context hooks.

import { conditionsSettleCommands } from '../conditions/settle.js';
import { backlogCue, backlogOlder, digestCommands, digestTailLine, noteCommands } from '../digest.js';
import { chronicleTail } from '../note.js';
import { worldEventsOn, worldNote } from '../world-note.js';
import { beforeGenerate as surfaceHook } from '../pick.js';
import { threadsOn } from '../../../time/tracker/threads.js';
import { worldSeedCommands } from '../world-daily/seed.js';
import { openBeforeGenerate } from '../world-daily/open-store.js';
import { openLoreLines } from '../world-daily/lore-open.js';

/**
 * `beforeGenerate(view)`: the last reply's day facts, the digest when a day ended, then the world events' pick (while the threads feature is on);
 * and the [Earlier days] block as a pinned cue (it is kept whatever the tail budget says, and its sentence goes with it).
 */
export function beforeGenerate(view) {
    const commands = [...worldSeedCommands(view), ...openBeforeGenerate(view), ...noteCommands(view), ...digestCommands(view), ...conditionsSettleCommands(view), ...(threadsOn(view) ? surfaceHook(view)?.commands ?? [] : [])];
    const lines = backlogCue(view);
    return commands.length || lines.length ? { ...(commands.length ? { commands } : {}), ...(lines.length ? { lines } : {}) } : undefined;
}

/**
 * `context.tail(view)`: the [World] lines (while the threads feature is on) and the last day's line after a time skip (optional). The [Earlier days] cue is pinned (beforeGenerate); its older day lines are optional.
 * With the world-events switch on the world note takes the [World] lines' place (seam audit E23: the same news, pinned first), and the
 * hidden lore that has opened (lore-open.js, at most two capped lines) is the last optional line; off adds nothing.
 */
export function tail(view) {
    const on = worldEventsOn(view);
    const base = threadsOn(view) && !on ? chronicleTail(view) : { lines: [], optional: [] };
    const note = on ? worldNote(view) : [];
    const out = note.length ? { ...base, lines: [...note, ...base.lines] } : base;
    // The open hidden lore is optional and last of this part: it takes only the room left, and a tight tail cuts it before any required line.
    const optional = [...out.optional, digestTailLine(view), ...backlogOlder(view), ...(on ? openLoreLines(view) : [])].filter(Boolean);
    return optional.length ? { lines: out.lines, optional } : out;
}
