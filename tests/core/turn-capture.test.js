// A turn on a fake SillyTavern (docs/v2/SPEC.md §4, §5): interceptor, prompt slots, capture, static/tail, restoreMissing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedPrefix, EXTENSION_PROMPT_TYPES } from '../../testkit/index.js';
import { STATIC_KEY, TAIL_KEY, V1_KEYS, createTurn, restoreMissing } from '../../src/v2/turn.js';
import { HAPPENED, STATIC_MARKER } from '../../src/v2/prompt.js';
import { noCue, fakeHost, stored, items } from './turn.helpers.js';

test('a healthy interceptor does not settle the timeline or move the barrier', async t => {
    const host = await fakeHost();
    t.after(() => host.close());
    await host.st.addUser('Hello.');
    let settles = 0;
    const timeline = {
        settle() { settles += 1; host.registry.setRestore('pending', 'Unexpected barrier.'); },
        needsRecovery: () => false,
    };
    const turn = createTurn({ ctx: host.ctx, store: host.store, bus: host.bus, registry: host.registry, settings: host.settings, timeline });
    let aborted = false;
    await turn.interceptor([], 8192, () => { aborted = true; }, 'normal');
    assert.equal(settles, 0);
    assert.equal(host.registry.restore().state, 'idle');
    assert.equal(aborted, false);
    assert.ok(turn.session());
    turn.uninstall({ globalName: null });
});

test('repeated blocked sends share a recovery and tell the reader once per barrier', async t => {
    const host = await fakeHost();
    t.after(() => host.close());
    await host.st.addUser('Keep this.');
    const notices = [];
    let attempts = 0;
    let finish;
    const timeline = {
        settle() {},
        needsRecovery: () => true,
        recover() { attempts += 1; return new Promise(resolve => { finish = resolve; }); },
    };
    const turn = createTurn({ ctx: host.ctx, store: host.store, bus: host.bus, registry: host.registry, settings: host.settings, timeline,
        notify: reason => notices.push(reason) });
    host.registry.setRestore('pending', 'Waiting for records.');
    let aborted = 0;
    const send = () => turn.interceptor([], 8192, () => { aborted += 1; }, 'normal');
    await send();
    await send();
    await send();
    assert.equal(aborted, 3);
    assert.equal(attempts, 1);
    assert.equal(notices.length, 1);
    assert.equal(turn.problems(null).filter(item => item.code === 'RESTORE_PENDING').length, 1);
    host.registry.setRestore('idle');
    host.registry.setRestore('pending', 'Another restore.');
    await send();
    assert.equal(attempts, 1, 'the earlier recovery is still running');
    assert.equal(notices.length, 2, 'a new barrier gets its own notice');
    assert.equal(turn.problems(null).filter(item => item.code === 'RESTORE_PENDING').length, 2);
    finish();
    await Promise.resolve();
    await send();
    assert.equal(attempts, 2, 'a finished recovery can be tried again');
    assert.equal(notices.length, 2);
    finish();
    turn.uninstall({ globalName: null });
});

test('install empties the v1 keys and both slots; the interceptor sets both for an ordinary reply', async () => {
    const host = await fakeHost();
    const keys = Object.fromEntries(host.st.promptLog.slice(0, V1_KEYS.length).map(entry => [entry.key, entry]));
    for (const [key, place] of V1_KEYS) {
        assert.equal(keys[key].value, '');
        assert.equal(keys[key].position, place === 'static' ? EXTENSION_PROMPT_TYPES.IN_PROMPT : EXTENSION_PROMPT_TYPES.IN_CHAT);
    }
    await host.st.addUser('I look around.');
    await host.turn.interceptor([], 8192, () => {}, 'normal');
    const prompts = host.st.prompts();
    assert.deepEqual({ ...prompts[STATIC_KEY], value: undefined }, { value: undefined, position: EXTENSION_PROMPT_TYPES.IN_PROMPT, depth: 0, scan: false, role: 0 });
    assert.deepEqual({ ...prompts[TAIL_KEY], value: undefined }, { value: undefined, position: EXTENSION_PROMPT_TYPES.IN_CHAT, depth: 0, scan: false, role: 0 });
    assert.ok(prompts[STATIC_KEY].value.startsWith(STATIC_MARKER));
    assert.ok(prompts[STATIC_KEY].value.includes('+ item Name | qty: 1'));
    assert.ok(prompts[STATIC_KEY].value.endsWith('Bag: the story never sets counts.'));
    assert.equal(prompts[TAIL_KEY].value, '[Bag] empty');
    host.close();
});

