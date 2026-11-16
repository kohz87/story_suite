// A turn on a fake and real runtime: hooks, preview, rebuild, real runtime, closing cue.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost, hostAvailable } from '../../testkit/index.js';
import { STATIC_KEY } from '../../core/turn.js';
import { appendClosingCue, closingCue } from '../../core/turn/text.js';
import { HAPPENED } from '../../core/prompt.js';
import { noCue, bag, fakeHost, stored, items } from './turn.helpers.js';

test('beforeGenerate: tail lines join the module\'s part; commands are committed as system receipts and told', async () => {
    const host = await fakeHost({
        modules: [{
            id: 'clock',
            domains: { director: { initial: () => ({ bell: false }) } },
            commands: { 'clock.ring'(ctx) { ctx.draft('director').bell = true; return { summary: 'The bell rings at midnight.', narrate: true }; } },
            hooks: { beforeGenerate: view => (view.state.domains.director.bell ? ['The bell has rung.'] : { lines: ['Midnight comes.'], commands: [{ type: 'clock.ring' }, { type: 'clock.nope' }] }) },
        }],
    });
    const { request } = await host.send('Wait.', 'Ok.');
    const tail = request.chat.at(-1).content;
    assert.ok(tail.startsWith(`${HAPPENED}\nThe bell rings at midnight.`));
    assert.ok(noCue(tail).endsWith('Midnight comes.'));
    assert.deepEqual(host.turn.problems('clock').map(item => item.code), ['UNKNOWN_COMMAND']);
    const receipt = stored(host, 0).receipts.find(item => item.type === 'clock.ring');
    assert.equal(receipt.cause, 'system');
    assert.deepEqual(stored(host, 2).narrated, [receipt.id]);
    host.close();
});

test('the preview lists what the next reply would be sent, without changing anything', async () => {
    const host = await fakeHost();
    const saves = host.st.saves.length;
    const parts = host.turn.preview();
    assert.deepEqual(parts.map(part => [part.place, part.module]), [['static', 'story-suite'], ['static', 'bag'], ['tail', 'bag']]);
    assert.equal(host.st.saves.length, saves);
    assert.equal(host.turn.session(), null);
    host.close();
});

test('chat change and deleted messages rebuild the head; a chat with no state gets its initial state', async () => {
    const host = await fakeHost();
    const heads = [];
    host.sdk.on('head', event => heads.push(event.index));
    await host.send('Go.', 'Done.\n<Changes>\n+ item Rope\n</Changes>');
    await host.st.deleteMessage(2);
    assert.equal(heads.at(-1), 0);
    await host.st.loadChat([{ name: 'Narrator', is_user: false, mes: 'A new tale.', swipes: ['A new tale.'], swipe_id: 0, swipe_info: [{ extra: {} }], extra: {} }], 'chat-2');
    assert.deepEqual(host.head().domains, { inventory: { items: {} } });
    assert.equal(host.turn.session(), null);
    host.close();
});

