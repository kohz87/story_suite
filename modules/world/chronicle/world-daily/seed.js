// World events, the daily step on the host: the campaign seed (seam audit E19). Before the first reply is written with the
// world-events switch on, code mints the seed once per line of history (claim `world:seed`) into `chronicle.worldSeed`. A
// beforeGenerate step is stored on the message before the reply, so swiping or Re-reading the reply that first crosses a
// day keeps the seed (and so the rolls of every day). The daily step reads it (command.js); a step's own state keeps it too.

import { worldEventsOn } from '../capture/world-parts/switch.js';
import { worldEventsOn as switchOn, WORLD_EVENTS_FEATURE } from '../conditions/feature.js';

export const WORLD_SEED = 'chronicle.world.seed';
const WORLD_SEED_CLAIM = 'world:seed';
const HEX = /^[0-9a-f]{16}$/;

/** Whether `value` is a minted campaign seed (16 hex digits). */
export const isWorldSeed = value => typeof value === 'string' && HEX.test(value);

function mint(ctx) {
    if (ctx.cause !== 'system' || ctx.caller) return ctx.fail('REFUSED', 'The world\'s seed is drawn by code before a reply.');
    if (!worldEventsOn(ctx)) return ctx.fail('REFUSED', 'World events are off.');
    const chronicle = ctx.draft('chronicle');
    if (isWorldSeed(chronicle.worldSeed) || !ctx.claim(WORLD_SEED_CLAIM)) return ctx.fail('CLAIMED', 'The world already has its seed.');
    let seed = '';
    for (let i = 0; i < 16; i += 1) seed += Math.floor(ctx.rng() * 16).toString(16);
    chronicle.worldSeed = seed;
    return { summary: '', narrate: false, data: { seed } };
}

/** The command, tagged with the feature (refused while the switch is off) and internal (never from a click or the sdk). */
export const worldSeedCommand = Object.assign(mint, { feature: WORLD_EVENTS_FEATURE });
Object.defineProperty(worldSeedCommand, 'internal', { value: true, enumerable: true });

/** beforeGenerate: `[chronicle.world.seed]` while the switch is on and this line of history has no seed yet; else []. */
export function worldSeedCommands(view) {
    if (!switchOn(view)) return [];
    const state = view?.state;
    if (isWorldSeed(state?.domains?.chronicle?.worldSeed) || Object.hasOwn(state?.meta?.claims ?? {}, WORLD_SEED_CLAIM)) return [];
    return [{ type: WORLD_SEED, payload: {} }];
}
