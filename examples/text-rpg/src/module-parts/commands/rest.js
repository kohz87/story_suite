// `textRpg.rest`: a short rest restores stamina and mana; a full day also heals one wound stage and ages injuries.
import { DOMAIN } from '../../domain/shape.js';
import { INJURY_DAYS } from '../../rules/healing.js';
import { requireActive } from '../active.js';
import { gearOf } from '../gear.js';
import { poolWith } from '../gear-sizes.js';
import { memberNamed, players } from '../members.js';
import { woundsOf } from '../standing.js';

/** Payload: { kind: 'short' | 'day', member?: id or name (else everyone who plays) }. */
export function rest(ctx, payload = {}) {
    requireActive(ctx);
    const slice = ctx.draft(DOMAIN);
    const kind = payload?.kind === 'day' ? 'day' : payload?.kind === 'short' ? 'short' : null;
    if (!kind) ctx.fail('INVALID', 'Rest is short or a full day.');
    const named = payload.member === undefined ? null : memberNamed(slice, payload.member);
    if (payload.member !== undefined && !named) ctx.fail('NOT_FOUND', 'No such character on the sheet.');
    const who = (named ? [named] : players(slice)).map(member => slice.members[member.id]).filter(member => !member.companion);
    const known = Number.isInteger(ctx.time?.());
    const now = known ? ctx.time() : 0;
    for (const member of who) {
        for (const pool of ['mp', 'sp']) ctx.absolute(DOMAIN, `/members/${member.id}/pools/${pool}/now`);
        const { cap } = gearOf(ctx.query, member);
        member.pools.mp.now = poolWith(member, 'mp', cap).max;
        member.pools.sp.now = poolWith(member, 'sp', cap).max;
        if (kind === 'day') {
            // A change on the counter (not a value from the clamped read); a day's rest also clears the Down mark.
            if (woundsOf(member) > 0) member.wounds -= 1;
            ctx.absolute(DOMAIN, `/members/${member.id}/down`);
            member.down = false;
            // An injury made with no clock has no end time (null); the first day's rest with a clock starts its count.
            for (const injury of member.injuries) injury.heals = injury.heals === null && !known ? null : Math.max(0, (injury.heals ?? now + INJURY_DAYS[injury.grave] * 1440) - 1440);
            member.injuries = member.injuries.filter(injury => injury.heals === null || injury.heals > now);
        }
    }
    return { summary: kind === 'day' ? 'A full day of rest.' : 'A short rest.', narrate: false, data: { kind, members: who.map(member => member.id) } };
}
