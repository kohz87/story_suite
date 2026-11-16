// Captures the story's `+ mount` / `~ mount` / `- mount` lines.

import { labelOf } from '../common.js';
import { cleanName } from '../names.js';
import { STRINGS, fill } from '../../../../../../core/strings.js';
import { MAX_NAME, MAX_KIND, MAX_CONDITION, MAX_WHERE } from './caps-text.js';
import { MAX_COUNT, MAX_PACE } from './caps-count.js';
import { textOf, whole, paceNumber } from './shared-parse.js';
import { apply, remove } from './apply.js';

const M = STRINGS.mounts;

/**
 * `+ mount Grey Mare | kind: horse | count: 1 | pace: 35 | where: ridden by Wessel` (a mount the party gets; one already
 * here is updated by what the line gives), `~ mount Burr | condition: lame | where: stabled at the Stray Oar`, `- mount Burr`.
 * A missing pace takes the kind's usual one. A seventh row is refused.
 */
export function captureMount(ctx, line) {
    const name = cleanName(line?.name);
    if (!name) ctx.fail('INVALID', M.needName);
    if (Array.from(name).length > MAX_NAME) ctx.fail('INVALID', fill(M.longName, { max: MAX_NAME }));
    if (line.op === '-') return remove(ctx, name);
    if (line.op !== '+' && line.op !== '~') ctx.fail('INVALID', fill(M.badOp, { op: line.op }));
    const notes = [];
    const kind = textOf(labelOf(line, 'kind', 'type'), MAX_KIND);
    const fields = {
        kind,
        count: whole(ctx, labelOf(line, 'count', 'qty', 'quantity'), 'count', MAX_COUNT, notes),
        pace: whole(ctx, labelOf(line, 'pace', 'speed'), 'pace', MAX_PACE, notes, paceNumber),
        condition: textOf(labelOf(line, 'condition', 'state'), MAX_CONDITION),
        where: textOf(labelOf(line, 'where', 'at', 'with'), MAX_WHERE),
    };
    // `~` names a mount the party has; `+` makes it when it is new and updates it when it is not.
    return apply(ctx, { ...fields, match: name }, { create: line.op === '+', notes });
}
