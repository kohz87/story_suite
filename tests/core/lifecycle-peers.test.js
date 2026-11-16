// Module lifecycle (docs/v2/LIFECYCLE.md): requires.peers validation, dormant/ready transitions,
// missing/late/wrong-version/off/chained/cyclic peers, and dormant module isolation.
import test from 'node:test';
import assert from 'node:assert/strict';

import { createHost } from '../../testkit/index.js';
import { createRegistry, definitionProblems, definitionWarnings } from '../../core/registry.js';
import { ensureModules } from '../../core/sdk.js';
import { PEER, director, initReceipts, mech, modulesById, requestText, social } from './lifecycle.helpers.js';

test('requires.peers is checked as a map of module ids to ranges; other requires keys are still ignored with the warning', () => {
    assert.deepEqual(definitionProblems({ id: 'a', requires: { storyBlock: '^2', peers: { [PEER]: '^2', 'other-mod': '>=1.0.0-alpha.2' } } }), []);
    assert.match(definitionProblems({ id: 'a', requires: { peers: [PEER] } }).join(), /requires\.peers is not an object/);
    assert.match(definitionProblems({ id: 'a', requires: { peers: { [PEER]: 'soon' } } }).join(), /requires\.peers\["story-director"\] is not a version range/);
    assert.match(definitionProblems({ id: 'a', requires: { peers: { [PEER]: 3 } } }).join(), /is not a version range/);
    assert.match(definitionProblems({ id: 'a', requires: { peers: { 'Story Director': '^2' } } }).join(), /is not a module id/);
    assert.deepEqual(definitionWarnings({ id: 'a', requires: { storyBlock: '^2', peers: { [PEER]: '^2' } } }), []);
    assert.deepEqual(definitionWarnings({ id: 'a', requires: { peers: { [PEER]: '^2' }, storyDirector: '^2' } }),
        ['"requires.storyDirector" is not a requires field this Story Block knows; it is ignored']);
    const registry = createRegistry({ hostVersion: '2.0.0-beta.2' });
    assert.throws(() => registry.register({ id: 'bad', requires: { peers: { [PEER]: 'soon' } } }), /cannot be registered/);
    assert.equal(registry.has('bad'), false);
});

test('a module with no peers is always ready, and sdk.modules() keeps its fields and adds status and reason', async () => {
    const host = await createHost({ modules: [social()] });
    const entry = modulesById(host)['npc-state-delta'];
    assert.deepEqual(entry, {
        id: 'npc-state-delta', name: 'NPC State Delta', version: '1.2.20', domains: ['npc'], commands: [], kinds: [], interactions: [], tabs: [], headerControls: [], features: [], capabilities: [], status: 'ready', reason: null,
    });
    assert.equal(modulesById(host)['story-block'].status, 'ready');
    assert.ok(Object.isFrozen(entry));
    host.close();
});

