// World events, open templates on the host (spec §5, §9): asking the Director for the slots the step rolled or will roll, in the background,
// on the Quick profile. One batched call for up to 4 slots; a refused answer gets one retry with its errors; a failed call or a second refusal
// is the template's fallback. A call that could not be made now (busy, aborted, no model) is not an answer: the slot is asked again later.
// The answers are kept in memory only so a slot is not asked twice while a call is in flight; they reach the chat through the store command
// (open-store.js); an answer is kept as JSON text (the state's id rules read the key "id" inside it) in the next reply's beforeGenerate, and the daily step reads only what is stored there. A retry counts as a call.

import { makeWs } from '../../daily/step.js';
import { checkOpen } from '../../daily/open-check.js';
import { BATCH } from '../../daily/open-slot.js';
import { OPEN_SYSTEM, openPrompt, readOpenAnswer, slotBlock } from './open-prompt.js';
import { loreText, slotView } from './open-context.js';

export const OPEN_FEATURE = 'story-director.world-events';
const MODULE = 'story-director open templates';
const TRANSIENT = new Set(['BUSY', 'ABORTED', 'UNAVAILABLE', 'FEATURE_OFF']);
const MAX_TOKENS = 1200;
const CALL_MS = 40000;
const KEEP = 64;
const MAX_ANSWER = 3000;

/** Asks, retries once and settles a batch → `{ results: { key: { outcome, answer?, why? } }, calls }`, or null when no call could be made now. */
async function runBatch({ view, input, slots }) {
    const { ws } = makeWs({ ...input, today: Math.max(...slots.map(slot => slot.day)) });
    const lore = loreText((name, args) => view.query(name, args), slots, input.world);
    const blocks = new Map(slots.map(slot => [slot.key, slotBlock(slot, slotView(ws, ws.templates.get(slot.template), slot, input.world))]));
    let calls = 0;
    const ask = async (list, errors) => {
        calls += 1;
        const request = { role: 'quick', module: MODULE, feature: OPEN_FEATURE, system: OPEN_SYSTEM, prompt: openPrompt({ blocks: list.map(slot => blocks.get(slot.key)), lore, errors }), maxTokens: MAX_TOKENS, timeoutMs: CALL_MS };
        const out = await view.model.callModel(request);
        return out?.ok ? { answers: readOpenAnswer(out.text) } : { error: out?.error ?? 'FAILED' };
    };
    const judge = (slot, answers) => {
        const def = ws.templates.get(slot.template);
        const answer = answers?.[slot.key];
        if (!answer) return { errors: ['No answer for this slot.'] };
        const checked = checkOpen(ws, def, { place: slot.place, region: slot.region || null, realm: slot.realm }, answer, slot.day);
        return checked.errors.length ? { errors: checked.errors } : { answer };
    };
    const results = {};
    const first = await ask(slots);
    if (first.error && TRANSIENT.has(first.error)) return null;
    if (first.error) {
        for (const slot of slots) results[slot.key] = { outcome: 'fallback', why: 'the Director did not answer' };
        return { results, calls };
    }
    const refused = {};
    const keep = answer => JSON.stringify(answer).slice(0, MAX_ANSWER);
    for (const slot of slots) {
        const judged = judge(slot, first.answers);
        if (judged.answer) results[slot.key] = { outcome: 'ok', answer: keep(judged.answer) };
        else refused[slot.key] = judged.errors;
    }
    if (Object.keys(refused).length) {
        const again = slots.filter(slot => refused[slot.key]);
        const second = await ask(again, refused);
        if (second.error && TRANSIENT.has(second.error)) return null;
        for (const slot of again) {
            const judged = second.error ? { errors: [] } : judge(slot, second.answers);
            results[slot.key] = judged.answer ? { outcome: 'retry', answer: keep(judged.answer) } : { outcome: 'fallback', why: 'its answer was refused twice' };
        }
    }
    return { results, calls };
}

/** The asker: `kick(view, input, slots)` starts a batch for the slots not yet asked; `drain(stored)` the finished answers not stored yet. */
export function createOpenAsker() {
    const held = new Map();
    let owed = 0;
    return {
        /** `input`: { state, table, world, seed, marks }; `slots`: [{ key, day, template, place, region, realm }]. Never awaits the call. */
        kick(view, input, slots) {
            if (typeof view?.model?.callModel !== 'function') return 0;
            const fresh = slots.filter(slot => !held.has(slot.key) && !(slot.key in (input.opens?.results ?? {}))).slice(0, BATCH);
            if (!fresh.length) return 0;
            for (const slot of fresh) held.set(slot.key, { status: 'pending' });
            Promise.resolve().then(() => runBatch({ view, input, slots: fresh })).then(done => {
                for (const slot of fresh) {
                    if (done) held.set(slot.key, { status: 'done', result: done.results[slot.key] });
                    else held.delete(slot.key);
                }
                if (done) owed += done.calls;
            }, () => { for (const slot of fresh) held.delete(slot.key); });
            while (held.size > KEEP) held.delete(held.keys().next().value);
            return fresh.length;
        },
        /** `{ results, calls }` of the answers done and not in `stored` (the ledger's results); the calls made are counted once; null when none. */
        drain(stored = {}) {
            const results = {};
            for (const [key, entry] of held) if (entry.status === 'done' && entry.result && !(key in stored)) results[key] = entry.result;
            if (!Object.keys(results).length) return null;
            const calls = owed;
            owed = 0;
            return { results, calls };
        },
        /** Whether any slot is being asked (tests). */
        pending: () => [...held.values()].some(entry => entry.status === 'pending'),
        clear() { held.clear(); owed = 0; },
    };
}

/** The one asker of this module (in memory). */
export const openAsker = createOpenAsker();
