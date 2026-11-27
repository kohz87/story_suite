// What every kind's line starts with: Text RPG must be active, and the line names a member of the draft.
import { DOMAIN } from '../../domain/shape.js';
import { requireActive } from '../active.js';
import { memberNamed } from '../members.js';
import { woundsOf } from '../standing.js';

/** `{ slice, member }` from the domain draft for the line's name; `acts: true` also refuses a member who is Down or fallen. */
export function target(ctx, line, { acts = false } = {}) {
    requireActive(ctx);
    const slice = ctx.draft(DOMAIN);
    const member = memberNamed(slice, line.name);
    if (!member) ctx.fail('NOT_FOUND', `No character called ${String(line.name).slice(0, 40)}.`);
    if (member.fallen) ctx.fail('REFUSED', `${member.name} has fallen.`);
    if (acts && !member.companion && woundsOf(member) >= 5) ctx.fail('REFUSED', `${member.name} is Down and cannot act.`);
    return { slice, member };
}
