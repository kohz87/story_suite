// Module lifecycle (docs/v2/LIFECYCLE.md): discovery, dormant hooks, restore-pending barriers,
// Re-read while held, setup on becoming ready, features of held modules, and uniform entry-point codes.
import test from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../testkit/index.js';
import { ensureModules } from '../../core/sdk.js';
import { PEER, director, initReceipts, mech, modulesById, requestText, social } from './lifecycle.helpers.js';

test('discovery: a dormant or restore-pending module is not advertised ready, so no fights are asked for', async () => {
    // Story Director\'s fightRunner on a lifecycle-capable host: a ready entry that registers combat.* commands.
    const fights = sdk => sdk.modules().some(entry => entry.id !== PEER && entry.status === 'ready' && entry.commands.some(type => type.startsWith('combat.')));
    const host = await createHost({ modules: [] });
    await host.sdk.registerModule(mech({ peers: { 'missing-mod': '^1' } }));
    assert.equal(fights(host.sdk), false, 'dormant: no encounter requests');
    assert.equal(host.sdk.query('combat.session'), null, 'its query probe answers nothing either');
    await host.sdk.registerModule({ id: 'missing-mod', version: '1.0.0' });
    assert.equal(fights(host.sdk), true, 'late activation shows it at the next look');
    host.registry.setRestore('pending', 'Restoring a save point.');
    assert.equal(fights(host.sdk), false, 'restore-pending: no mechanics module is ready');
    host.registry.setRestore('idle');
    assert.equal(fights(host.sdk), true);
    host.close();
});

test('dormant hooks do not block Story Block or NSD generation; ready ones still do', async () => {
    const calls = {};
    const host = await createHost({ modules: [social()] });
    await host.sdk.registerModule(mech({ calls }));
    const sent = await host.send('Hello?', 'A reply.');
    assert.notEqual(sent.aborted, true);
    assert.deepEqual(host.st.notices, []);
    assert.deepEqual(host.turn.blocked(), []);
    assert.deepEqual(calls, {});
    assert.match(requestText(host), /NSD RULES/);
    assert.doesNotMatch(requestText(host), /RB RULES|RB CUE/);

    // Ready: its veto holds the story back, with its reason.
    await host.sdk.registerModule(director());
    host.st.addUser('Again.');
    const stopped = await host.st.generate('normal', { reply: 'No.' });
    assert.equal(stopped.aborted, true);
    assert.deepEqual(host.st.notices.map(item => item.reason), ['Make a character first.']);
    assert.deepEqual((await host.turn.blockers()).map(item => item.moduleId), ['rpg-battle']);

    // The peer goes away again: the veto is suppressed, not answered false.
    host.registry.setEnabled(PEER, false);
    const go = await host.st.generate('normal', { reply: 'It goes.' });
    assert.notEqual(go.aborted, true);
    assert.equal(host.st.notices.length, 1);
    assert.deepEqual(await host.turn.blockers(), []);
    host.close();
});