test('normal, swipe, regenerate and continue get both slots; quiet and impersonate get neither and capture nothing', async () => {
    const host = await fakeHost();
    for (const type of ['normal', 'swipe', 'regenerate', 'continue', undefined]) {
        await host.turn.interceptor([], 8192, () => {}, 'quiet');
        assert.equal(host.st.prompt(STATIC_KEY), '');
        await host.turn.interceptor([], 8192, () => {}, type);
        assert.ok(host.st.prompt(STATIC_KEY), `${type}: static set`);
        assert.ok(host.st.prompt(TAIL_KEY), `${type}: tail set`);
    }
    for (const type of ['quiet', 'impersonate', 'Quiet', 'something-new']) {
        await host.turn.interceptor([], 8192, () => {}, 'normal');
        await host.turn.onGenerationEnded();
        host.turn.onPromptReady({ chat: [] });
        await host.turn.interceptor([], 8192, () => {}, type);
        assert.equal(host.st.prompt(STATIC_KEY), '', `${type}: static emptied`);
        assert.equal(host.st.prompt(TAIL_KEY), '', `${type}: tail emptied`);
    }
    // A quiet generation adds no message, so nothing is captured; the request carried nothing.
    host.turn.clearProblems();
    const quiet = await host.quiet('<Changes>\n+ item Rope\n</Changes>');
    assert.ok(!JSON.stringify(quiet.request).includes(STATIC_MARKER));
    assert.ok(!JSON.stringify(quiet.request).includes('[Bag]'));
    assert.deepEqual(items(host), {});
    // An impersonation neither.
    const before = host.st.saves.length;
    const impersonated = await host.st.generate('impersonate', { reply: 'I say hi.' });
    assert.ok(!JSON.stringify(impersonated.request).includes(STATIC_MARKER));
    assert.equal(host.st.saves.length, before);
    host.close();
});

test('a reply\'s change lines are captured, appended to it, hidden, and saved once', async () => {
    const host = await fakeHost();
    const turns = [];
    const committed = [];
    host.sdk.on('turn', turn => turns.push(turn));
    host.sdk.on('committed', ({ receipt }) => committed.push(receipt.id));
    // The greeting's initial state, written when the chat opened, is saved before the reply.
    await host.store.flush();
    const saves = host.st.saves.length;
    const { index } = await host.send('I fish.', 'Ren lands a trout.\n\n<Changes>\n+ item Moonveil Trout | qty: 2\n+ items Rope\n</Changes>');
    assert.equal(index, 2);
    assert.deepEqual(items(host), { 'Moonveil Trout': 2, Rope: 1 });
    const carrier = stored(host, 2);
    assert.deepEqual(carrier.receipts.map(receipt => [receipt.type, receipt.cause, receipt.module]), [
        ['capture.item', 'story', 'bag'],
        ['capture.item', 'story', 'bag'],
    ]);
    assert.equal(carrier.ops.length, 4);
    assert.deepEqual(carrier.narrated, []);
    assert.equal(host.st.saves.length, saves + 1, 'one save for the whole reply');
    // The block is kept, hidden, in the reply and its swipe; the story reads as written.
    const message = host.ctx.chat[2];
    assert.match(message.mes, /^Ren lands a trout\.\n\n<!-- STORY_SUITE_V2\n<Changes>\n/);
    assert.equal(message.swipes[0], message.mes);
    assert.deepEqual(host.st.rendered, [2]);
    assert.equal(turns.length, 1);
    assert.deepEqual(turns[0].receipts.map(receipt => receipt.id), committed);
    assert.deepEqual(turns[0].problems, []);
    // The spent note is emptied once the reply is in.
    assert.equal(host.st.prompt(TAIL_KEY), '');
    assert.equal(host.st.prompt(STATIC_KEY), '');
    host.close();
});

test('an unknown kind, an unreadable line and a rejected line become problems; the rest is kept', async () => {
    const host = await fakeHost();
    const turns = [];
    host.sdk.on('turn', turn => turns.push(turn));
    await host.send('I trade.', [
        'Done.',
        '<Changes>',
        '+ item Rope | qty: 2',
        '~ quest Granary Rats | step: cleared',
        'Nothing else.',
        '- item Lantern',
        '+ item Coin | qty: lots',
        '- item Rope',
        '</Changes>',
    ].join('\n'));
    assert.deepEqual(items(host), { Rope: 1 }, 'the accepted lines are applied');
    assert.equal(stored(host, 2).receipts.length, 2);
    const problems = host.turn.problems();
    assert.deepEqual(problems.map(item => [item.module, item.code]), [
        [null, 'UNREADABLE'],
        [null, 'UNKNOWN_KIND'],
        ['bag', 'NOT_ENOUGH'],
        ['bag', 'INVALID'],
    ]);
    assert.match(problems[1].message, /No module keeps "quest", so "~ quest Granary Rats \| step: cleared" was not used\./);
    assert.match(problems[2].message, /"- item Lantern" was not used: There is no Lantern left\./);
    assert.ok(problems.every(item => item.index === 2 || item.code === 'UNREADABLE'));
    assert.deepEqual(host.turn.problems('bag').map(item => item.code), ['NOT_ENOUGH', 'INVALID']);
    assert.equal(turns[0].problems.length, 4);
    host.close();
});

