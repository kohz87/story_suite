// `textRpg.rest`: a short rest restores stamina and mana; a full day also heals one wound stage and ages injuries. Refused while a fight is still on (foes-fights.js blockingFoes).
import { DOMAIN } from '../../domain/shape.js';
import { requireActive } from '../active.js';
import { blockingFoes } from '../foes-fights.js';
import { memberNamed, players } from '../members.js';
import { restBlock, restMembers } from '../resting.js';

/** Payload: { kind: 'short' | 'day', member?: id or name (else everyone who plays) }. */
export function rest(ctx, payload = {}) {
    requireActive(ctx);
    const slice = ctx.draft(DOMAIN);
    const kind = payload?.kind === 'day' ? 'day' : payload?.kind === 'short' ? 'short' : null;
    if (!kind) ctx.fail('INVALID', 'Rest is short or a full day.');
    const block = restBlock(blockingFoes(slice, { sid: ctx.reply?.sid, index: ctx.reply?.index, entries: ctx.receipts(), now: ctx.time?.() ?? null }));
    if (block) ctx.fail('REFUSED', `No rest yet: ${block.why}. ${block.end}`);
    const named = payload.member === undefined ? null : memberNamed(slice, payload.member);
    if (payload.member !== undefined && !named) ctx.fail('NOT_FOUND', 'No such character on the sheet.');
    const members = restMembers(ctx, (named ? [named] : players(slice)).map(member => slice.members[member.id]), { day: kind === 'day' });
    return { summary: kind === 'day' ? 'A full day of rest.' : 'A short rest.', narrate: false, data: { kind, members } };
}
