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
        // The first call's accepted answers and its call are kept (the call that could not be made is not counted); the refused slots are asked again on a later reply.
        if (second.error && TRANSIENT.has(second.error)) return { results, calls: calls - 1 };
        for (const slot of again) {
            const judged = second.error ? { errors: [] } : judge(slot, second.answers);
            results[slot.key] = judged.answer ? { outcome: 'retry', answer: keep(judged.answer) } : { outcome: 'fallback', why: 'its answer was refused twice' };
        }
    }
    return { results, calls };
}

/** The chat a hook is in: the host's chat id (when it has one) and the campaign seed, so one chat's answers never reach another's ledger. */
export function scopeOf(view, seed = '') {
    let id = '';
    try { id = view?.chatId?.() ?? globalThis.SillyTavern?.getContext?.()?.getCurrentChatId?.() ?? ''; } catch { id = ''; }
    return `${typeof id === 'string' ? id : ''}|${seed ?? ''}`;
}

const SCOPES = 3;

/** The asker: `kick(view, input, slots)` starts a batch for the slots not yet asked; `drain(scope, stored, wanted)` the finished answers of that chat not stored yet.
 * What is kept is per chat scope (`scopeOf`): a chat's answers and calls are only ever handed to that chat, and only the last few scopes are kept. */
export function createOpenAsker() {
    const scopes = new Map();
    const scopeState = scope => {
        let found = scopes.get(scope);
        if (!found) {
            found = { held: new Map(), owed: 0 };
            scopes.set(scope, found);
        }
        scopes.delete(scope);
        scopes.set(scope, found);
        while (scopes.size > SCOPES) scopes.delete(scopes.keys().next().value);
        return found;
    };
    return {
        /** `input`: { state, table, world, seed, marks }; `slots`: [{ key, day, template, place, region, realm }]. Never awaits the call. */
        kick(view, input, slots) {
            if (typeof view?.model?.callModel !== 'function') return 0;
            const mine = scopeState(scopeOf(view, input.seed));
            const { held } = mine;
            const fresh = slots.filter(slot => !held.has(slot.key) && !(slot.key in (input.opens?.results ?? {}))).slice(0, BATCH);
            if (!fresh.length) return 0;
            for (const slot of fresh) held.set(slot.key, { status: 'pending' });
            Promise.resolve().then(() => runBatch({ view, input, slots: fresh })).then(done => {
                for (const slot of fresh) {
                    const result = done?.results[slot.key];
                    if (result) held.set(slot.key, { status: 'done', result });
                    else held.delete(slot.key);
                }
                if (done) mine.owed += done.calls;
            }, () => { for (const slot of fresh) held.delete(slot.key); });
            while (held.size > KEEP) held.delete(held.keys().next().value);
            return fresh.length;
        },
        /** `{ results, calls }` of this scope's answers done, not in `stored` (the ledger's results) and, when `wanted` (a set of keys) is given, among the slots wanted;
         * the calls made are counted once; null when none. */
        drain(scope, stored = {}, wanted = null) {
            const mine = scopes.get(scope);
            if (!mine) return null;
            const results = {};
            for (const [key, entry] of mine.held) if (entry.status === 'done' && entry.result && !(key in stored) && (!wanted || wanted.has(key))) results[key] = entry.result;
            if (!Object.keys(results).length) return null;
            const calls = mine.owed;
            mine.owed = 0;
            return { results, calls };
        },
        /** Whether any slot is being asked (tests). */
        pending: () => [...scopes.values()].some(mine => [...mine.held.values()].some(entry => entry.status === 'pending')),
        clear() { scopes.clear(); },
    };
}

/** The one asker of this module (in memory). */
export const openAsker = createOpenAsker();