test('restore-pending: a host-wide barrier; nothing is ready, generation waits, the host\'s own steps stay', async () => {
    const calls = {};
    const host = await createHost({ modules: [director(), social()] });
    await host.sdk.registerModule(mech({ calls, hooks: { canGenerate: () => true } }));
    await host.sdk.command('combat.start', {});
    assert.equal(host.registry.restore().state, 'idle');
    const announced = [];
    host.sdk.on('modules', ({ changes }) => announced.push(...changes.map(change => `${change.id}:${change.status}`)));

    host.registry.setRestore('pending', 'Going back to a save point.');
    host.sdk.view();
    assert.deepEqual(announced.sort(), ['npc-state-delta:restore-pending', 'rpg-battle:restore-pending', 'story-block:restore-pending', 'story-director:restore-pending']);
    for (const entry of host.sdk.modules()) assert.deepEqual([entry.status, entry.reason], ['restore-pending', 'Going back to a save point.'], entry.id);

    // Dispatch: mechanics commands refuse with RESTORE_PENDING; the host's own commands and steps go on.
    const refused = await host.sdk.command('combat.start', {});
    assert.deepEqual({ ok: refused.ok, code: refused.code }, { ok: false, code: 'RESTORE_PENDING' });
    assert.match(refused.message, /^RPG Battle is waiting: Going back to a save point\.$/);
    assert.equal((await host.bus.command('director.advance', {}, { cause: 'system' })).code, 'RESTORE_PENDING');
    assert.equal(host.registry.capture('wound'), null);
    assert.equal(host.sdk.query('combat.session'), null);
    assert.deepEqual(host.registry.hookEntries('beforeGenerate').map(item => item.moduleId), host.registry.hookEntries('beforeGenerate').filter(item => item.moduleId === 'story-block').map(item => item.moduleId));
    assert.deepEqual(host.registry.contexts().map(item => item.moduleId), ['story-block']);
    const scene = await host.sdk.command('scene.place', { name: 'Gate' });
    assert.notEqual(scene.code, 'RESTORE_PENDING', 'Story Block\'s own commands are not held');

    // Generation waits, with the reason; the module set-up does not touch the chat.
    const stopped = await host.send('Wait.', 'Never.');
    assert.equal(stopped.aborted, true);
    assert.deepEqual(host.st.notices.at(-1), { reason: 'Going back to a save point.', moduleId: 'story-block' });
    assert.deepEqual((await host.turn.blockers()).map(item => [item.moduleId, item.action, item.canOpen]), [['story-block', false, false]]);
    const receipts = host.sdk.receipts().length;
    assert.deepEqual(await ensureModules({ store: host.store, bus: host.bus, registry: host.registry, events: host.events }), []);
    assert.equal(host.sdk.receipts().length, receipts);

    // Failed only reports; it holds nothing. Idle: back to ready and the story goes on.
    host.registry.setRestore('failed', 'A part disagreed.');
    assert.deepEqual(host.registry.restore(), { state: 'failed', reason: 'A part disagreed.' });
    assert.equal(modulesById(host)['rpg-battle'].status, 'ready');
    host.registry.setRestore('idle');
    assert.deepEqual(host.registry.restore(), { state: 'idle', reason: '' });
    assert.equal((await host.sdk.command('combat.start', {})).ok, true);
    const go = await host.st.generate('normal', { reply: 'Now.' });
    assert.notEqual(go.aborted, true);
    assert.throws(() => host.registry.setRestore('maybe'), /a restore is idle, pending, failed/);
    host.close();
});

test('a module with no peers behaves as before: same lookups, same dispatch, no new refusals', async () => {
    const host = await createHost({ modules: [social()] });
    assert.deepEqual(host.registry.lifecycles().map(item => item.status), ['ready', 'ready']);
    assert.deepEqual(host.registry.peers('npc-state-delta'), []);
    assert.equal(host.registry.refusal('scene.place'), null);
    assert.equal(host.registry.held('npc-state-delta'), false);
    assert.equal(host.registry.lifecycle('nobody'), null);
    assert.equal((await host.sdk.command('scene.place', { name: 'Gate' })).ok, true);
    host.close();
});

test('Re-read while a module is held back refuses and replaces nothing; it works again when the module is back', async () => {
    const host = await createHost({ modules: [director(), social()] });
    await host.sdk.registerModule(mech({ hooks: { canGenerate: () => true } }));
    await host.send('Plain.', 'Nothing changes here.');
    const plain = host.ctx.chat.length - 1;
    await host.send('I go.', 'He steps out.\n\n<Changes>\n~ wound Ann — a cut\n</Changes>');
    const wounded = host.ctx.chat.length - 1;
    assert.deepEqual(Object.keys(host.head().domains.party.actors), ['Ann']);
    const text = host.ctx.chat[wounded].mes;

    // Dormant (the peer is off): refused with the reason; the party, the reply and its receipts are as they were.
    host.registry.setEnabled(PEER, false);
    const receipts = host.sdk.receipts().length;
    const refused = await host.sdk.reread(wounded);
    assert.deepEqual({ ok: refused.ok, code: refused.code }, { ok: false, code: 'DEPENDENCY_UNAVAILABLE' });
    assert.match(refused.message, /^Re-read is waiting for RPG Battle: Needs Story Director, which is not ready: Turned off\. Nothing was changed\.$/);
    assert.deepEqual(Object.keys(host.head().domains.party.actors), ['Ann']);
    assert.equal(host.ctx.chat[wounded].mes, text);
    assert.equal(host.sdk.receipts().length, receipts);
    // A reply that holds nothing of that module can still be read again.
    assert.equal((await host.sdk.reread(plain)).ok, true);

    // Restore pending: the same, with its own code.
    host.registry.setEnabled(PEER, true);
    host.registry.setRestore('pending', 'Going back to a save point.');
    const waiting = await host.sdk.reread(wounded);
    assert.deepEqual({ ok: waiting.ok, code: waiting.code, message: waiting.message }, { ok: false, code: 'RESTORE_PENDING', message: 'Re-read is waiting for RPG Battle: Going back to a save point. Nothing was changed.' });
    assert.deepEqual(Object.keys(host.head().domains.party.actors), ['Ann']);

    // Back: Re-read works and keeps Ann.
    host.registry.setRestore('idle');
    const done = await host.sdk.reread(wounded);
    assert.equal(done.ok, true, done.message);
    assert.deepEqual(Object.keys(host.head().domains.party.actors), ['Ann']);
    host.close();
});

