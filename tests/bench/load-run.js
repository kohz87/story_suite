// The storage benchmark's run (tests/bench/load.js): sends replies fast through a testkit host and drives the whole scenario.

import { performance } from 'node:perf_hooks';
import { MAIN_PROMPT, aiMessage, createHost } from '../../testkit/index.js';
import { STATIC_KEY, TAIL_KEY } from '../../core/turn.js';
import { UI_EVERY, createBenchModule } from './load-module.js';
import { PROSE, replyText, uiCommands, userText } from './load-text.js';
import { breakdown, measureLoad, measureSwipe, stats, time, v1Size } from './load-measure.js';

export const CONTEXT_MESSAGES = 40;

/**
 * One ordinary turn the way the testkit's fake SillyTavern runs it (user message, interceptor, prompt
 * ready, reply, MESSAGE_RECEIVED, generation ended), without the fake's bookkeeping that copies the whole
 * chat on every generation (fine for unit tests, quadratic over 3,000 replies). The host's own listeners
 * see the same events in the same order.
 */
export async function sendFast(host, user, reply) {
    const { st, ctx } = host;
    const types = ctx.eventTypes;
    const emit = (event, ...args) => st.eventSource.emit(event, ...args);
    st.addUser(user);
    await emit(types.MESSAGE_SENT, ctx.chat.length - 1);
    await emit(types.GENERATION_STARTED, 'normal', {}, false);
    let aborted = false;
    // SillyTavern hands the interceptor a copy of the chat; Story Suite's ignores it, so no copy is made.
    await st.interceptor(ctx.chat, 8192, () => { aborted = true; }, 'normal');
    if (aborted) throw new Error('bench: a generation was held back.');
    const history = ctx.chat.slice(-CONTEXT_MESSAGES).map(message => ({ role: message.is_user ? 'user' : 'assistant', content: message.mes }));
    const request = {
        chat: [{ role: 'system', content: [MAIN_PROMPT, st.prompt(STATIC_KEY)].join('\n') }, ...history, { role: 'system', content: st.prompt(TAIL_KEY) }],
        dryRun: false,
    };
    await emit(types.CHAT_COMPLETION_PROMPT_READY, request);
    const index = st.addMessage(aiMessage(reply, { name: ctx.name2 }));
    await emit(types.MESSAGE_RECEIVED, index, 'normal');
    await emit(types.GENERATION_ENDED, ctx.chat.length);
    st.eventSource.emitted.length = 0;
    st.promptLog.length = 0;
    return { index, request };
}

/**
 * Drives `replies` replies through a testkit host. `options`: { replies, snapshots (reply counts to
 * measure at; default [replies]), fast (true: sendFast; false: the fake's own send), uiSpacing: 'burst' (the three clicks inside 400 ms: one save) |
 * 'spread' (each click saved on its own), repeat (timing repeats at a snapshot), onSnapshot(result) }.
 * Returns { snapshots: [...], saves: { pre, capture, ui, other, total }, problems }.
 */
export async function runScenario(options = {}) {
    const { replies = 100, snapshots = [replies], fast = true, uiSpacing = 'burst', repeat = 5, onSnapshot = null } = options;
    const host = await createHost({ modules: [createBenchModule()], st: { greeting: `The story begins. ${PROSE}` } });
    const { st, store, bus, ctx } = host;
    let phase = 'other';
    const saves = { pre: 0, capture: 0, ui: 0, other: 0 };
    // Counts saves without copying the chat (the fake's own saveChat keeps a deep copy of each one).
    ctx.saveChat = async () => { saves[phase] += 1; };

    const turnInterceptor = st.interceptor;
    const preMs = [];
    st.interceptor = async (...args) => {
        phase = 'pre';
        const start = performance.now();
        try { await turnInterceptor(...args); } finally {
            preMs.push(performance.now() - start);
            phase = 'other';
        }
    };
    const captureMs = [];
    let captureStart = 0;
    st.eventSource.makeFirst(st.ctx.eventTypes.MESSAGE_RECEIVED, () => { phase = 'capture'; captureStart = performance.now(); });
    st.eventSource.on(st.ctx.eventTypes.MESSAGE_RECEIVED, () => { captureMs.push(performance.now() - captureStart); phase = 'other'; });

    const seeded = bus.command('bench.seed', {}, { cause: 'system' });
    if (!seeded.ok) throw new Error(`bench: the seed command failed: ${seeded.message}`);
    phase = 'other';
    await store.flush();

    const commandMs = [];
    const savesPerReply = [];
    const out = { snapshots: [], saves, problems: [] };
    const wanted = new Set(snapshots);
    let counted = 0;
    const totalSaves = () => saves.pre + saves.capture + saves.ui + saves.other;
    for (let n = 1; n <= replies; n++) {
        const before = totalSaves();
        if (n > 1 && (n - 1) % UI_EVERY === 0) {
            for (const { type, payload } of uiCommands(n - 1)) {
                const run = time(() => bus.command(type, payload, { cause: 'ui' }));
                if (!run.value.ok) out.problems.push(`reply ${n}: ${type} was refused: ${run.value.message}`);
                commandMs.push(run.ms);
                if (uiSpacing === 'spread') {
                    phase = 'ui';
                    await store.flush();
                    phase = 'other';
                }
            }
        }
        if (fast) await sendFast(host, userText(n), replyText(n));
        else await host.send(userText(n), replyText(n));
        savesPerReply.push(totalSaves() - before);
        if (wanted.has(n)) {
            const problems = host.turn.problems();
            // (the money guard's warnings about the load's repeated coin lines are not problems of the load)
            out.problems.push(...problems.slice(counted).map(item => item.message).filter(message => !/applied; undo it/u.test(message)));
            counted = problems.length;
            const window = list => list.slice(Math.max(0, list.length - 100));
            const sizes = breakdown(ctx.chat);
            const snapshot = {
                replies: n,
                messages: ctx.chat.length,
                bytes: sizes,
                v1: v1Size(ctx.chat),
                checkpoints: { count: sizes.checkpoints.length, ...stats(sizes.checkpoints), sum: sizes.checkpoints.reduce((a, b) => a + b, 0) },
                savesPerReply: { mean: savesPerReply.reduce((a, b) => a + b, 0) / savesPerReply.length, ...stats(savesPerReply) },
                saves: { ...saves, total: totalSaves() },
                // The last 100 replies before the snapshot: how it feels at this chat length.
                preMs: stats(window(preMs)),
                captureMs: stats(window(captureMs)),
                commandMs: stats(window(commandMs)),
                load: measureLoad(ctx.chat, { repeat }),
                swipe: measureSwipe(ctx.chat, { repeat }),
                head: store.head(),
            };
            out.snapshots.push(snapshot);
            onSnapshot?.(snapshot);
        }
    }
    await store.flush();
    out.saves = { ...saves, total: totalSaves() };
    out.chat = ctx.chat;
    out.host = host;
    host.close();
    return out;
}

// ---------- tuning experiments (on a finished chat; the runtime is not changed) ----------

/**
 * The chat with its checkpoints placed by another rule: a carrier gets one when `every` carriers have
 * passed since the last, or the ops since then exceed `bytes` (the store's rule, other numbers). The
 * greeting keeps its own. Ops, receipts and everything else stay as they are.
 */
