// A turn on a fake SillyTavern: quiet/generateRaw prompts, text completion, continue/swipe, macros.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost, MAIN_PROMPT } from '../../packages/story-block/testkit/index.js';
import { STATIC_KEY, TAIL_KEY, createTurn } from '../../core/turn.js';
import { STATIC_MARKER } from '../../core/prompt.js';
import { createRegistry } from '../../core/registry.js';
import { noCue, bag, fakeHost, stored, items, systemText } from './turn.helpers.js';

test('a quiet prompt built while the reply is pending carries nothing; the reply\'s prompt gets both back', async () => {
    const host = await fakeHost();
    await host.st.addUser('Hi.');
    await host.turn.interceptor([], 8192, () => {}, 'normal');
    // Another extension runs a quiet generation from inside its own interceptor.
    const quiet = await host.st.generate('quiet', { reply: 'summary' });
    assert.ok(!JSON.stringify(quiet.request).includes(STATIC_MARKER));
    assert.ok(host.st.prompt(STATIC_KEY).startsWith(STATIC_MARKER), 'filled again after the quiet prompt');
    assert.equal(host.st.prompt(TAIL_KEY), '[Bag] empty');
    host.close();
});

test('another extension\'s generateRaw prompt while the reply is pending gets nothing; the reply\'s own prompt is still the one', async () => {
    const host = await fakeHost();
    const raw = { chat: [{ role: 'system', content: 'You are a scanner.' }, { role: 'user', content: 'RAW scan this.' }], dryRun: false };
    // A scanner (NPC State Delta's dossier scan) calls generateRaw right after the reply's interceptor ran: SillyTavern runs no
    // interceptor for it and tells its prompt-ready like the reply's own.
    const real = host.turn.interceptor;
    host.st.interceptor = async (...args) => {
        await real(...args);
        if (args[3] === 'normal') await host.st.eventSource.emit('chat_completion_prompt_ready', raw);
    };
    const { request } = await host.send('Hello.', 'Hi.\n<Changes>\n+ item Rope\n</Changes>');
    assert.ok(!JSON.stringify(raw.chat).includes(STATIC_MARKER), 'the raw prompt carries none of Story Suite\'s text');
    assert.ok(!JSON.stringify(raw.chat).includes('[Bag]'));
    assert.equal(raw.chat.length, 2);
    assert.ok(JSON.stringify(request.chat).includes(STATIC_MARKER), 'the reply\'s prompt has both');
    assert.equal(noCue(request.chat.at(-1).content), '[Bag] empty');
    assert.deepEqual(items(host), { Rope: 1 }, 'the reply is captured');
    host.close();
});