test('a module that throws in capture is a problem, not an error for the reader', async () => {
    const host = await fakeHost({
        modules: [{ id: 'boom', capture: { kinds: { boom: { grammar: '! boom Name' } }, apply() { throw new Error('kaboom'); } } }],
    });
    await host.send('Go.', 'Text.\n<Changes>\n! boom Thing\n+ item Rope\n</Changes>');
    assert.deepEqual(items(host), { Rope: 1 });
    assert.deepEqual(host.turn.problems('boom').map(item => [item.code, item.message]), [['FAILED', '"! boom Thing" was not used: kaboom']]);
    host.close();
});

test('what happened since the last reply is told once: [Happened] in the tail, then recorded as narrated', async () => {
    const host = await fakeHost();
    await host.send('Hi.', 'Hello.');
    const picked = await host.sdk.command('bag.add', { name: 'Rope', qty: 2 });
    assert.equal(picked.ok, true);
    const { request } = await host.send('I look at my rope.', 'A fine rope.');
    const tail = request.chat.at(-1);
    assert.equal(tail.role, 'system');
    assert.equal(noCue(tail.content), `${HAPPENED}\nRen picks up 2 Rope (now 2).\n[Bag] Rope x2`);
    // The receipt sits on the reply it followed; the next reply recorded that it told it.
    assert.deepEqual(stored(host, 2).receipts.map(receipt => receipt.id), [picked.receipt.id]);
    assert.deepEqual(stored(host, 4).narrated, [picked.receipt.id]);
    const again = await host.send('And now?', 'Nothing new.');
    assert.equal(noCue(again.request.chat.at(-1).content), '[Bag] Rope x2', 'not told twice');
    host.close();
});

test('the static part is byte-identical across two consecutive requests with the state changed', async () => {
    const host = await fakeHost();
    const first = await host.send('One.', 'Reply one.\n<Changes>\n+ item Rope | qty: 3\n</Changes>');
    await host.sdk.command('bag.add', { name: 'Lantern', qty: 1 });
    const second = await host.send('Two.', 'Reply two.');
    const [a, b] = [first.request.chat[0].content, second.request.chat[0].content];
    assert.equal(a, b);
    assert.notEqual(first.request.chat.at(-1).content, second.request.chat.at(-1).content);
    const shared = sharedPrefix(first.request, second.request);
    // Everything up to the first reply is the same start.
    assert.ok(shared.chars > JSON.stringify(first.request.chat.slice(0, 3)).length - 2, `shared ${shared.percent}%`);
    assert.ok(shared.percent > 50);
    host.close();
});

test('a preset without the Main Prompt: the static part goes at the start of this reply\'s part', async () => {
    const host = await fakeHost({ st: { mainPrompt: false } });
    const { request } = await host.send('Hello.', 'Hi.');
    assert.equal(request.chat.filter(message => message.content.includes(STATIC_MARKER)).length, 1);
    const tail = request.chat.at(-1);
    assert.ok(tail.content.startsWith(`${STATIC_MARKER}\n`));
    assert.ok(noCue(tail.content).endsWith('Bag: the story never sets counts.\n\n[Bag] empty'));
    assert.equal(host.turn.session(), null);
    // With the Main Prompt it is where SillyTavern put it, once.
    const normal = await fakeHost();
    const sent = await normal.send('Hello.', 'Hi.');
    assert.equal(sent.request.chat.filter(message => message.content.includes(STATIC_MARKER)).length, 1);
    assert.ok(sent.request.chat[0].content.includes(STATIC_MARKER));
    assert.equal(noCue(sent.request.chat.at(-1).content), '[Bag] empty');
    host.close();
    normal.close();
});

test('restoreMissing: only what is missing, before a Continue\'s own text when both are', () => {
    const chat = [{ role: 'user', content: 'Hi' }, { role: 'system', content: 'Other tail\n[Bag] empty' }];
    assert.equal(restoreMissing(chat, `${STATIC_MARKER}\nRules`, '[Bag] empty'), 'static');
    assert.equal(chat[1].content, `Other tail\n${STATIC_MARKER}\nRules\n\n[Bag] empty`);
    assert.equal(restoreMissing(chat, `${STATIC_MARKER}\nRules`, '[Bag] empty'), '', 'already there');
    const both = [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Half a rep' }];
    assert.equal(restoreMissing(both, `${STATIC_MARKER}\nRules`, '[Bag] empty'), 'both');
    assert.deepEqual(both.map(message => message.role), ['user', 'system', 'assistant']);
    assert.equal(both[1].content, `${STATIC_MARKER}\nRules\n\n[Bag] empty`);
    const parts = [{ role: 'system', content: [{ type: 'text', text: '[Bag] empty' }] }];
    assert.equal(restoreMissing(parts, `${STATIC_MARKER}\nRules`, '[Bag] empty'), 'static');
    assert.equal(parts[0].content[0].text, `${STATIC_MARKER}\nRules\n\n[Bag] empty`);
    assert.equal(restoreMissing([], '', 'x'), '');
});
