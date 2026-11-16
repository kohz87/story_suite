// sdk.callModel: own calls, chat-connection waiting during replies, and one queue per connection (createCallQueue).
import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_TYPES } from '../../testkit/index.js';
import { MODEL_CALL_ERRORS, createCallQueue, createModelCalls, createOwnCalls, promptKey } from '../../src/v2/model-call.js';
import { callsLine } from '../../src/v2/diagnostics.js';
import { planner, rawHost, tick, heldCalls, later } from './model-call.helpers.js';

test('own calls: a chat-connection call\'s prompt during a reply\'s build is never taken for the reply\'s', async () => {
    let own = null;
    const { st, rt, seen } = await rawHost({
        modules: [planner()],
        // Between the reply's interceptor and its prompt: our own raw call's prompt-ready comes first.
        hold: async runtime => {
            assert.equal(runtime.turn.session().prompted, false);
            own = await runtime.ownCalls.around('Plan the next arc for the story.', () => ownRawCall());
            assert.equal(runtime.turn.session().prompted, false, 'the reply\'s session did not take our prompt');
        },
    });
    async function ownRawCall() {
        const chat = [{ role: 'system', content: 'You plan.' }, { role: 'user', content: 'Plan the next arc for the story.' }];
        await st.ctx.eventSource.emit(EVENT_TYPES.CHAT_COMPLETION_PROMPT_READY, { chat, dryRun: false });
        seen.ownChat = chat;
        return 'arc';
    }
    const result = await st.send('Hello.', 'Hi there.');
    assert.equal(own, 'arc');
    assert.equal(seen.interceptor, 1, 'only the reply ran the interceptor');
    assert.equal(seen.ownChat.length, 2, 'nothing of Story Suite\'s added to our call\'s chat');
    assert.ok(!JSON.stringify(seen.ownChat).includes('Changes'), 'no notes in our prompt');
    assert.equal(result.index, 2, 'the reply came');
    assert.equal(rt.turn.session(), null, 'and was received as the reply');
    assert.equal(rt.turn.replyBusy(), false);

    // The matching itself: by the prompt's macro-free key, once; never a long chat; a short prompt by position.
    const calls = createOwnCalls();
    assert.equal(promptKey('{{char}} meets {{user}}\nPlan the next arc, three beats.'), 'Plan the next arc, three beats.');
    assert.equal(promptKey('Hi {{user}}'), '');
    await calls.around('Plan the next arc for {{user}}.', async () => {
        assert.equal(calls.owns({ chat: Array.from({ length: 6 }, () => ({ role: 'user', content: 'Plan the next arc for Ann.' })) }), false, 'a long chat is the reply\'s');
        assert.equal(calls.owns({ chat: [{ role: 'user', content: 'Plan the next arc for Ann.' }] }), true);
        assert.equal(calls.owns({ chat: [{ role: 'user', content: 'Plan the next arc for Ann.' }] }), false, 'matched once');
    });
    await calls.around('Go', async () => {
        assert.equal(calls.owns({ prompt: 'Go' }), false, 'a short prompt never takes a text prompt');
        assert.equal(calls.owns({ chat: [{ role: 'user', content: 'Go' }] }), true);
    });
    assert.equal(calls.owns({ chat: [{ role: 'user', content: 'anything' }] }), false, 'none in flight');
    assert.equal(calls.size(), 0);
});

