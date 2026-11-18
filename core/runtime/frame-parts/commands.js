// The chat frame's commands: `packs.frame` writes it (the beforeGenerate hook's, from what it resolved), `packs.frameTold` marks the update note given,
// and `packs.frameUse` (the reader's "Use the current game in this chat") asks for the next reply to write it again.

import { frameProblem, initialFrame } from './shape.js';

const REFUSED = 'The chat frame is written by Story Block itself.';

/** `packs.frame { world, game, calendar, currency }` (system): the frame of this chat; refused when one is written and not asked for again. */
export function writeFrame(ctx, payload) {
    if (ctx.cause !== 'system') return ctx.fail('REFUSED', REFUSED);
    const problem = frameProblem(payload);
    if (problem) return ctx.fail('INVALID', problem);
    const slice = ctx.draft('frame');
    if (slice.set === true && slice.refresh !== true) return ctx.fail('REFUSED', 'This chat already has its frame.');
    Object.assign(slice, initialFrame(), structuredClone(payload), { set: true });
    return { summary: 'The chat frame was written.', narrate: false };
}

/** `packs.frameTold { key }` (system): the update note for `key` was given, so it is not given again. */
export function tellFrame(ctx, payload) {
    if (ctx.cause !== 'system') return ctx.fail('REFUSED', REFUSED);
    if (!payload || typeof payload !== 'object' || typeof payload.key !== 'string' || payload.key.length === 0 || payload.key.length > 1000) return ctx.fail('INVALID', 'packs.frameTold takes { key }.');
    const slice = ctx.draft('frame');
    if (slice.set !== true) return ctx.fail('REFUSED', 'This chat has no frame.');
    slice.told = payload.key;
    return { summary: 'The chat frame\'s update note was given.', narrate: false };
}

/** `packs.frameUse {}` (the reader): the next reply writes the frame again from the world and game selected then. */
export function useFrame(ctx) {
    if (ctx.cause !== 'ui') return ctx.fail('REFUSED', 'Only the reader asks for the current game in this chat.');
    const slice = ctx.draft('frame');
    if (slice.set !== true) return ctx.fail('REFUSED', 'This chat has no frame yet: it is written with the first reply.');
    slice.refresh = true;
    return { summary: 'The next reply will use the current game in this chat.', narrate: false };
}