test('a quiet generation is told by its instruction: its prompt loses Story Block\'s text, the reply\'s keeps it, whichever is built first', async () => {
    const QUIET = 'Summarize {{char}}\'s day in one short line.';
    const asked = 'Summarize Narrator\'s day in one short line.';
    const has = (request, text) => JSON.stringify(request.chat ?? request.prompt).includes(text);
    // The two prompts as SillyTavern builds them from the slots as they are when each is built (the reply's own, and the quiet one with
    // its instruction last); `event` is that API's prompt-ready.
    const built = (host, quiet) => {
        const [main, tail] = [host.st.prompt(STATIC_KEY), host.st.prompt(TAIL_KEY)];
        const instruction = quiet ? host.ctx.substituteParams(QUIET) : '';
        if (host.ctx.mainApi === 'openai') {
            const chat = [{ role: 'system', content: [MAIN_PROMPT, main].filter(Boolean).join('\n') }, { role: 'user', content: 'Hi.' }];
            if (tail) chat.push({ role: 'system', content: tail });
            if (instruction) chat.push({ role: 'system', content: instruction });
            return { event: 'chat_completion_prompt_ready', request: { chat, dryRun: false } };
        }
        return { event: 'generate_after_combine_prompts', request: { prompt: [MAIN_PROMPT, main, 'You: Hi.', tail, instruction, 'Narrator:'].filter(Boolean).join('\n'), dryRun: false } };
    };
    for (const mainApi of ['openai', 'textgen']) {
        for (const order of ['reply built first', 'quiet built first', 'quiet interceptor before the reply\'s']) {
            const label = `${mainApi}, ${order}`;
            const host = await fakeHost({ st: { mainApi } });
            await host.st.addUser('Hi.');
            const startQuiet = async () => {
                await host.st.eventSource.emit('generation_started', 'quiet', { quiet_prompt: QUIET }, false);
                await host.turn.interceptor([], 8192, () => {}, 'quiet');
            };
            if (order.startsWith('quiet interceptor')) await startQuiet();
            await host.turn.interceptor([], 8192, () => {}, 'normal');
            if (!order.startsWith('quiet interceptor')) await startQuiet();
            const reply = built(host, false);
            const quiet = built(host, true);
            const both = order === 'quiet built first' ? [quiet, reply] : [reply, quiet];
            for (const { event, request } of both) await host.st.eventSource.emit(event, request);
            assert.ok(has(reply.request, STATIC_MARKER) && has(reply.request, '[Bag] empty'), `${label}: the reply's prompt was built with both`);
            assert.equal(host.turn.session().restored, '', `${label}: nothing had to be put back`);
            assert.equal(host.turn.session().prompted, true, `${label}: the reply's prompt is the reply's`);
            assert.ok(!has(quiet.request, STATIC_MARKER) && !has(quiet.request, '[Bag]'), `${label}: the quiet prompt carries none of it`);
            assert.ok(has(quiet.request, asked), `${label}: its instruction is kept`);
            if (mainApi === 'openai') assert.deepEqual(quiet.request.chat.map(message => message.content), [MAIN_PROMPT, 'Hi.', asked], `${label}: the tail's message goes with it`);
            host.close();
        }
    }
    // A quiet generation run from inside the reply's interceptor (the order the fake runs it in): the slots are kept for the reply.
    const host = await fakeHost();
    const real = host.turn.interceptor;
    let nested = null;
    host.st.interceptor = async (...args) => {
        await real(...args);
        if (args[3] === 'normal') {
            nested = await host.st.generate('quiet', { reply: 'A day.', quietPrompt: QUIET });
            assert.ok(host.st.prompt(STATIC_KEY).startsWith(STATIC_MARKER), 'the slots were never emptied');
        }
    };
    const { request } = await host.send('Hello.', 'Hi.\n<Changes>\n+ item Rope\n</Changes>');
    assert.ok(!has(nested.request, STATIC_MARKER) && !has(nested.request, '[Bag]'));
    assert.ok(has(nested.request, asked));
    assert.ok(has(request, STATIC_MARKER));
    assert.equal(noCue(request.chat.at(-1).content), '[Bag] empty');
    assert.deepEqual(items(host), { Rope: 1 }, 'the reply is captured');
    host.close();
});

test('the prompt history loses hidden change blocks; text completion too', async () => {
    const host = await fakeHost();
    await host.send('One.', 'Reply one.\n<Changes>\n+ item Rope\n</Changes>');
    const { request } = await host.send('Two.', 'Reply two.');
    const assistant = request.chat.filter(message => message.role === 'assistant').map(message => message.content);
    assert.deepEqual(assistant, ['The story begins.', 'Reply one.']);
    assert.ok(systemText(request).includes('<Changes>'), 'the instruction\'s own example stays');
    host.close();

    const text = await fakeHost({ st: { mainApi: 'textgenerationwebui' } });
    await text.send('One.', 'Reply one.\n<Changes>\n+ item Rope\n</Changes>');
    const second = await text.send('Two.', 'Reply two.');
    assert.ok(!second.request.prompt.includes('STORY_SUITE_V2'));
    assert.ok(!second.request.prompt.includes('+ item Rope'));
    assert.ok(second.request.prompt.includes(STATIC_MARKER));
    assert.ok(second.request.prompt.includes('[Bag] Rope x1'));
    text.close();
});