test('canGenerate: a module can hold a story generation back, with a reason; quiet ones are not asked', async () => {
    let ready = false;
    let asked = 0;
    const opened = [];
    const host = await fakeHost({
        modules: [{
            id: 'creator',
            name: 'Creator',
            hooks: {
                canGenerate: async view => { asked += 1; return ready || { ok: false, reason: `Make your character first (${view.chat.length} messages).` }; },
                onBlocked: (reason, moduleId) => opened.push([moduleId, reason]),
            },
        }, { id: 'maybe', hooks: { canGenerate: () => (asked > 2 ? false : true) } }, { id: 'buggy', hooks: { canGenerate() { throw new Error('oops'); } } }],
    });
    const stopped = await host.send('Hello?', 'Should not be written.');
    assert.equal(stopped.aborted, true);
    assert.equal(host.ctx.chat.length, 2, 'no reply');
    assert.equal(host.st.requests.length, 0, 'nothing was sent');
    assert.deepEqual(host.st.notices, [{ reason: 'Make your character first (2 messages).', moduleId: 'creator' }]);
    assert.deepEqual(opened, [['creator', 'Make your character first (2 messages).']]);
    assert.deepEqual(host.turn.blocked(), [{ moduleId: 'creator', reason: 'Make your character first (2 messages).' }]);
    assert.equal(host.st.prompt(STATIC_KEY), '');
    assert.equal(host.turn.session(), null);
    assert.deepEqual(host.turn.problems('buggy').map(item => item.code), ['FAILED'], 'a throwing hook is logged and does not block');
    // Quiet generations are never asked.
    await host.quiet('x');
    assert.equal(asked, 1);
    // Ready: the next one goes through; `false` alone blocks with a plain default reason.
    ready = true;
    const sent = await host.st.generate('normal', { reply: 'Now it goes.' });
    assert.equal(sent.index, 2);
    host.st.addUser('Again.');
    const second = await host.st.generate('normal', { reply: 'no' });
    assert.equal(second.aborted, true);
    assert.equal(host.st.notices.at(-1).reason, 'maybe is not ready for the story to go on yet.');
    host.close();
});

test('the static instruction asks for <Changes> only, never a state block', async () => {
    const host = await fakeHost();
    await host.st.addUser('Hi.');
    await host.turn.interceptor([], 8192, () => {}, 'normal');
    const text = host.st.prompt(STATIC_KEY);
    assert.match(text, /This is the only block you write: no state, inventory or party blocks/);
    assert.equal(text.match(/<[A-Z][A-Za-z_]*>/g).join(','), '<Changes>', 'no other block tag is named');
    host.close();
});

test('the real runtime with the core module: items, coins, place and presence from one reply', async t => {
    const available = await hostAvailable();
    if (!available.ok) {
        t.skip(available.reason);
        return;
    }
    const host = await createHost();
    assert.ok(host.registry.has('story-block'));
    const { request } = await host.send('I land the fish and walk into the village.', [
        'The trout fights, then gives. Fenna waves from the gate of Bluewatch.',
        '<Changes>',
        '+ item Moonveil Trout | qty: 1 | note: violet-streaked',
        '+ item Moonveil Trout | qty: 1',
        '~ place Bluewatch Village | kind: settlement',
        '+ present Fenna',
        '- item Rope',
        '</Changes>',
    ].join('\n'));
    assert.ok(request.chat[0].content.includes('+ item Name | qty: 1'));
    const head = host.head();
    const trout = Object.values(head.domains.inventory.stacks).filter(stack => head.domains.inventory.defs[stack.def]?.name === 'Moonveil Trout');
    assert.equal(trout.reduce((sum, stack) => sum + stack.qty, 0), 2, 'the second line ran on the state the first left');
    assert.equal(head.domains.scene.place.name, 'Bluewatch Village');
    assert.deepEqual(head.domains.scene.present, ['Fenna']);
    assert.deepEqual(host.turn.problems('story-block').map(item => item.line), ['- item Rope']);
    const receipts = host.ctx.chat[2].extra.storySuite.receipts;
    assert.ok(receipts.every(receipt => receipt.cause === 'story' && receipt.module === 'story-block'));
    assert.deepEqual(receipts.map(receipt => receipt.rev), [1, 2, 3, 4], 'one rev per line, in reply order');
    const next = await host.send('Who is here?', 'Fenna.');
    assert.ok(next.request.chat.at(-1).content.includes('Fenna'));
    host.close();
});

