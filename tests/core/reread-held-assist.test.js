// A Re-read of a reply whose safety-net (<Changes-assist>) lines belong to a module that is held back is refused
// with the module's name and reason, and changes nothing (it used to throw: heldWhy was not imported).
import test from 'node:test';
import assert from 'node:assert/strict';
import { withAssist } from '../../core/capture.js';
import { createHost } from '../../testkit/index.js';

const wounds = () => ({
    id: 'qa-wounds',
    name: 'QA Wounds',
    version: '1.0.0',
    domains: { wounds: { initial: () => ({ hurt: {} }) } },
    capture: {
        kinds: { wound: { grammar: '~ wound Name — how' } },
        apply(ctx, line) { ctx.draft('wounds').hurt[line.name] = true; return { summary: `${line.name} is hurt.`, narrate: false }; },
    },
});

test('Re-read of a reply with safety-net lines of a held module is refused, not thrown', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [wounds()] });
    t.after(() => host.close());
    const reply = await host.send('Go.', 'He is hurt.\n\n<Changes>\n~ wound Ann — a cut\n</Changes>');
    const message = host.ctx.chat[reply.index];
    message.mes = withAssist(message.mes, ['~ wound Bob — a bruise']);
    if (Array.isArray(message.swipes)) message.swipes[message.swipe_id ?? 0] = message.mes;
    assert.equal(host.registry.setEnabled('qa-wounds', false, 'Switched off for the test.'), true);
    const before = JSON.stringify(host.head());
    const done = await host.turn.reread(reply.index);
    assert.equal(done.ok, false);
    assert.match(done.message, /QA Wounds/);
    assert.match(done.message, /Switched off for the test/);
    assert.equal(JSON.stringify(host.head()), before, 'nothing was changed');
});
