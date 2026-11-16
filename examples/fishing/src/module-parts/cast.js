// Casting a line: choosing the spot, then opening a session whose seed decides the fish and the bite.
import { WATERS, decideCatch, decideBite, spotFromPlace, waterOf } from '../rules.js';
import { maybeQuery, idFrom, anglerName } from './shared-ask.js';
import { prune, waitingOf } from './shared-session.js';

// The spot asked for: { name, kind }, a bare name whose words say the water, or null.
export function normalizeSpot(spot) {
    if (typeof spot === 'string') spot = { name: spot };
    if (!spot || typeof spot !== 'object') return null;
    const name = String(spot.name ?? '').trim().slice(0, 80);
    const kind = WATERS.includes(spot.kind) ? spot.kind : waterOf(name);
    if (!kind) return null;
    return { name: name || `the ${kind}`, kind };
}

export function cast(ctx, payload = {}) {
    const spot = normalizeSpot(payload.spot) ?? spotFromPlace(maybeQuery(ctx, 'scene.place'));
    if (!spot) ctx.fail('INVALID', 'Pick a river, a lake or the sea to fish in.');
    const bait = payload.bait == null || payload.bait === '' ? null : String(payload.bait).trim().slice(0, 40) || null;
    const fishing = ctx.draft('fishing');
    const open = waitingOf(fishing);
    if (open) ctx.fail('INVALID', `There is already a line in the water at ${open.spot.name}. Reel it in first.`);

    // The whole catch, then the bite, from this receipt's seed.
    const fish = decideCatch(ctx.rng, spot.kind);
    const bite = decideBite(ctx.rng, fish.rarity);
    const id = idFrom('fs', ctx.receiptId);
    const n = 1 + Object.values(fishing.sessions).reduce((max, s) => Math.max(max, s.n), 0);
    const rev = maybeQuery(ctx, 'fishing.rev');
    const startedRev = Number.isInteger(rev) ? rev : null;
    fishing.sessions[id] = { id, spot, bait, startedRev, status: 'waiting', n, bite, catch: fish };
    prune(fishing);
    return {
        summary: `${anglerName(ctx)} casts a line at ${spot.name}.`,
        narrate: false,
        data: { session: id, spot, bite: bite.bite, window: bite.window },
    };
}
