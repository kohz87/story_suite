// Story Director v2, part **arc**: asking the Director judge about the story's new world entries (switch story-director.world-events; the chronicle
// setting `judge` marks them). One batched Quick call for up to 4 entries, in the background after a reply, never awaited by a reply. A call that
// could not be made now (busy, aborted, no model) is not an answer: the entry is asked again later. A call that ran out of time is asked once more;
// a failed call or an answer that does not read is recorded as `fell` (the line's own result stands), so it is never asked again. The answers are
// kept in memory per chat until the chat shows them stored by the store command (`chronicle.world.judged`, world-judge.js hooks); replay reads only what is stored.

import { judgeContext } from './context.js';
import { readJudge } from './read.js';
import { scrubJudge } from './scrub.js';
import { WORLD_JUDGE_SYSTEM, worldItemLine, worldJudgePrompt } from './world-prompt.js';

const FEATURE = 'story-director.world-events';
const MODULE = 'story-director world judge';
const TRANSIENT = new Set(['BUSY', 'ABORTED', 'UNAVAILABLE', 'FEATURE_OFF']);
const BATCH = 4;
const KEEP = 32;
const GIVE_UP = 4;
const SCOPES = 3;
const CALL_MS = 20000;
const MAX_TOKENS = 300;

const askOf = view => (name, args) => { try { return typeof view?.query === 'function' ? view.query(name, args) : null; } catch { return null; } };

/** Asks about `items` ([{ id, key, name, summary, place, conditions }]) → `{ results: { id: { key, verdict, why?, line? } }, calls }`, or null (ask later). */
async function runBatch(view, items) {
    const ask = askOf(view);
    const brief = ask('chronicle.world.brief', {});
    const place = String(ask('scene.place', {})?.name ?? '');
    const request = {
        role: 'quick', module: MODULE, feature: FEATURE, system: WORLD_JUDGE_SYSTEM, maxTokens: MAX_TOKENS, timeoutMs: CALL_MS,
        prompt: worldJudgePrompt({ world: judgeContext({ brief: brief ?? {}, ask, place }), lines: items.map(worldItemLine) }),
    };
    let calls = 0;
    let out = null;
    for (let tries = 0; tries < 2; tries += 1) {
        calls += 1;
        try { out = await view.model.callModel(request); } catch { out = { ok: false, error: 'FAILED' }; }
        if (out?.ok || out?.error !== 'TIMEOUT') break;
    }
    if (!out?.ok && TRANSIENT.has(out?.error)) return calls > 1 ? { results: {}, calls: calls - 1 } : null;
    const answer = out?.ok ? scrubJudge(readJudge(out.text), brief?.secrets) : null;
    const results = {};
    items.forEach((item, index) => {
        const row = answer?.items?.[index + 1];
        if (!row) results[item.id] = { key: item.key, verdict: 'fell' };
        else if (row.verdict === 'refuse') results[item.id] = { key: item.key, verdict: 'refuse', why: row.rest };
        else if (row.verdict === 'reshape') results[item.id] = { key: item.key, verdict: 'reshape', line: row.rest };
        else results[item.id] = { key: item.key, verdict: 'accept' };
    });
    return { results, calls };
}

/** The chat a hook is in (the host's chat id), so one chat's verdicts never reach another's. */
export function judgeScope(view) {
    try { return String(view?.chatId?.() ?? globalThis.SillyTavern?.getContext?.()?.getCurrentChatId?.() ?? ''); } catch { return ''; }
}

/** The asker: `kick(view, items)` starts a batch for the entries not asked yet; `drain(scope, wanted)` the finished verdicts of that chat for the wanted `id|key`s.
 * A drain does not take a verdict away: it is offered again until the chat shows it stored (the host drops the command of a swipe, a Continue or a
 * late hook); a verdict whose entry is no longer wanted is dropped. An entry whose asks keep failing for a transient reason is given up after GIVE_UP
 * tries and stored as `fell` (the line's own result stands), so it is not rumour for ever. */
export function createWorldJudgeAsker() {
    const scopes = new Map();
    const scopeState = scope => {
        const found = scopes.get(scope) ?? { held: new Map(), owed: 0, fails: new Map() };
        scopes.delete(scope);
        scopes.set(scope, found);
        while (scopes.size > SCOPES) scopes.delete(scopes.keys().next().value);
        return found;
    };
    return {
        kick(view, items) {
            if (typeof view?.model?.callModel !== 'function') return 0;
            const mine = scopeState(judgeScope(view));
            const fresh = items.filter(item => !mine.held.has(`${item.id}|${item.key}`)).slice(0, BATCH);
            if (!fresh.length) return 0;
            for (const item of fresh) mine.held.set(`${item.id}|${item.key}`, { status: 'pending' });
            const failed = item => {
                const hold = `${item.id}|${item.key}`;
                const count = (mine.fails.get(hold) ?? 0) + 1;
                mine.fails.delete(hold);
                mine.fails.set(hold, count);
                while (mine.fails.size > KEEP) mine.fails.delete(mine.fails.keys().next().value);
                if (count >= GIVE_UP) mine.held.set(hold, { status: 'done', id: item.id, result: { key: item.key, verdict: 'fell' }, batch: { calls: 0 } });
                else mine.held.delete(hold);
            };
            Promise.resolve().then(() => runBatch(view, fresh)).then(done => {
                for (const item of fresh) {
                    const result = done?.results[item.id];
                    if (result) mine.held.set(`${item.id}|${item.key}`, { status: 'done', id: item.id, result, batch: done });
                    else failed(item);
                }
                if (done && !Object.keys(done.results).length) mine.owed += done.calls;
            }, () => { for (const item of fresh) failed(item); });
            while (mine.held.size > KEEP) mine.held.delete(mine.held.keys().next().value);
            return fresh.length;
        },
        drain(scope, wanted) {
            const mine = scopes.get(scope);
            if (!mine) return null;
            const results = {};
            const batches = new Set();
            for (const [hold, entry] of mine.held) {
                if (entry.status !== 'done') continue;
                if (!wanted.has(hold)) { mine.held.delete(hold); continue; }
                results[entry.id] = entry.result;
                batches.add(entry.batch);
            }
            if (!Object.keys(results).length) return null;
            const calls = [...batches].reduce((sum, batch) => sum + (batch?.calls ?? 0), 0) + mine.owed;
            mine.owed = 0;
            return { results, calls };
        },
        pending: () => [...scopes.values()].some(mine => [...mine.held.values()].some(entry => entry.status === 'pending')),
        clear() { scopes.clear(); },
    };
}

/** The one asker of this module (in memory). */
export const worldJudgeAsker = createWorldJudgeAsker();
