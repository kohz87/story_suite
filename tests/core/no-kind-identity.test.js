// With no interaction kind registered, the prompt, chat metadata, receipts and guard mark are byte-identical to what main
// produced before interactions existed. The fixture was written by running this same scenario on origin/main (WRITE_NO_KIND=1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHost } from '../../testkit/index.js';
import { STATIC_KEY, TAIL_KEY } from '../../core/turn.js';
import { createGuards } from '../../core/commands/guards.js';

const FIXTURE = new URL('./fixtures/no-kind-identity.json', import.meta.url);
const reply = (text, lines) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;

// Ids are random: fix the sources so two runs of the same code write the same bytes.
function fixIds(t) {
    let seed = 7, n = 0;
    t.mock.method(Math, 'random', () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; });
    t.mock.method(globalThis.crypto, 'getRandomValues', bytes => { for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256); return bytes; });
    t.mock.method(globalThis.crypto, 'randomUUID', () => `00000000-0000-4000-8000-${String(n++).padStart(12, '0')}`);
}

async function scenario() {
    const host = await createHost();
    const out = {};
    try {
        const first = await host.send('I look around.', reply('A rope hangs here.', ['+ item Rope', '~ place Harbour']));
        out.prompt = { static: host.st.prompt(STATIC_KEY), tail: host.st.prompt(TAIL_KEY), request: first.request };
        await host.send('I take it.', reply('You take it.', ['+ item Coin']));
        await host.swipe(reply('You take it, slowly.', ['+ item Lamp']));
        // A third reply, a middle delete, a rewind and a swipe flip: the head-move reconcile and the hooks run on each and touch nothing.
        await host.send('I look again.', reply('A map.', ['+ item Map']));
        await host.st.deleteMessage(2);
        const last = host.store.receipts().at(-1);
        await host.sdk.rewind({ index: last.index, beforeRev: last.receipt.rev });
        await host.st.swipeTo(host.ctx.chat.length - 1, 0);
        await host.turn.onChatChanged();
        out.prompts = host.st.promptLog;
        out.metadata = host.ctx.chatMetadata;
        out.records = host.ctx.chat.map(message => message.extra?.storySuite ?? null);
        out.state = host.head();
        // The checkpoint trust mark (what main computes for this host): no `;kinds:` suffix while no module registers a kind.
        out.guardMark = createGuards({ registry: host.registry, findQuery: () => null }).guardMark();
    } finally { host.close(); }
    return JSON.parse(JSON.stringify(out));
}

test('no kind registered: prompt, chat metadata, receipts and guard mark equal main\'s recorded output', async t => {
    fixIds(t);
    const got = await scenario();
    if (process.env.WRITE_NO_KIND === '1') { writeFileSync(FIXTURE, `${JSON.stringify(got, null, 1)}\n`); return; }
    const want = JSON.parse(readFileSync(FIXTURE, 'utf8'));
    assert.ok(want.metadata && typeof want.metadata === 'object', 'the fixture records chat metadata');
    assert.ok(Array.isArray(want.prompts) && want.prompts.length > 0, 'the fixture records every extension-prompt write');
    assert.ok(got.metadata && typeof got.metadata === 'object', 'chat metadata is present');
    assert.deepEqual(got.prompt, want.prompt, 'the prompt');
    assert.deepEqual(got.prompts, want.prompts, 'every extension-prompt write (static and tail text)');
    assert.deepEqual(got.metadata, want.metadata, 'chat metadata');
    assert.deepEqual(got.records, want.records, 'receipts and the guard mark on each reply');
    assert.deepEqual(got.state, want.state, 'the state');
    assert.equal(typeof want.guardMark, 'string', 'the fixture records the guard mark');
    // The core registers the fight kind (I6, plan §2.4): the mark is main's byte for byte plus that one entry, and nothing else moves.
    assert.match(got.guardMark, /^;kinds:story-block\/fight@[^;,]+:[01]$/u);
    assert.equal(got.guardMark.replace(/;kinds:story-block\/fight@[^;,]+:[01]$/u, ''), want.guardMark, 'the guard mark, byte for byte, but for the fight kind\'s entry');
    assert.ok(!JSON.stringify(got).includes('interaction'), 'no interaction key appears anywhere');
});