test('text completion: what SillyTavern left out is put back around the prompt', () => {
    const registry = createRegistry();
    registry.register(bag());
    const turn = createTurn({ ctx: {}, store: {}, bus: {}, registry, settings: () => ({}) });
    const event = { prompt: 'Story so far.' };
    turn.onTextPromptReady(event);
    assert.equal(event.prompt, 'Story so far.', 'no pending reply: untouched');
});

test('Continue reads only a block the continuation adds, and keeps what the reply was told', async () => {
    const host = await fakeHost();
    await host.send('Go.', 'Half a reply');
    await host.cont(' and the rest.\n<Changes>\n+ item Rope\n</Changes>');
    assert.deepEqual(items(host), { Rope: 1 });
    await host.cont(' Even more.');
    assert.deepEqual(items(host), { Rope: 1 }, 'the block already read is not read again');
    assert.equal(stored(host, 2).receipts.length, 1);
    host.close();
});

test('a swipe is captured on its own; a message the interceptor did not prepare is not captured', async () => {
    const host = await fakeHost();
    const turns = [];
    host.sdk.on('turn', turn => turns.push([turn.index, turn.type, turn.receipts.length]));
    await host.send('Go.', 'First.\n<Changes>\n+ item Rope\n</Changes>');
    await host.swipe('Second.\n<Changes>\n+ item Lamp\n</Changes>');
    assert.deepEqual(turns, [[2, 'normal', 1], [2, 'swipe', 1]]);
    assert.equal(items(host).Lamp, 1);
    assert.match(host.ctx.chat[2].swipes[1], /^Second\.\n\n<!-- STORY_SUITE_V2/);
    host.st.addMessage({ name: 'Narrator', is_user: false, mes: '<Changes>\n+ item Gold\n</Changes>', swipes: ['x'], swipe_id: 0, swipe_info: [{ extra: {} }], extra: {} });
    await host.turn.onMessageReceived(3);
    assert.ok(!('Gold' in items(host)), '/sendas or a narrator message is not a reply');
    host.close();
});

test('macros in the story\'s own words reach the model as written, except the persona and character names', async () => {
    const host = await fakeHost();
    await host.send('Go.', 'Done.\n<Changes>\n+ item {{random::a,b}} Map\n+ item <USER> Key\n</Changes>');
    const { request } = await host.send('Look.', 'Ok.');
    const tail = request.chat.at(-1).content;
    assert.ok(tail.includes('{\u200b{random::a,b}} Map'), 'other macros are kept as written');
    assert.ok(tail.includes('<\u200bUSER> Key'));
    host.close();
});

test('{{user}} and {{char}} in the static and tail text become the persona\'s and character\'s names', async () => {
    const note = {
        id: 'note',
        context: { static: () => 'Only {{user}} decides what {{user}} does.', tail: () => ({ lines: ['{{char}} waits for {{ user }}.'], optional: [] }) },
    };
    const host = await createHost({ fakes: true, core: false, modules: [note] });
    const one = await host.send('Hi.', 'Hello.');
    const two = await host.send('Again.', 'Hello again.');
    const text = request => request.chat.map(message => message.content).join('\n');
    assert.ok(text(one.request).includes(`Only ${host.ctx.name1} decides what ${host.ctx.name1} does.`));
    assert.ok(text(one.request).includes(`${host.ctx.name2} waits for ${host.ctx.name1}.`));
    assert.ok(!text(one.request).includes('{{user}}') && !text(one.request).includes('{\u200b{user}}'));
    assert.equal(host.turn.session(), null);
    const statics = [one, two].map(({ request }) => request.chat.find(message => message.content.includes('Only ')).content);
    assert.equal(statics[0], statics[1], 'the static part stays byte-identical');
    host.close();
});