test('a missing peer: the module is dormant, its names are reserved once, and it costs nothing', async () => {
    const calls = {};
    const host = await createHost({ modules: [social()] });
    await host.sdk.registerModule(mech({ calls }));
    const entry = modulesById(host)['rpg-battle'];
    assert.equal(entry.status, 'dormant');
    assert.equal(entry.reason, 'Needs story-director >=2.0.0-beta.1, which is not installed.');
    assert.deepEqual([entry.domains, entry.commands, entry.kinds], [['party'], ['combat.start', 'combat.peek'], ['wound']], 'declared inventory stays listed');

    // Reserved: nobody else can take its names, and it was registered once.
    assert.equal(host.registry.domainOwner('party'), 'rpg-battle');
    await assert.rejects(host.sdk.registerModule(mech()), /already registered|already belongs/);
    await assert.rejects(host.sdk.registerModule({ id: 'squatter', commands: { 'combat.start': () => ({}) } }), /"combat.start" already belongs to "rpg-battle"/);
    assert.equal(host.sdk.modules().filter(item => item.id === 'rpg-battle').length, 1);

    // No domain init, no receipt for it.
    assert.equal(Object.hasOwn(host.head().domains, 'party'), false);
    assert.deepEqual(initReceipts(host, 'rpg-battle'), []);
    assert.equal(host.registry.initialState().domains.party, undefined);

    // Views can show the reason; queries answer nothing; tabs stay.
    assert.equal(host.sdk.query('combat.session'), null);
    assert.ok(host.registry.tabs().some(tab => tab.id === 'party'));

    // Actions refuse with the reason; the system path finds no command; nothing is committed.
    const before = host.sdk.receipts().length;
    const refused = await host.sdk.command('combat.start', {});
    assert.deepEqual({ ok: refused.ok, code: refused.code }, { ok: false, code: 'DEPENDENCY_UNAVAILABLE' });
    assert.match(refused.message, /^RPG Battle is not running: Needs story-director/);
    assert.equal((await host.sdk.preview('combat.start', {})).code, 'DEPENDENCY_UNAVAILABLE');
    assert.equal((await host.bus.command('combat.start', {}, { cause: 'system' })).code, 'DEPENDENCY_UNAVAILABLE');
    assert.equal(host.registry.command('combat.start'), null);
    assert.equal(host.sdk.receipts().length, before);

    // No hooks, no context, no capture, no cues, no veto.
    assert.deepEqual(host.registry.hookEntries('canGenerate').map(item => item.moduleId), ['npc-state-delta']);
    assert.deepEqual(host.registry.contexts().map(item => item.moduleId), ['npc-state-delta', 'story-block']);
    assert.equal(host.registry.capture('wound'), null);
    const out = await host.send('I go.', 'He steps out.\n\n<Changes>\n~ wound Ann — a cut\n</Changes>');
    assert.notEqual(out.aborted, true, 'a dormant module\'s canGenerate is suppressed, not answered false');
    assert.deepEqual(host.st.notices, []);
    assert.deepEqual(calls, {}, 'none of its hooks, commands or capture ran');
    assert.doesNotMatch(requestText(host), /RB RULES|RB TAIL|RB CUE|wound/);
    assert.match(requestText(host), /NSD RULES/, 'the others are there');
    assert.equal(Object.hasOwn(host.head().domains, 'party'), false);
    assert.deepEqual(await host.turn.blockers(), []);
    host.close();
});

test('a dormant module\'s command reached by ctx.call from another module is catchable, not fatal', async () => {
    const host = await createHost({ modules: [] });
    await host.sdk.registerModule(mech());      // dormant: needs Story Director
    await host.sdk.registerModule({
        id: 'caller',
        domains: { caller: { initial: () => ({}) } },
        commands: {
            'caller.try'(ctx) {
                let said = null;
                try { ctx.call('combat.start', {}); } catch (error) { said = error.code; }
                return { summary: `said ${said}`, narrate: false, data: { said } };
            },
        },
    });
    const done = await host.sdk.command('caller.try', {});
    assert.equal(done.ok, true);
    assert.equal(done.receipt.data.said, 'DEPENDENCY_UNAVAILABLE');
    host.close();
});

test('a late peer wakes the module on registration: set up once, advertised once, never registered twice', async () => {
    const calls = {};
    const host = await createHost({ modules: [social()] });
    const announced = [];
    host.sdk.on('modules', ({ changes }) => announced.push(...changes.map(change => `${change.id}:${change.from}>${change.status}`)));
    await host.sdk.registerModule(mech({ calls }));
    assert.deepEqual(announced, ['rpg-battle:null>dormant']);

    await host.sdk.registerModule(director());
    assert.deepEqual(announced, ['rpg-battle:null>dormant', 'rpg-battle:dormant>ready'], 'advertised once');
    const entry = modulesById(host)['rpg-battle'];
    assert.deepEqual([entry.status, entry.reason], ['ready', null]);
    assert.deepEqual(host.sdk.modules().map(item => item.id), ['npc-state-delta', 'rpg-battle', 'story-block', PEER].sort());
    assert.deepEqual(host.head().domains.party, { rulesVersion: 2, rulesHash: 'h-1', actors: {} }, 'set up when ready');
    assert.equal(initReceipts(host, 'rpg-battle').length, 1);

    // Everything is on now; more cycles change nothing and announce nothing.
    host.sdk.view();
    await host.sdk.command('director.advance', {});
    await ensureModules({ store: host.store, bus: host.bus, registry: host.registry, events: host.events });
    assert.equal(initReceipts(host, 'rpg-battle').length, 1);
    assert.equal(announced.length, 2);
    assert.deepEqual(host.registry.hookEntries('canGenerate').map(item => item.moduleId), ['npc-state-delta', 'rpg-battle']);
    assert.ok(host.registry.capture('wound'));
    assert.equal((await host.sdk.command('combat.start', {})).ok, true);
    assert.deepEqual(host.sdk.query('combat.session'), { fighters: ['hero'] });
    await assert.rejects(host.sdk.registerModule(director()), /already registered/);
    host.close();
});