test('a chat-connection sdk.callModel waits while a reply is built or awaited, runs after it; a named profile goes at once', async () => {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const gated = {
        id: 'gated', name: 'Gated',
        features: [{ id: 'gated.plan', label: 'Plan' }],
        hooks: { beforeGenerate: async () => { await held; } },
    };
    const { st, rt, seen } = await rawHost({ modules: [gated] });
    const reply = st.send('Hello.', 'Hi there.');
    while (!rt.turn.replyBusy()) await tick();
    // The reply's build is held in its beforeGenerate hook: a call on the chat's connection waits.
    const queued = rt.sdk.callModel({ feature: 'gated.plan', prompt: 'Plan the next arc for the story.' });
    const named = await rt.sdk.callModel({ module: 'other', profile: 'Cheap', prompt: 'Describe a rat, briefly.' });
    assert.deepEqual(named, { ok: true, text: 'answer to Describe a rat, briefly.', error: null }, 'a named profile is not queued');
    await tick();
    assert.deepEqual(seen.calls.map(call => call.prompt), ['Describe a rat, briefly.'], 'the chat-connection call has not run');
    release();
    const done = await reply;
    assert.equal(done.index, 2);
    const result = await queued;
    assert.equal(result.text, 'answer to Plan the next arc for the story.');
    assert.equal(seen.calls[1].at, false, 'it ran once the reply was received');
    assert.equal(seen.interceptor, 1, 'it never hit the interceptor');
    assert.equal(seen.lastChat.length, 2, 'and was not taken for the reply');
    // While the reader is idle it goes at once; a queued call keeps its time limit and abort.
    assert.equal((await rt.sdk.callModel({ feature: 'gated.plan', prompt: 'Once more, please.' })).ok, true);
    let again;
    const second = new Promise(resolve => { again = resolve; });
    gated.hooks.beforeGenerate = async () => { await second; };
    const reply2 = st.send('Again.', 'Fine.');
    while (!rt.turn.replyBusy()) await tick();
    const controller = new AbortController();
    const waiting = rt.sdk.callModel({ feature: 'gated.plan', prompt: 'Plan the next arc for the story.', signal: controller.signal });
    await tick();
    controller.abort();
    assert.equal((await waiting).error, 'ABORTED');
    again();
    await reply2;
    assert.equal(seen.calls.length, 3, 'the cancelled call never ran');
});

test('the reply stops counting as in progress when it is received, ended, stopped, held back or the chat changes', async () => {
    const { st, rt } = await rawHost({ modules: [planner()] });
    let resolved = false;
    rt.turn.whenIdle().then(() => { resolved = true; });
    await tick();
    assert.equal(resolved, true, 'idle at once');
    await st.send('Hello.', 'Hi.');
    assert.equal(rt.turn.replyBusy(), false);
    await st.send('Stop it.', 'Hi', { stopped: true });
    assert.equal(rt.turn.replyBusy(), false);
    await st.generate('quiet', { reply: 'x' });
    assert.equal(rt.turn.replyBusy(), false, 'a quiet generation is not the reply');
    // Held back by a module: idle again.
    const blocker = await rawHost({ modules: [{ id: 'gate', name: 'Gate', hooks: { canGenerate: () => ({ ok: false, reason: 'Make a character first.' }) } }] });
    const out = await blocker.st.send('Go.', 'never');
    assert.equal(out.aborted, true);
    assert.equal(blocker.rt.turn.replyBusy(), false);
});

// ---- one queue per connection (createCallQueue) ----------------------------------------------------

test('queue: calls on the same profile run one at a time, in order; different profiles run side by side', async () => {
    const fake = heldCalls();
    const calls = createModelCalls({ call: fake.call, log: () => {} });
    const a = calls.callModel({ prompt: 'a', profile: 'Local', module: 'm1' });
    const b = calls.callModel({ prompt: 'b', profile: 'Local', module: 'm2' });
    const c = calls.callModel({ prompt: 'c', profile: 'Local', module: 'm3' });
    const d = calls.callModel({ prompt: 'd', profile: 'Cloud', module: 'm4' });
    await later();
    assert.deepEqual(fake.started, ['Local:a', 'Cloud:d'], 'b and c wait; the other profile goes at once');
    assert.equal(calls.queue.stats().waiting, 2);
    fake.end('a');
    assert.equal((await a).text, 'answer a');
    await later();
    assert.deepEqual(fake.started, ['Local:a', 'Cloud:d', 'Local:b']);
    fake.end('b');
    fake.end('d');
    await b;
    await later();
    fake.end('c');
    assert.equal((await c).ok, true);
    assert.equal((await d).ok, true);
    assert.deepEqual(fake.started, ['Local:a', 'Cloud:d', 'Local:b', 'Local:c']);
    const stats = calls.queue.stats();
    assert.equal(stats.waiting, 0);
    assert.equal(stats.waited, 2);
    assert.ok(stats.longestMs >= 0);
});

