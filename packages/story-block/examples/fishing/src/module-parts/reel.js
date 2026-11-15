// Ending a line: reel it in (landing or losing the fish) or put a logged catch back.
import { catchNote, landedLine, lostLine, releasedLine } from '../rules.js';
import { LOG_SIZE } from './constants.js';
import { idFrom, anglerName } from './shared-ask.js';
import { stackOf, prune } from './shared-session.js';

export function reel(ctx, payload = {}) {
    if (typeof payload.hooked !== 'boolean') ctx.fail('INVALID', 'Say whether the fish was hooked.');
    const fishing = ctx.draft('fishing');
    const session = fishing.sessions[payload.session];
    if (!session) ctx.fail('NOT_FOUND', 'There is no line in the water.');
    if (session.status !== 'waiting' || !ctx.claim(`fishing:${session.id}:reeled`)) {
        ctx.fail('CLAIMED', 'That line has already been reeled in.');
    }
    const who = anglerName(ctx);
    const where = session.spot.name;

    if (!payload.hooked) {
        session.status = 'lost';
        prune(fishing);
        return { summary: lostLine(who, where), narrate: true, data: { session: session.id, landed: false } };
    }

    const fish = session.catch;
    const result = ctx.call('inventory.grant', {
        def: { name: fish.name, kind: 'goods', rarity: fish.rarity, value: fish.value, note: catchNote(fish, where) },
        qty: 1,
        owner: 'party',
    });
    const stack = stackOf(ctx, result, fish.name, { receipt: ctx.receiptId });
    const entry = {
        id: idFrom('fc', ctx.receiptId), session: session.id, ...fish, spot: session.spot,
        stack: stack?.id ?? null, def: stack?.def ?? null, released: false,
    };
    fishing.log.push(entry);
    if (fishing.log.length > LOG_SIZE) fishing.log.splice(0, fishing.log.length - LOG_SIZE);
    session.status = 'landed';
    prune(fishing);
    return { summary: landedLine(who, fish, where), narrate: true, data: { session: session.id, landed: true, catch: entry } };
}

export function release(ctx, payload = {}) {
    const fishing = ctx.draft('fishing');
    const entry = fishing.log.find(e => e.id === payload.catch);
    if (!entry) ctx.fail('NOT_FOUND', 'That catch is not in the fishing log.');
    if (entry.released || !ctx.claim(`fishing:${entry.id}:released`)) {
        ctx.fail('CLAIMED', `The ${entry.name.toLowerCase()} is already back in the water.`);
    }
    const stack = stackOf(ctx, null, entry.name, { stack: entry.stack, def: entry.def });
    if (!stack) ctx.fail('NOT_FOUND', `There is no ${entry.name.toLowerCase()} left in the pack to let go.`);
    ctx.call('inventory.consume', { stack: stack.id, qty: 1 });
    entry.released = true;
    return {
        summary: releasedLine(anglerName(ctx), entry, entry.spot.name),
        narrate: true,
        data: { catch: entry.id, stack: stack.id },
    };
}