test('a peer that registers first, then the module: ready at once', async () => {
    const host = await createHost({ modules: [director()] });
    await host.sdk.registerModule(mech());
    assert.equal(modulesById(host)['rpg-battle'].status, 'ready');
    assert.equal(initReceipts(host, 'rpg-battle').length, 1);
    host.close();
});

test('a dormant module on a new chat has no domain; a chat that has the domain keeps it', async () => {
    const host = await createHost({ modules: [] });
    await host.sdk.registerModule(mech());
    await host.send('Hi.', 'Hello.');
    assert.equal(Object.hasOwn(host.head().domains, 'party'), false);
    await host.sdk.registerModule(director());
    assert.ok(host.head().domains.party);
    const chat = structuredClone(host.ctx.chat);
    host.close();

    // The same chat with the peer gone: dormant, and the saved slice is untouched.
    const again = await createHost({ modules: [], st: { chat } });
    await again.sdk.registerModule(mech());
    assert.equal(modulesById(again)['rpg-battle'].status, 'dormant');
    assert.deepEqual(again.head().domains.party, { rulesVersion: 2, rulesHash: 'h-1', actors: {} });
    assert.equal(initReceipts(again, 'rpg-battle').length, 1, 'not set up again');
    again.close();
});

test('wrong-version peers: ranges are checked, prereleases included', async () => {
    const cases = [
        ['2.0.0-beta.2', '>=2.0.0-beta.1', 'ready'],
        ['2.0.0-beta.2', '^2', 'ready'],
        ['2.0.0', '>=2.0.0-beta.1', 'ready'],
        ['2.0.0-alpha.9', '>=2.0.0-beta.1', 'dormant'],
        ['1.9.0', '^2', 'dormant'],
        ['3.0.0', '^2', 'dormant'],
        ['2.0.0-beta.2', '>=2.0.0', 'dormant'],
        ['', '^2', 'dormant'],
        ['not-a-version', '^2', 'dormant'],
    ];
    for (const [version, range, expected] of cases) {
        const host = await createHost({ modules: [director(version)] });
        await host.sdk.registerModule(mech({ range }));
        const entry = modulesById(host)['rpg-battle'];
        assert.equal(entry.status, expected, `${version || '(no version)'} vs ${range}`);
        if (expected === 'dormant') assert.match(entry.reason, new RegExp(`^Needs story-director ${range.replace(/[.^>=*]/g, '\\$&')}; the one installed is ${version ? version.replace(/\./g, '\\.') : 'of unknown version'}\\.$`));
        host.close();
    }
});

test('an off peer: ready to dormant keeps the state and stops the hooks; back on, nothing is set up twice', async () => {
    const calls = {};
    const host = await createHost({ modules: [director(), social()] });
    await host.sdk.registerModule(mech({ calls }));
    await host.sdk.command('combat.start', {});
    assert.deepEqual(host.head().domains.party.actors, { hero: { hp: 10 } });
    const announced = [];
    host.sdk.on('modules', ({ changes }) => announced.push(...changes.map(change => `${change.id}:${change.status}`)));

    assert.equal(host.registry.setEnabled(PEER, false, 'Switched off for the test.'), true);
    host.sdk.view();   // the next view sees it
    assert.deepEqual(announced.sort(), ['rpg-battle:dormant', 'story-director:dormant']);
    const dormant = modulesById(host);
    assert.equal(dormant[PEER].reason, 'Switched off for the test.');
    assert.match(dormant['rpg-battle'].reason, /^Needs Story Director, which is not ready: Switched off for the test\.$/);
    assert.deepEqual(host.head().domains.party.actors, { hero: { hp: 10 } }, 'state preserved');
    const before = { ...calls };
    const out = await host.send('I go.', 'He leaves.\n\n<Changes>\n~ wound Ann — a cut\n</Changes>');
    assert.notEqual(out.aborted, true);
    assert.deepEqual(calls, before, 'no hook or capture ran while dormant');
    assert.equal(host.head().domains.party.actors.Ann, undefined);
    assert.equal((await host.sdk.command('combat.start', {})).code, 'DEPENDENCY_UNAVAILABLE');

    // Back on: picked up at the next action; the slice is not reset and not set up again.
    host.registry.setEnabled(PEER, true);
    assert.equal((await host.sdk.command('combat.start', {})).ok, true);
    assert.deepEqual(announced.slice(2).sort(), ['rpg-battle:ready', 'story-director:ready']);
    assert.equal(initReceipts(host, 'rpg-battle').length, 1);
    assert.equal(host.registry.setEnabled('story-block', false), false, 'the host\'s own module cannot be switched off');
    assert.equal(host.registry.setEnabled('nobody', false), false);
    host.close();
});

