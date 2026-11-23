// While Text RPG (a feature that replaces the RPG) is on and the RPG is off, the RPG's role blocks (character, skills, foes, rules) teach nothing and their lines are refused quietly;
// their stored values stay, and with the RPG on, or with neither on, nothing changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { BUILTIN_MODULES } from '../../../core/modules-list.js';
import { textRpgModule } from '../../../examples/text-rpg/src/module.js';
import { COMBAT_V1_TEMPLATES } from '../../../modules/rpg/templates-combat.js';
import { definition as filler, pack, reply } from './helpers.js';

async function world(t) {
    t.mock.method(console, 'warn', () => {});
    let host = null;
    host = await createHost({ core: true, modules: [...BUILTIN_MODULES, textRpgModule({ feature: id => host.sdk.feature(id) })] });
    t.after(() => host.close());
    const defs = COMBAT_V1_TEMPLATES.map(({ name, definition }, n) => { const copy = structuredClone(definition); delete copy.id; delete copy.pack; return Object.assign(copy, { slug: `t${n}-${definition.role}`, name }); });
    assert.equal((await host.packs.packs.install(pack([...defs, filler()]))).ok, true);
    for (const offer of host.sdk.query('dataModules.offers')) { const pinned = await host.sdk.command('dm.pin', { module: offer.module, hash: offer.hash, packHash: offer.packHash, subjects: [] }); assert.equal(pinned.ok, true, pinned.message); }
    return host;
}
const sentOf = (host, key) => host.st.promptLog.filter(entry => entry.key === key && entry.value).at(-1)?.value ?? '';
const health = host => JSON.stringify(host.head().domains.dataModules.instances['pack.dm-test/t0-character']);

test('Text RPG on, RPG off: no role block teaches a line or sits in the tail; a block with no role still does', async t => {
    const host = await world(t);
    host.features.set('text-rpg.on', true);
    await host.send('Hello.', 'Quiet.');
    const taught = sentOf(host, 'story_suite_static'), tail = sentOf(host, 'story_suite_tail_1');
    assert.doesNotMatch(taught, /dm t[0-3]-|COMBAT SYSTEM|set-slot-N|One character: seven stats/);
    assert.match(taught, /dm counter /, 'the block with no role is still taught');
    assert.doesNotMatch(tail, /^Character —|hp \d/m);
    assert.match(taught, /^\? try Who/m, 'Text RPG\'s own lines are taught');
});

test('Text RPG on: a role block\'s line is refused quietly and changes nothing; the values stay and the RPG\'s blocks work again with it off', async t => {
    const host = await world(t);
    host.features.set('text-rpg.on', true);
    const before = health(host);
    await host.send('A blow.', reply('~ dm t0-character — hit | kind: set-health | to: Hurt'));
    assert.equal(health(host), before);
    const refused = host.turn.problems().filter(problem => problem.code === 'FEATURE_OFF');
    assert.equal(refused.length, 1);
    assert.equal(refused[0].quiet, true);
    host.features.set('text-rpg.on', false);
    await host.send('Another.', reply('~ dm t0-character — hit | kind: set-health | to: Hurt'));
    assert.equal(host.turn.problems().filter(problem => problem.code === 'FEATURE_OFF').length, 1, 'with neither on the same line is not refused for its feature (only the first reply\'s refusal stands)');
    assert.match(sentOf(host, 'story_suite_static'), /dm t0-character .*set-health/);
});

test('RPG on, or neither on: the role blocks teach as they did; replay equals live with Text RPG on', async t => {
    const host = await world(t);
    for (const on of ['story-block.rpg', null]) {
        if (on) host.features.set(on, true);
        await host.send('Hello.', 'Quiet.');
        assert.match(sentOf(host, 'story_suite_static'), /dm t2-foes .*set-slot-N/);
        assert.match(sentOf(host, 'story_suite_tail_1'), /Character —|hp \d/);
        host.features.set('story-block.rpg', false);
    }
    host.features.set('text-rpg.on', true);
    await host.send('A blow.', reply('~ dm t0-character — hit | kind: set-health | to: Hurt'));
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live);
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.equal(JSON.stringify(host.head()), live);
});