test('Re-read refuses for a held module\'s change line even when it never ran', async () => {
    const host = await createHost({ modules: [] });
    await host.sdk.registerModule(mech({ hooks: { canGenerate: () => true } }));            // dormant from the start
    await host.send('I go.', 'He steps out.\n\n<Changes>\n~ wound Ann — a cut\n</Changes>');
    const index = host.ctx.chat.length - 1;
    const refused = await host.sdk.reread(index);
    assert.deepEqual({ ok: refused.ok, code: refused.code }, { ok: false, code: 'DEPENDENCY_UNAVAILABLE' });
    await host.sdk.registerModule(director());
    assert.equal((await host.sdk.reread(index)).ok, true, 'and it reads again once the module runs');
    host.close();
});

test('a module that is ready again is set up before the next action, whether or not a view announced it first', async () => {
    for (const viewFirst of [false, true]) {
        const host = await createHost({ modules: [director()] });
        host.registry.setEnabled(PEER, false);
        await host.sdk.registerModule(mech());
        await host.send('Hi.', 'Hello.');
        assert.equal(Object.hasOwn(host.head().domains, 'party'), false, 'dormant: no party');
        host.registry.setEnabled(PEER, true);
        if (viewFirst) host.sdk.view();               // a render looks first and announces the change
        const done = await host.sdk.command('combat.start', {});
        assert.equal(done.ok, true, `${viewFirst}: ${done.message}`);
        assert.deepEqual(Object.keys(host.head().domains.party.actors), ['hero']);
        assert.equal(initReceipts(host, 'rpg-battle').length, 1);
        // The restore barrier dropping is the same.
        host.registry.setRestore('pending', 'x');
        host.sdk.view();
        host.registry.setRestore('idle');
        host.sdk.view();
        assert.equal((await host.sdk.command('combat.start', {})).ok, true);
        assert.equal(initReceipts(host, 'rpg-battle').length, 1);
        host.close();
    }
});

test('a module that became ready while a restore was pending is set up by the first action after it', async () => {
    const host = await createHost({ modules: [director()] });
    host.registry.setRestore('pending', 'Restoring.');
    await host.sdk.registerModule(mech());
    assert.equal(Object.hasOwn(host.head().domains, 'party'), false, 'nothing is set up during the barrier');
    host.registry.setRestore('idle');
    host.sdk.view();
    assert.equal((await host.sdk.command('combat.start', {})).ok, true);
    assert.equal(initReceipts(host, 'rpg-battle').length, 1);
    host.close();
});

