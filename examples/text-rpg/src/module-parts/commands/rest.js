// `textRpg.rest`: a short rest restores stamina and mana; a full day also heals one health stage and ages injuries.
import { DOMAIN } from '../../domain/shape.js';
import { healDays } from '../../rules/healing.js';
import { requireActive } from '../active.js';
import { memberNamed, players } from '../members.js';

/** Payload: { kind: 'short' | 'day', member?: id or name (else everyone who plays) }. */
export function rest(ctx, payload = {}) {
    requireActive(ctx);
    const slice = ctx.draft(DOMAIN);
    const kind = payload?.kind === 'day' ? 'day' : payload?.kind === 'short' ? 'short' : null;
    if (!kind) ctx.fail('INVALID', 'Rest is short or a full day.');
    const named = payload.member === undefined ? null : memberNamed(slice, payload.member);
    if (payload.member !== undefined && !named) ctx.fail('NOT_FOUND', 'No such character on the sheet.');
    const who = (named ? [named] : players(slice)).map(member => slice.members[member.id]).filter(member => !member.companion);
    const now = Number.isInteger(ctx.time?.()) ? ctx.time() : 0;
    for (const member of who) {
        for (const pool of ['mp', 'sp']) ctx.absolute(DOMAIN, `/members/${member.id}/pools/${pool}/now`);
        member.pools.mp.now = member.pools.mp.max;
        member.pools.sp.now = member.pools.sp.max;
        if (kind === 'day') {
            member.pools.hp.now = healDays(member.pools.hp.now, member.pools.hp.max, 1);
            for (const injury of member.injuries) injury.heals = Math.max(0, injury.heals - 1440);
            member.injuries = member.injuries.filter(injury => injury.heals > now);
        }
    }
    return { summary: kind === 'day' ? 'A full day of rest.' : 'A short rest.', narrate: false, data: { kind, members: who.map(member => member.id) } };
}
