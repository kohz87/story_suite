// The scripted chat of tests/core/keep-blocks.test.js: sends, a miss, swipe and swipe back, an edited Re-read (grown, then shrunk),
// a middle delete, a rewind, a reload and a chat change, with the host setting `keepRecentBlocks` on or off. The flag-off fixture
// (fixtures/keep-blocks-main.json) was recorded by running this same script on origin/main 08822ad2f, before the setting existed.
import { createHash } from 'node:crypto';
import { createHost } from '../../testkit/index.js';

export const said = (story, lines) => (lines ? `${story}\n<Changes>\n${lines.join('\n')}\n</Changes>` : story);

// The steps, each → the prompt it sent (or null) and what the chat holds after it.
export async function runScript(keep) {
    const host = await createHost({ settings: keep === null ? {} : { core: { keepRecentBlocks: keep } } });
    const steps = [];
    const prompt = request => (request?.chat ?? []).map(m => `${m.role}:${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`);
    const snap = (name, request = null) => steps.push({
        name,
        prompt: request ? prompt(request) : null,
        text: host.ctx.chat.map(m => m.mes),
        records: host.ctx.chat.map(m => m.extra?.storySuite ?? null),
        state: host.head(),
    });
    const send = async (name, text, reply) => snap(name, (await host.send(text, reply)).request);
    try {
        await send('one', 'I wake.', said('You wake at the gate.', ['+ item Rope']));
        await send('two', 'I buy bread.', said('You buy bread.', ['+ item Bread']));
        await send('miss', 'I walk.', 'You walk on.');
        await send('three', 'I look.', said('A lamp lies here.', ['+ item Lamp']));
        snap('swipe', (await host.swipe(said('A map lies here.', ['+ item Map']))).request);
        await host.st.swipeTo(host.ctx.chat.length - 1, 0);
        snap('swipe back');
        await send('four', 'I take it.', said('You take it.', ['+ item Coin']));
        const at = host.ctx.chat.length - 1;
        await host.st.editMessage(at, said('You take it and a cup.', ['+ item Coin', '+ item Cup']));
        await host.turn.reread(at);
        await send('grown', 'I go on.', said('You go on.', ['+ item Stick']));
        const back = host.ctx.chat.length - 1;
        await host.st.editMessage(back, said('You go on, empty-handed.', []));
        await host.turn.reread(back);
        await send('shrunk', 'I stop.', said('You stop.', ['+ item Stone']));
        await host.st.deleteMessage(4);
        await send('middle delete', 'I rest.', said('You rest.', ['+ item Blanket']));
        const last = host.store.receipts().at(-1);
        await host.sdk.rewind({ index: last.index, beforeRev: last.receipt.rev });
        snap('rewind');
        await host.turn.onChatChanged();
        await send('reload', 'I wake again.', said('Morning.', ['+ item Dew']));
        const kept = structuredClone(host.ctx.chat);
        await host.st.loadChat([structuredClone(kept[0])], 'other');
        await send('other chat', 'Hello.', said('A new tale.', ['+ item Hat']));
        await host.st.loadChat(kept, 'first');
        await send('chat back', 'I return.', said('Back again.', ['+ item Key']));
        return steps;
    } finally { host.close(); }
}

// What the fixture keeps of a run: each step's prompt and texts in full, its records and state as one hash.
export const compact = steps => steps.map(({ name, prompt, text, records, state }) => ({
    name, prompt, text, stateHash: createHash('sha256').update(JSON.stringify({ records, state })).digest('hex'),
}));