test('a peer that is itself dormant does not count; chains settle', async () => {
    const host = await createHost({ modules: [] });
    await host.sdk.registerModule({ id: 'c-mod', version: '1.0.0', requires: { peers: { 'b-mod': '^1' } }, domains: { cdom: { initial: () => ({}) } } });
    await host.sdk.registerModule({ id: 'b-mod', version: '1.0.0', requires: { peers: { 'a-mod': '^1' } }, domains: { bdom: { initial: () => ({}) } } });
    assert.deepEqual(host.sdk.modules().filter(m => m.id.endsWith('-mod')).map(m => [m.id, m.status]), [['b-mod', 'dormant'], ['c-mod', 'dormant']]);
    assert.match(modulesById(host)['c-mod'].reason, /^Needs b-mod, which is not ready: Needs a-mod \^1, which is not installed\.$/);
    await host.sdk.registerModule({ id: 'a-mod', version: '1.2.0', domains: { adom: { initial: () => ({}) } } });
    assert.deepEqual(host.sdk.modules().filter(m => m.id.endsWith('-mod')).map(m => [m.id, m.status]), [['a-mod', 'ready'], ['b-mod', 'ready'], ['c-mod', 'ready']]);
    assert.deepEqual(['adom', 'bdom', 'cdom'].map(name => Object.hasOwn(host.head().domains, name)), [true, true, true]);
    host.close();
});

test('cyclic peers refuse activation; an unrelated module and the host go on', async () => {
    const host = await createHost({ modules: [social()] });
    await host.sdk.registerModule({ id: 'x-mod', version: '1.0.0', requires: { peers: { 'y-mod': '^1' } }, domains: { xdom: { initial: () => ({}) } }, hooks: { canGenerate: () => false } });
    assert.equal(modulesById(host)['x-mod'].reason, 'Needs y-mod ^1, which is not installed.');
    await host.sdk.registerModule({ id: 'y-mod', version: '1.0.0', requires: { peers: { 'x-mod': '^1' } }, domains: { ydom: { initial: () => ({}) } } });
    const byId = modulesById(host);
    assert.deepEqual([byId['x-mod'].status, byId['y-mod'].status], ['dormant', 'dormant']);
    assert.equal(byId['x-mod'].reason, 'Its peers need each other (x-mod → y-mod → x-mod), so none of them can start.');
    assert.equal(byId['y-mod'].reason, 'Its peers need each other (y-mod → x-mod → y-mod), so none of them can start.');
    assert.equal(byId['npc-state-delta'].status, 'ready');
    assert.equal(Object.hasOwn(host.head().domains, 'xdom'), false);
    assert.equal(Object.hasOwn(host.head().domains, 'ydom'), false);
    // A module that needs one of them waits too; a module on its own self-cycle too.
    await host.sdk.registerModule({ id: 'z-mod', version: '1.0.0', requires: { peers: { 'x-mod': '^1' } } });
    assert.match(modulesById(host)['z-mod'].reason, /^Needs x-mod, which is not ready: Its peers need each other/);
    await host.sdk.registerModule({ id: 'solo', version: '1.0.0', requires: { peers: { solo: '^1' } } });
    assert.match(modulesById(host).solo.reason, /^Its peers need each other \(solo → solo\)/);
    const out = await host.send('Go.', 'Done.');
    assert.notEqual(out.aborted, true, 'a cyclic module\'s canGenerate false never reaches the story');
    host.close();
});
