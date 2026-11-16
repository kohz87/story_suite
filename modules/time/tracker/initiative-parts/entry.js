// Story Director v2, tracker part (initiative): the initiative step, its beforeGenerate hook and its tail line.

import { toSlot } from '../../../rpg/slot.js';
import { INITIATIVE } from './config.js';
import { isInt } from './shared-guards.js';
import { cooldownOf, initiativeOn, settingsOf } from './settings.js';
import { cooling, pickFresh, pickOf } from './pick.js';
import { hashUnit, nextPick } from './draw.js';
import { initiativeCandidates } from './candidates.js';
import { initiativeLine } from './lines.js';

/**
 * `director.initiative { at }` (cause `system`, from the hook): the pick for the reply being written, drawn
 * with the receipt's seed, recorded whole. Refused from a click.
 */
export function initiativeCommand(ctx, payload = {}) {
    if (ctx?.cause === 'ui') return ctx.fail('REFUSED', 'Who takes the initiative is picked by Story Director itself.');
    const at = payload?.at ?? null;
    if (!(at === null || (isInt(at) && at >= 0))) return ctx.fail('INVALID', 'director.initiative: "at" must be the chat\'s length (a whole number).');
    const director = ctx.draft('director');
    const query = typeof ctx.query === 'function' ? (name, args) => ctx.query(name, args) : null;
    let scene = null;
    try { scene = typeof ctx.read === 'function' ? ctx.read('scene') : null; } catch { scene = null; }
    const settings = settingsOf(ctx.settings);
    const candidates = initiativeCandidates({ director, state: { domains: { scene } }, query, settings });
    const { round, chosen, recent } = nextPick(candidates, { pick: pickOf(director), cooldown: cooldownOf(settings), draw: ctx.rng() });
    // A slot, written whole (SPEC §2.2): nothing inside an earlier reply's pick is ever changed.
    director.initiative = toSlot({ at, round, key: chosen?.key ?? null, name: chosen?.name ?? null, recent });
    return {
        summary: chosen ? `Initiative for the next reply: ${chosen.name}.` : '',
        narrate: false,
        data: { keep: true, round, key: chosen?.key ?? null, name: chosen?.name ?? null },
    };
}

/** `beforeGenerate(view)`: `{ commands: [director.initiative] }` when there is a pick to make for this reply. */
export function initiativeHook(view) {
    const director = view?.state?.domains?.director;
    if (!director || !initiativeOn(view)) return undefined;
    const at = isInt(view?.chat?.length) ? view.chat.length : null;
    const pick = pickOf(director);
    if (at === null || pickFresh(pick, at)) return undefined;
    const settings = settingsOf(view.settings);
    const query = typeof view.query === 'function' ? view.query : null;
    const candidates = initiativeCandidates({ director, state: view.state, query, settings });
    // Someone could be picked, or someone is still cooling down (the rounds count replies while it matters).
    if (!candidates.length && !cooling(pick, (pick?.round ?? 0) + 1, cooldownOf(settings)).size) return undefined;
    return { commands: [{ type: INITIATIVE, payload: { at } }] };
}

/**
 * The tail's Initiative line for `view` ('' for none): the recorded pick when it is this reply's and that
 * person can still take the initiative; else (no hook ran) the same pick drawn with a hash of the head's rev.
 */
export function initiativeTail(view, { scene = null } = {}) {
    const state = view?.state;
    const director = state?.domains?.director;
    if (!director || !initiativeOn(view)) return '';
    const settings = settingsOf(view.settings);
    const query = typeof view.query === 'function' ? view.query : null;
    const candidates = initiativeCandidates({ director, state, query, settings, scene });
    const pick = pickOf(director);
    const at = isInt(view?.chat?.length) ? view.chat.length : null;
    if (pickFresh(pick, at)) return initiativeLine(candidates.find(entry => entry.key === pick.key) ?? null);
    if (!candidates.length) return '';
    const rev = isInt(state?.meta?.rev) ? state.meta.rev : 0;
    const { chosen } = nextPick(candidates, { pick, cooldown: cooldownOf(settings), draw: hashUnit(`initiative:${rev}:${director.turn?.n ?? 0}`) });
    return initiativeLine(chosen);
}
