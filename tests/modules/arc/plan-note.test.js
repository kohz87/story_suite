// The Arc card's note goes to the planner with that plan, and the arc query tells when the arc was accepted.
import test from 'node:test';
import assert from 'node:assert/strict';

import { createFakeModel, createHost } from '../../../testkit/index.js';
import { createModule } from '../../../modules/director/module.js';
import { createArcController } from '../../../modules/arc/index.js';
import { browserStore } from '../../../modules/director/screens/index.js';

const said = (text, lines) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const PLAN = '<plan>\nARC: The Drowned Bell — the old bell rings\nBEAT: Bell Rings — it tolls\nBEAT: Diver Missing — gone\nSECRET: Bell Curse — ashes\n</plan>';

async function setUp() {
    const model = createFakeModel([PLAN]);
    const host = await createHost({ callModel: model, modules: [createModule()] });
    const memory = new Map();
    const store = browserStore({ getItem: key => (memory.has(key) ? memory.get(key) : null), setItem: (key, value) => memory.set(key, String(value)) });
    const arc = createArcController({ sdk: () => host.sdk, chat: () => host.ctx.chat, chatId: () => 'chat-1', store, notify: () => {} });
    await host.send('Hello.', said('The harbour.', ['~ time June 3, 1200, 08:00 am', '+ hook Old Debt — Mira owes the guild']));
    return { host, arc, model };
}

test('a note typed on the Arc card is in the planner request', async t => {
    t.mock.method(console, 'warn', () => {});
    const { host, arc, model } = await setUp();
    await arc.plan({ note: 'more about Joris Veen and the miller' });
    assert.match(model.calls[0].prompt + model.calls[0].system, /more about Joris Veen and the miller/);
    host.close();
});

test('the accepted arc carries its time, so the card can say when', async t => {
    t.mock.method(console, 'warn', () => {});
    const { host, arc } = await setUp();
    await arc.plan();
    await arc.accept();
    const minutes = host.sdk.query('director.arc').current.minutes;
    assert.ok(Number.isSafeInteger(minutes));
    assert.equal(minutes, host.sdk.query('director.time', {}).minutes);
    host.close();
});
