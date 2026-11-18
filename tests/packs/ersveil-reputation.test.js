// The format 4 Ersveil game pack's Standing, Fame and Guild name one Reputation tab (BLOCKS-UI), and the layouts change nothing the story is told.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { world, pin, success } from '../modules/data-modules/helpers.js';
import { grammarFor, summaryOf } from '../../modules/data-modules/part.js';
import { editableLayout } from '../../modules/data-modules/editable-layout.js';

const ersveil = () => JSON.parse(readFileSync(new URL('../../examples/packs/ersveil-game/pack.json', import.meta.url), 'utf8'));
const MODULES = ['standing', 'fame', 'guild-membership'];
async function pinned(t, only = MODULES, input = ersveil()) {
    const host = await world(t, input);
    for (const slug of only) {
        const offer = host.sdk.query('dataModules.offers').find(row => row.module === `pack.ersveil-game/${slug}`);
        success(await host.sdk.command('dm.pin', { module: offer.module, hash: offer.hash, packHash: offer.packHash }));
    }
    return host;
}

test('the pack names one tab for its three screens, and each pinned module gives its own screen to it', async t => {
    const host = await pinned(t);
    const screens = host.sdk.query('dataModules.presentation', { kind: 'screens' });
    assert.deepEqual(screens.map(screen => screen.tab), ['reputation', 'reputation', 'reputation']);
    assert.deepEqual(screens.map(screen => screen.id).sort(), ['ersveil-fame', 'ersveil-guild-membership', 'ersveil-standing']);
});

test('a module that is not pinned gives no screen to the tab', async t => {
    const host = await pinned(t, ['standing', 'guild-membership']);
    const screens = host.sdk.query('dataModules.presentation', { kind: 'screens' });
    assert.deepEqual(screens.map(screen => screen.id).sort(), ['ersveil-guild-membership', 'ersveil-standing']);
});

test('what the story is told is the same with or without the screens: the static lines and the tail do not move', async t => {
    const plain = ersveil();
    for (const module of plain.content.dataModules) { delete module.screens; }
    const withScreens = await pinned(t), without = await pinned(t, MODULES, plain);
    assert.equal(grammarFor(withScreens.head()), grammarFor(without.head()), 'the static data-module lines');
    for (const slug of MODULES) assert.equal(summaryOf(withScreens.head(), `pack.ersveil-game/${slug}`), summaryOf(without.head(), `pack.ersveil-game/${slug}`), slug);
    assert.ok(grammarFor(withScreens.head()).length > 0);
});

test('a meter with no maximum takes its field\'s own bounds in the editable layout', () => {
    const definition = { id: 'pack.x/f', scope: 'chat', state: { fame: { type: 'map', keys: ['a'], values: { type: 'int', min: 0, max: 100, default: 0 } }, hp: { type: 'int', min: 0, max: 20, default: 5 } } };
    const bind = path => ({ query: 'dataModules.view', args: { module: 'pack.x/f' }, path });
    const layout = { root: { type: 'col', children: [{ type: 'meter', label: 'A', bind: bind('chat.fame.a') }, { type: 'meter', label: 'HP', bind: bind('chat.hp') }] } };
    const edited = editableLayout(layout, definition);
    const meters = edited.root.children.map(row => row.children[0]);
    assert.deepEqual(meters.map(meter => meter.max), [100, 20], 'the field\'s own bounds');
});

// The Guild rank in the player's look follows the guild-membership module (the owner's Ersveil chat, 12 Nov): the narrator wrote
// "~ you rank: Registered" / "~ you rank: F" while the clerk had only asked for the fee and the module still said registered false.
const block = lines => `Story.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
test('a ~ you rank line that contradicts the Guild module is refused with a Problem; the other parts stay', async t => {
    const host = await pinned(t);
    await host.send('Begin.', 'Opening.');
    for (const claim of ['Registered', 'F']) {
        await host.send('Go on.', block([`~ you rank: ${claim} | wearing: a grey coat`]));
        const you = host.sdk.query('scene.you');
        assert.equal(you.wearing, 'a grey coat', `${claim}: the other part is kept`);
        assert.equal(you.rank, '', `${claim}: the contradicting rank is not stored`);
        const told = host.turn.problems().filter(item => item.index === host.ctx.chat.length - 1);
        assert.ok(told.some(item => /The Guild record says you are not registered, so "rank" was not used/.test(item.message)), `${claim}: one plain Problem`);
    }
    await host.send('Say so.', block(['~ you rank: unregistered']));
    assert.equal(host.sdk.query('scene.you').rank, 'unregistered', 'a line that agrees is stored as written');
});

test('once the module says registered, the letter must match it', async t => {
    const host = await pinned(t);
    await host.send('Begin.', 'Opening.');
    success(await host.sdk.command('dm.set', { module: 'pack.ersveil-game/guild-membership', field: 'registered', value: true }));
    await host.send('Pay.', block(['~ you rank: E-rank | wearing: coat']));
    assert.equal(host.sdk.query('scene.you').rank, '', 'a different letter is refused');
    assert.equal(host.sdk.query('scene.you').wearing, 'coat');
    await host.send('Meek.', block(['~ you rank: Aspirant']));
    assert.equal(host.sdk.query('scene.you').rank, 'Aspirant', 'neutral text names no other letter');
    await host.send('Sign.', block(['~ you rank: F-rank, Adventurer Guild']));
    assert.equal(host.sdk.query('scene.you').rank, 'F-rank, Adventurer Guild');
});

test('neutral rank text passes while unregistered; a reply captured before the rule keeps its rank line, also on a Re-read', async t => {
    const host = await pinned(t);
    await host.send('Begin.', 'Opening.');
    await host.send('Look.', block(['~ you rank: Aspirant']));
    assert.equal(host.sdk.query('scene.you').rank, 'Aspirant', 'it claims no registration and no letter');
    const setter = host.store.setRuleMarks;
    host.store.setRuleMarks = () => { throw new Error('old reply'); };
    await host.send('Old.', block(['~ you rank: Registered']));
    host.store.setRuleMarks = setter;
    const old = host.ctx.chat.length - 1;
    assert.equal(host.ctx.chat[old].extra.storySuite.rules, undefined);
    assert.equal(host.sdk.query('scene.you').rank, 'Registered', 'an unmarked reply: stored as before');
    assert.equal((await host.turn.reread(old)).ok, true);
    assert.equal(host.sdk.query('scene.you').rank, 'Registered', 'and the same on a Re-read');
    await host.send('New.', block(['~ you rank: F']));
    assert.ok(host.ctx.chat[host.ctx.chat.length - 1].extra.storySuite.rules.includes('youRank'));
    assert.equal(host.sdk.query('scene.you').rank, 'Registered', 'a marked reply\'s contradicting line is refused');
});