test('features of a held module are off and unavailable, others\' needs on it are unmet, and no feature event tells it', async () => {
    const host = await createHost({ modules: [] });
    await host.sdk.registerModule(mech({ features: [{ id: 'rpg-battle.fights', label: 'Fights', default: true, prompt: true }] }));
    await host.sdk.registerModule({
        id: 'x-mod', name: 'X', version: '1.0.0', context: { static: () => 'X' },
        features: [
            { id: 'x-mod.kind', label: 'Needs a kind', needs: { kinds: ['wound'] } },
            { id: 'x-mod.command', label: 'Needs a command', needs: { commands: ['combat.start'] } },
            { id: 'x-mod.query', label: 'Needs a query', needs: { queries: ['combat.session'] } },
        ],
    });
    assert.equal(modulesById(host)['rpg-battle'].status, 'dormant');
    const dormant = Object.fromEntries(host.sdk.features().map(feature => [feature.id, feature]));
    for (const id of ['rpg-battle.fights', 'x-mod.kind', 'x-mod.command', 'x-mod.query']) assert.deepEqual([id, dormant[id].on, host.sdk.feature(id), host.registry.feature(id).available], [id, false, false, false]);
    assert.equal(host.registry.feature('rpg-battle.fights').why, modulesById(host)['rpg-battle'].reason, 'it says why');
    const events = [];
    host.sdk.on('feature', event => events.push(event));
    host.features.set('rpg-battle.fights', false);
    host.features.set('rpg-battle.fights', true);
    assert.deepEqual(events, [], 'no feature event for a module that is not running');

    // Running: on, available, and the others\' needs are met.
    await host.sdk.registerModule(director());
    for (const id of ['rpg-battle.fights', 'x-mod.kind', 'x-mod.command', 'x-mod.query']) assert.equal(host.sdk.feature(id), true, id);
    host.features.set('rpg-battle.fights', false);
    assert.deepEqual(events.map(event => [event.id, event.on, event.prompt]), [['rpg-battle.fights', false, true]]);
    // The restore barrier holds them the same way.
    host.registry.setRestore('pending', 'x');
    assert.equal(host.sdk.feature('x-mod.command'), false);
    host.registry.setRestore('idle');
    assert.equal(host.sdk.feature('x-mod.command'), true);
    host.close();
});

test('one code at every entry point: bus.command, ctx.call, sdk.command, sdk.preview and sdk.commit(token)', async () => {
    const host = await createHost({ modules: [director()] });
    await host.sdk.registerModule(mech());
    await host.sdk.registerModule({
        id: 'caller', domains: { caller: { initial: () => ({}) } },
        commands: { 'caller.try'(ctx) { let said = null; try { ctx.call('combat.start', {}); } catch (error) { said = error.code; } return { summary: 'tried', narrate: false, data: { said } }; } },
    });
    const preview = await host.sdk.preview('combat.start', {});
    assert.ok(preview.ok && preview.token, 'a preview while it runs');
    const codes = async () => ({
        bus: (await host.bus.command('combat.start', {}, { cause: 'system' })).code,
        busUi: (await host.bus.command('combat.start', {}, { cause: 'ui' })).code,
        call: await (async () => { const out = await host.sdk.command('caller.try', {}); return out.receipt?.data.said ?? out; })(),
        command: (await host.sdk.command('combat.start', {})).code,
        preview: (await host.sdk.preview('combat.start', {})).code,
        commit: (await host.sdk.commit(preview.token)).code,
    });
    host.registry.setEnabled(PEER, false);
    const same = code => ({ bus: code, busUi: code, call: code, command: code, preview: code, commit: code });
    assert.deepEqual(await codes(), same('DEPENDENCY_UNAVAILABLE'));
    host.registry.setEnabled(PEER, true);
    const again = await host.sdk.preview('combat.start', {});
    host.registry.setRestore('pending', 'x');
    // (The caller is a module too, so it is held as well and cannot call anything: its own action says the same.)
    const pending = { ...await codes(), commit: (await host.sdk.commit(again.token)).code };
    assert.equal(pending.call.code, 'RESTORE_PENDING');
    assert.deepEqual({ ...pending, call: 'RESTORE_PENDING' }, same('RESTORE_PENDING'));
    host.registry.setRestore('idle');
    assert.equal((await host.sdk.command('combat.start', {})).ok, true, 'and it runs again');
    assert.equal((await host.sdk.command('caller.try', {})).receipt.data.said, null);
    // The refusal says why, the same words everywhere.
    host.registry.setEnabled(PEER, false);
    const messages = [(await host.bus.command('combat.start', {}, { cause: 'system' })).message, (await host.sdk.command('combat.start', {})).message];
    assert.equal(messages[0], messages[1]);
    assert.match(messages[0], /^RPG Battle is not running: Needs Story Director, which is not ready/);
    host.close();
});
