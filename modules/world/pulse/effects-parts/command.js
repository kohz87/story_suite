// The pulse's two commands: the roll for the reply being written and the quiet-scene flag.

import { slotValue, toSlot } from '../../../rpg/slot.js';
import { fightOn, foesLeftover, foesSignature } from '../../../cast/cast/entries.js';
import { ask, sceneOf } from '../../../time/tracker/scene.js';
import { drawsFrom } from '../tables.js';
import { STALE_REPLIES } from './limits.js';
import { TAIL_CHARS, BRIEF_CHARS, worldLine } from './lines.js';
import { skipReason, restedSince } from './skip.js';
import { isInt } from './shared-guards.js';
import { modeOf, settingsOf } from './settings.js';
import { RESULTS_MAX, resultsOf } from './results.js';
import { rollEntry } from './roll.js';

/** `director.pulse { at }` (cause `system`, from the hook; refused from a click): the roll for the reply being written, recorded. */
export function pulseCommand(ctx, payload = {}) {
    if (ctx?.cause === 'ui') return ctx.fail('REFUSED', 'The world pulse is rolled by Story Director itself.');
    const at = payload?.at;
    if (!(isInt(at) && at >= 0)) return ctx.fail('INVALID', 'director.pulse: "at" must be the chat\'s length (a whole number).');
    const mode = modeOf(settingsOf(ctx.settings));
    if (mode === 'off') return { summary: '', narrate: false, data: { skipped: 'off' } };
    const director = ctx.draft('director');
    const read = name => { try { return typeof ctx.read === 'function' ? ctx.read(name) : null; } catch { return null; } };
    const state = { domains: { director, scene: read('scene'), arc: read('arc'), cast: read('cast'), keypeople: read('keypeople'), dataModules: read('dataModules') } };
    const query = typeof ctx.query === 'function' ? (name, args) => ctx.query(name, args) : null;
    // The draws come first and always: a skip or a step-down never shifts them.
    const draw = drawsFrom(ctx.rng);
    const before = resultsOf(director).filter(entry => entry.at !== at);
    const v2 = payload?.pulse === 2;
    const recent = before.filter(entry => entry.kind && entry.kind !== 'SKIP').slice(-3);
    const clock = isInt(director.time?.minutes) ? director.time.minutes : null;
    const last = before.at(-1);
    const scene = sceneOf(query, state);
    // Only a step that carries `age` (every new reply) knows a leftover Foes slot; an older reply re-read keeps the rule it was written under.
    const foes = foesSignature(state);
    const stale = payload?.age === 1 && foesLeftover(state, before, STALE_REPLIES);
    const skipped = skipReason({
        fight: fightOn(query, state, { leanOn: !stale }), rested: restedSince(state, last?.clock, clock), quiet: slotValue(director.pulseQuiet)?.on === true, clock,
        jumpMinutes: isInt(last?.clock) && isInt(clock) ? clock - last.clock : null,
    });
    // A skipped reply still closes the rumours that are over (they would stay in the narrator's chronicle note otherwise).
    if (skipped && ask(query, 'chronicle.events', { open: true }, []).some(event => event?.rumour)) { try { ctx.call('chronicle.rumor', { at, expire: true }); } catch { /* the skip goes on */ } }
    const { cue = '', ...entry } = skipped ? { kind: 'SKIP', skipped, text: '' } : rollEntry({ ctx, director, state, query, scene, draw, at, clock, mode, reach: [1, 2, 3].includes(payload?.reach) ? payload.reach : 0, persona: typeof payload?.persona === 'string' ? payload.persona : '', v2, invents: settingsOf(ctx.settings).invents !== false, recent });
    director.pulse = toSlot({ results: [...before, { at, clock, ...entry, ...(payload?.age === 1 && foes ? { foes } : {}) }].slice(-RESULTS_MAX) });
    // The line rides the reply's own receipt as its [Happened] cue (a prelude: previewed for the prompt, stored with the generated reply), so
    // a swipe, a regenerate or a delete of the reply takes the roll and its effects back; a CALM or skipped roll tells nothing.
    const line = skipped || entry.kind === 'CALM' ? '' : worldLine(entry.brief ?? entry.text, entry.brief ? BRIEF_CHARS : TAIL_CHARS);
    // A chance meeting also carries the cast's cue for the person met: the prelude is previewed on the head state, which has no meeting yet.
    return { summary: cue && line ? `${line}\n${cue}` : line, narrate: Boolean(line), data: { keep: true, kind: entry.kind, ...(entry.d20 ? { d20: entry.d20 } : {}), ...(skipped ? { skipped } : {}) } };
}

/** `director.pulse.quiet { on }` (the reader's): the quiet-scene flag, a slot written whole; while it is on every reply is skipped. */
export function quietCommand(ctx, payload = {}) {
    if (typeof payload?.on !== 'boolean') return ctx.fail('INVALID', 'director.pulse.quiet takes { on: true | false }.');
    ctx.draft('director').pulseQuiet = toSlot({ on: payload.on });
    return { summary: payload.on ? 'Quiet scene: the world pulse rests.' : 'Quiet scene is over: the world pulse goes on.', narrate: false, data: { on: payload.on } };
}
