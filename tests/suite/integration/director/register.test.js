// Story Director registers as a built-in module (core/modules-list.js, registerIsolated); its `register` hook does what index.js's start() did once registered.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../../../testkit/index.js';
import { fakeFightRunner } from './helpers/fake-fight-runner.js';
import { registerIsolated } from '../../../../core/boot/register-isolated.js';
import { storyDirectorModule } from '../../../../ui/legacy/director/module.js';
import { startDirector } from '../../../../ui/legacy/director/module/start.js';
import { personaName } from '../../../../modules/time/tracker/initiative.js';

const runtimeOf = host => ({ sdk: host.sdk, turn: host.turn, registry: host.registry });

test('the module registers once, and its chat state is set up', async () => {
    const host = await createHost({ modules: [fakeFightRunner()] });
    assert.equal(await registerIsolated(runtimeOf(host), storyDirectorModule), true);
    assert.ok(host.sdk.modules().some(entry => entry.id === 'story-director'));
    assert.ok(host.head().domains.director, 'a module enabled mid-chat gets its initial slice');
    assert.equal(await registerIsolated(runtimeOf(host), storyDirectorModule), false, 'a second registration is refused, not doubled');
    assert.equal(host.sdk.modules().filter(entry => entry.id === 'story-director').length, 1);
    host.close();
});

test('the module registers its Quiet scene toggle on the host header slot', async () => {
    const host = await createHost({ modules: [fakeFightRunner()] });
    await registerIsolated(runtimeOf(host), storyDirectorModule);
    assert.deepEqual(host.registry.headerControls().map(control => [control.key, control.label, control.query, control.command]), [['story-director/quiet', 'Quiet scene', 'pulse.quiet', 'director.pulse.quiet']]);
    assert.deepEqual(host.sdk.query('pulse.quiet', {}), { on: false });
    assert.equal((await host.sdk.command('director.pulse.quiet', { on: true })).ok, true);
    assert.deepEqual(host.sdk.query('pulse.quiet', {}), { on: true });
    host.close();
});

test('the register hook gives the time tracker the persona and subscribes to the turn once', () => {
    const subscribed = [];
    const info = console.info;
    console.info = () => {};
    try {
        startDirector({ substitute: text => (text === '{{user}}' ? 'Reader' : text), on: (name, fn) => subscribed.push([name, typeof fn]) });
    } finally { console.info = info; }
    assert.deepEqual(subscribed, [['turn', 'function']]);
    assert.equal(personaName(), 'Reader');
});

test('the module carries a register hook the host runs after the registry holds it', async () => {
    assert.equal(typeof storyDirectorModule.register, 'function');
    const host = await createHost({ modules: [fakeFightRunner()] });
    const seen = [];
    const spy = { ...storyDirectorModule, register: sdk => { seen.push(host.registry.lifecycle('story-director')?.status ?? 'missing'); return startDirector(sdk); } };
    const log = console.info;
    console.info = () => {};
    try { assert.equal(await registerIsolated(runtimeOf(host), spy), true); } finally { console.info = log; }
    assert.notEqual(seen[0], 'missing', 'the hook ran with the module already registered');
    host.close();
});