test('the real runtime: a whole turn on store.js and commands.js', async t => {
    const available = await hostAvailable();
    if (!available.ok) {
        t.skip(available.reason);
        return;
    }
    const host = await createHost({ core: false, modules: [bag()] });
    await host.send('I fish.', 'A trout.\n<Changes>\n+ item Trout | qty: 2\n- item Boot\n</Changes>');
    assert.deepEqual(items(host), { Trout: 2 });
    assert.deepEqual(host.turn.problems('bag').map(item => item.code), ['NOT_ENOUGH']);
    const picked = await host.sdk.command('bag.add', { name: 'Rope', qty: 1 });
    assert.equal(picked.ok, true);
    const { request } = await host.send('Next.', 'Ok.\n<Changes>\n+ item Coin\n</Changes>');
    assert.ok(request.chat.at(-1).content.startsWith(`${HAPPENED}\nRen picks up 1 Rope (now 1).`));
    assert.deepEqual(items(host), { Trout: 2, Rope: 1, Coin: 1 });
    // A swipe of the last reply takes back what that reply's first swipe changed (§2.2).
    await host.swipe('Another ending.\n<Changes>\n+ item Lamp\n</Changes>');
    assert.deepEqual(items(host), { Trout: 2, Rope: 1, Lamp: 1 });
    await host.st.swipeTo(4, 0);
    assert.deepEqual(items(host), { Trout: 2, Rope: 1, Coin: 1 });
    // Deleting the reply that holds the Rope's receipt takes the Rope back.
    await host.st.deleteMessage(4);
    await host.st.deleteMessage(3);
    await host.st.deleteMessage(2);
    assert.deepEqual(items(host), {});
    host.close();
});

test('a redraw that fails at MESSAGE_RECEIVED (the reply is not drawn yet) does not lose the turn', async () => {
    const host = await createHost();
    host.ctx.updateMessageBlock = () => { throw new TypeError("Cannot read properties of undefined (reading 'getAttribute')"); };
    const turns = [];
    host.sdk.on('turn', turn => turns.push(turn.index));
    await host.send('Go.', 'Rope.\n<Changes>\n+ item Rope\n</Changes>');
    assert.deepEqual(turns, [2]);
    assert.match(host.ctx.chat[2].mes, /<!-- STORY_SUITE_V2/);
    assert.deepEqual(host.turn.problems(), []);
    host.close();
});

test('closing cue: the last text of a reply\'s prompt, fixed, one-pass wording only when NPC State Delta captures, never on quiet prompts', async () => {
    const host = await fakeHost();
    const cue = 'After the story, write the <Changes> block. Changes worked out only in thinking are lost.';
    assert.equal(closingCue(false), cue);
    assert.equal(closingCue(true), 'After the story, write the <Changes> block, then the hidden npc_state_delta block. Changes worked out only in thinking are lost.');
    assert.ok(closingCue(true).length < 160, 'under 40 tokens');
    const sent = await host.send('Hello.', 'Hi.');
    assert.ok(sent.request.chat.at(-1).content.endsWith(`\n\n${cue}`), 'the very last text, after the tail');
    assert.equal(sent.request.chat.filter(message => String(message.content).includes('lost.')).length, 1);
    // After a preset's own depth-0 block and before a prefill.
    const chat = [{ role: 'user', content: 'Hi\n<thinking_guide>plan</thinking_guide>' }, { role: 'assistant', content: 'Prefill' }];
    assert.equal(appendClosingCue(chat, cue), true);
    assert.deepEqual(chat.map(message => message.role), ['user', 'assistant']);
    assert.ok(chat[0].content.endsWith(`</thinking_guide>\n\n${cue}`));
    assert.equal(appendClosingCue(chat, cue), false, 'never twice');
    // NPC State Delta's one-pass capture rules sit in its extension prompt: the cue then names its hidden block too.
    host.ctx.extensionPrompts = { story_suite_static_npc_state_delta: { value: 'capture rules' } };   // SillyTavern's own map; the fake keeps its own
    const onePass = await host.send('Again.', 'Ok.');
    assert.ok(onePass.request.chat.at(-1).content.endsWith(`\n\n${closingCue(true)}`));
    host.ctx.extensionPrompts = {};
    // A quiet prompt and an impersonation carry no cue.
    const quiet = await host.quiet('x');
    assert.ok(!JSON.stringify(quiet.request).includes('lost.'));
    const impersonated = await host.st.generate('impersonate', { reply: 'I say hi.' });
    assert.ok(!JSON.stringify(impersonated.request).includes('lost.'));
    host.close();
});