test('queue: a queued call that runs out of time leaves the queue and is never made; the next one still runs', async () => {
    const fake = heldCalls();
    const calls = createModelCalls({ call: fake.call, log: () => {} });
    const a = calls.callModel({ prompt: 'a', profile: 'Local', module: 'm1', timeoutMs: 5000 });
    const b = calls.callModel({ prompt: 'b', profile: 'Local', module: 'm2', timeoutMs: 1000 });
    const c = calls.callModel({ prompt: 'c', profile: 'Local', module: 'm3', timeoutMs: 5000 });
    const late = await b;
    assert.equal(late.error, MODEL_CALL_ERRORS.TIMEOUT);
    assert.equal(calls.queue.stats().waiting, 1, 'b left the queue');
    fake.end('a');
    await a;
    await later();
    assert.deepEqual(fake.started, ['Local:a', 'Local:c'], 'b was never made');
    fake.end('c');
    assert.equal((await c).ok, true);
});

test('queue: a cancelled call (waiting or running) frees its place; the queue setting off runs calls at once', async () => {
    const fake = heldCalls();
    const calls = createModelCalls({ call: fake.call, log: () => {} });
    const stopA = new AbortController();
    const stopB = new AbortController();
    const a = calls.callModel({ prompt: 'a', profile: 'Local', module: 'm1', signal: stopA.signal });
    const b = calls.callModel({ prompt: 'b', profile: 'Local', module: 'm2', signal: stopB.signal });
    const c = calls.callModel({ prompt: 'c', profile: 'Local', module: 'm3' });
    await later();
    stopB.abort();
    assert.equal((await b).error, MODEL_CALL_ERRORS.ABORTED);
    stopA.abort();
    assert.equal((await a).error, MODEL_CALL_ERRORS.ABORTED);
    await later();
    assert.deepEqual(fake.started, ['Local:a', 'Local:c'], 'a running call cancelled frees the connection; b never ran');
    fake.end('c');
    assert.equal((await c).ok, true);

    let on = false;
    const free = heldCalls();
    const loose = createModelCalls({ call: free.call, log: () => {}, queue: createCallQueue({ enabled: () => on }) });
    loose.callModel({ prompt: 'x', profile: 'Local', module: 'm1' });
    loose.callModel({ prompt: 'y', profile: 'Local', module: 'm2' });
    await later();
    assert.deepEqual(free.started, ['Local:x', 'Local:y'], 'off: side by side');
    assert.equal(loose.queue.stats().on, false);
    free.end('x');
    free.end('y');
    on = true;
});

test('queue: the chat\'s connection waits for an idle chat before it takes its place, so a waiting call never holds it', async () => {
    const fake = heldCalls();
    let idle;
    const gate = { whenIdle: () => new Promise(resolve => { idle = resolve; }) };
    const calls = createModelCalls({ call: fake.call, log: () => {}, gate });
    const waiting = calls.callModel({ prompt: 'scan', module: 'delta' });
    // The host's own call (the pre-roll while a reply is prepared) skips the idle wait and is not held up.
    const own = calls.callModel({ prompt: 'pre', module: 'story-block (pre-roll)' }, { idle: false });
    await later();
    assert.deepEqual(fake.started, ['chat:pre']);
    fake.end('pre');
    assert.equal((await own).ok, true);
    idle();
    await later();
    assert.deepEqual(fake.started, ['chat:pre', 'chat:scan']);
    fake.end('scan');
    assert.equal((await waiting).ok, true);
});

test('diagnostics: the queue line names counts and waits only', () => {
    assert.equal(callsLine({ on: true, waiting: 2, running: 1, waited: 3, waitedMs: 2400, longestMs: 1200, lanes: { Local: 2 } }),
        'One at a time per connection: on. Waiting now: 2 on 1 connection. Running: 1. Calls that waited: 3, 2.4 s in all, longest 1.2 s.');
    assert.match(callsLine(null), /unknown/);
});
