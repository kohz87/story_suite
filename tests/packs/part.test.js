// The packs part as Story Block's core module merges it (MODULES §A): its shape, its
// queries and hooks as another part reaches them, and the live binding to SillyTavern.
import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createPacksPart, part as livePart, packs as livePacks, resolveItem as liveResolve, startState as liveStart } from '../../packs/index.js';
import { slugify } from '../../packs/validate.js';
import { rippleChoice } from '../../packs/content.js';
import { foldKey } from '../../core/text.js';
import { fakeCtx } from './helpers/fake-ctx.js';
import { fakeSettings } from './helpers/fake-settings.js';
import { installFakeSillyTavern } from './helpers/fake-st.js';
import { itemsPack, pack } from './helpers/fixtures.js';

const read = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const sampleText = read('riverside-starter.json');
const sampleGameText = read('riverside-starter.game.json');
const game = (id, content, extra = {}) => pack({ id, kind: 'game', content, ...extra });

test('the part has the MODULES §A shape and no domain, command or prompt text of its own', () => {
    const { part } = createPacksPart({ settings: fakeSettings() });
    assert.deepEqual(Object.keys(part), ['domains', 'commands', 'queries', 'kinds', 'context', 'hooks', 'settings', 'tabs']);
    assert.deepEqual(part.domains, {});
    assert.deepEqual(part.commands, {});
    assert.deepEqual(part.kinds, {});
    assert.deepEqual(part.tabs, []);
    assert.deepEqual(Object.keys(part.queries), ['packs.list', 'packs.selected', 'packs.content', 'packs.item', 'packs.itemDefs', 'packs.start', 'packs.calendar', 'packs.weather', 'packs.ripples', 'packs.rippleChoice', 'packs.youRank', 'packs.crafts', 'packs.economy', 'packs.markets', 'packs.portrait']);
    assert.deepEqual(Object.keys(part.hooks), ['item.resolve', 'start']);
    assert.equal(part.context.static(), '', 'the static prompt stays byte-identical whatever is installed');
    assert.deepEqual(part.context.tail({}), { lines: [], optional: [] });
    assert.equal(part.context.budget, 0);
    assert.equal(part.settings.section, 'Packs');
    assert.equal(typeof part.settings.render, 'function');
});

test('queries answer from the selected world and game, whatever the state', async () => {
    const settings = fakeSettings();
    const { part, packs } = createPacksPart({ settings });
    await packs.install(sampleText);
    await packs.install(sampleGameText);
    const ctx = fakeCtx({ queries: part.queries });
    assert.deepEqual(ctx.query('packs.list').map(entry => entry.id), ['riverside-starter', 'riverside-starter-game']);
    assert.deepEqual(ctx.query('packs.selected'), { world: 'riverside-starter', game: 'riverside-starter-game' });
    assert.equal(ctx.query('packs.content', { kind: 'items' }).length, 4);
    assert.deepEqual(ctx.query('packs.content', { kind: 'items', pack: 'nobody' }), []);
    assert.deepEqual(ctx.query('packs.content'), [], 'no kind, nothing');
    assert.equal(ctx.query('packs.item', { name: 'trout' }).id, 'pack.riverside-starter/moonveil-trout');
    assert.equal(ctx.query('packs.item'), null);
    assert.equal(ctx.query('packs.start').scene.place.name, 'Bluewatch Village');
    assert.equal(part.hooks['item.resolve']('Willow Rod').id, 'pack.riverside-starter/willow-rod');
    assert.equal(part.hooks.start().inventory.money, 50, 'the game\'s start');
    await packs.setEnabled('riverside-starter', false);
    assert.deepEqual(ctx.query('packs.content', { kind: 'items' }), []);
    assert.equal(part.hooks['item.resolve']('Willow Rod'), null);
    assert.equal(ctx.query('packs.start').scene.place, null);
    assert.equal(part.hooks.start().inventory.money, 50, 'the game is still selected');
    assert.equal(ctx.query('packs.list')[0].enabled, false, 'still listed');
});

// How inventory capture is expected to use the hook (SB-domains wires the real one):
// its own aliases first, then packs, then a new story def.
function captureItem(state, name, ctx) {
    const inventory = state.domains.inventory;
    const known = inventory.aliases[foldKey(name)];
    if (known) return inventory.defs[known];
    const def = ctx.query('packs.item', { name }) ?? { id: `story/${slugify(name)}`, name, kind: 'goods', rarity: 'common', value: 0 };
    inventory.defs[def.id] ??= def;
    inventory.aliases[foldKey(name)] = def.id;
    return def;
}

test('item resolution order seen from inventory capture: inventory, the selected world, story', async () => {
    const { part, packs } = createPacksPart({ settings: fakeSettings() });
    await packs.install(itemsPack('alpha', [{ name: 'Rope', value: 3 }, { name: 'Lantern', value: 40 }]));
    await packs.install(itemsPack('beta', [{ name: 'Rope', value: 9 }, { name: 'Tar', value: 1 }]));
    const state = { v: 2, meta: { rev: 0, claims: {} }, domains: { inventory: { defs: { 'story/lantern': { id: 'story/lantern', name: 'Lantern', value: 0 } }, stacks: {}, wallets: {}, aliases: { lantern: 'story/lantern' } } } };
    const ctx = fakeCtx({ state, queries: part.queries });
    assert.equal(captureItem(state, 'Lantern', ctx).id, 'story/lantern', 'a def the chat already has wins over a pack');
    assert.equal(captureItem(state, 'Rope', ctx).id, 'pack.alpha/rope', 'then the selected world (the first installed)');
    assert.equal(captureItem(state, 'Tar', ctx).id, 'story/tar', 'a world that is not selected is not read');
    assert.equal(captureItem(state, 'Moonveil Trout', ctx).id, 'story/moonveil-trout', 'then a story def');
    await packs.setEnabled('alpha', false);
    assert.equal(captureItem(state, 'Rope', ctx).id, 'pack.alpha/rope', 'once captured, the chat keeps its copy');
    assert.equal(state.domains.inventory.defs['pack.alpha/rope'].value, 3);
    await packs.setEnabled('beta', true);
    assert.equal(ctx.query('packs.item', { name: 'Tar' }).id, 'pack.beta/tar', 'the newly selected world answers');
});

test('the settings panel renderer binds to the part\'s own list', async () => {
    const { installFakeDom } = await import('../helpers/ui-fake-dom.js');
    const doc = installFakeDom();
    const { part, packs } = createPacksPart({ settings: fakeSettings() });
    await packs.install(pack({ id: 'shown', name: 'Shown Pack' }));
    const root = doc.createElement('div');
    const notes = [];
    part.settings.render(root, { notify: text => notes.push(text) });
    assert.equal(root.querySelector('.ss-packs-row').dataset.packId, 'shown');
    part.settings.render(doc.createElement('div'), undefined);
});

test('the live part reads and saves extension_settings.storySuite.packs through SillyTavern', async () => {
    assert.ok(livePart.queries['packs.list']);
    const st = installFakeSillyTavern();
    try {
        assert.deepEqual(livePacks.list(), []);
        assert.deepEqual(st.ctx.extensionSettings.storySuite, { packs: [] });
        const result = await livePacks.install(sampleText, { origin: 'riverside.json' });
        assert.equal(result.ok, true);
        assert.equal((await livePacks.install(sampleGameText)).ok, true);
        assert.equal(st.calls.saves, 2, 'saved with saveSettingsDebounced after each install');
        assert.equal(st.ctx.extensionSettings.storySuite.packs[0].id, 'riverside-starter');
        assert.equal(liveResolve('Hemp Line').id, 'pack.riverside-starter/hemp-line');
        assert.equal(liveStart().inventory.items.length, 3, 'the game pack\'s start');
        st.ctx.extensionSettings.storySuite = 'broken';
        assert.deepEqual(livePacks.list(), [], 'a broken settings value starts over');
    } finally {
        st.uninstall();
    }
    assert.deepEqual(livePacks.list(), [], 'without SillyTavern the list is in memory only');
});

test('the live part checks capabilities against the running sdk', async () => {
    const st = installFakeSillyTavern();
    globalThis.StoryBlock = { sdk: { version: '2.0.0-alpha.2', modules: () => [{ id: 'story-block', domains: { scene: {}, inventory: {} } }, { id: 'rpg-battle', domains: { party: {} }, capabilities: ['combat'] }] } };
    try {
        const needs = list => pack({ id: 'needs', requires: { suite: '^0.1', capabilities: list } });
        assert.equal((await livePacks.install(needs(['party', 'combat', 'rpg-battle', 'inventory']))).ok, true);
        assert.equal((await livePacks.install(needs(['director']))).errors[0].code, 'MISSING_CAPABILITY');
    } finally {
        delete globalThis.StoryBlock;
        st.uninstall();
    }
});

test('packs.ripples always answers null: no pack holds a ripples table any more', async () => {
    const { part, packs } = createPacksPart({ settings: fakeSettings() });
    const ctx = fakeCtx({ queries: part.queries });
    assert.equal(ctx.query('packs.ripples'), null, 'no pack');
    await packs.install(sampleText);
    assert.equal(ctx.query('packs.ripples'), null, 'a world installed');
    assert.equal(ctx.query('packs.ripples', { pack: 'riverside-starter' }), null, 'asked for by name');
    const refused = await packs.install(pack({ id: 'rivals', ripples: { powers: [{ id: 'red', name: 'Red Queen', base: 60 }] } }));
    assert.equal(refused.ok, false, 'a pack cannot bring one');
    assert.equal(refused.errors[0].code, 'UNKNOWN_FIELD');
    assert.equal(ctx.query('packs.ripples'), null);
});

test('packs.rippleChoice gives the authored fallback for a well-formed ask and null for a malformed one', () => {
    const args = { pack: 'ersveil', ids: 'wendhild,corvin,hasse', pick: 'bottom', fallback: 'hasse' };
    const answer = ask => rippleChoice([], ask, { hasQuery: () => true, query: () => { throw new Error('no table is read'); } });
    assert.equal(answer(args), 'hasse');
    assert.equal(answer({ ...args, pick: 'top', fallback: 'corvin' }), 'corvin');
    assert.equal(answer({ ...args, fallback: undefined }), null, 'nothing authored, nothing to give');
    for (const bad of [{ ...args, pack: '' }, { ...args, pack: undefined }, { ...args, ids: undefined }, { ...args, ids: 'a,a' }, { ...args, ids: ['a'] }, { ...args, pick: 'middle' }, undefined]) {
        assert.equal(answer(bad), null, JSON.stringify(bad));
    }
});

test('a real host with no registered Ripples query uses the authored fallback', async t => {
    const { createHost } = await import('../../testkit/index.js');
    const host = await createHost();
    t.after(() => host.close());
    assert.equal((await host.packs.packs.install(pack({ id: 'ersveil' }))).ok, true);
    assert.equal(host.sdk.query('packs.rippleChoice', { pack: 'ersveil', ids: 'wendhild,corvin,hasse', pick: 'bottom', fallback: 'hasse' }), 'hasse');
    assert.equal(host.sdk.query('packs.rippleChoice', { pack: 'ersveil', ids: 'a,a', pick: 'bottom', fallback: 'hasse' }), null, 'a malformed ask');
    assert.equal(host.sdk.query('packs.ripples'), null);
});

test('a name-only pack is counted by culture, with warnings visible but enabled', async () => {
    const { packs } = createPacksPart({ settings: fakeSettings() });
    const names = { banned: ['Elara'], river: { regions: ['River'], given: ['Wenna'] } };
    assert.equal((await packs.install(game('names-only', { names }))).ok, true);
    const { addsLine } = await import('../../packs/panel.js');
    assert.equal(addsLine(packs.list()[0]), '1 name list');
    const bad = await packs.install(game('warn', { names: { ...names, hill: 'x' }, currency: { name: 'mark', coins: [{ name: 'mark', value: 1 }] } }));
    assert.equal(bad.ok, true);
    await packs.setEnabled('warn', true);
    assert.ok(packs.list().find(item => item.id === 'warn').warnings.length);
    assert.ok(packs.packs().find(item => item.id === 'warn').currency, 'the rest of the pack is read');
});

test('packs.content { kind: "names" } answers the selected game\'s name object (frozen); a game without names adds nothing', async () => {
    const { part, packs } = createPacksPart({ settings: fakeSettings() });
    const ctx = fakeCtx({ queries: part.queries });
    assert.deepEqual(ctx.query('packs.content', { kind: 'names' }), []);
    await packs.install(sampleGameText);
    assert.deepEqual(ctx.query('packs.content', { kind: 'names' }), [], 'a game without the section');
    const names = { banned: ['Elara'], river: { regions: ['River Confederacy'], given: ['Wenna'], family: ['Lockwright'] } };
    const added = await packs.install(JSON.stringify(game('rivers', { names })));
    assert.equal(added.ok, true, JSON.stringify(added.errors));
    assert.deepEqual(ctx.query('packs.content', { kind: 'names' }), [], 'not selected yet');
    await packs.setEnabled('rivers', true);
    const answer = ctx.query('packs.content', { kind: 'names' });
    assert.deepEqual(answer, [names]);
    assert.throws(() => answer[0].river.given.pop(), TypeError);
    assert.deepEqual(ctx.query('packs.content', { kind: 'names' }), [names], 'the caller cannot change the pack');
    const bad = await packs.install(JSON.stringify(game('bad-names', { names: { river: 'x' } })));
    assert.equal(bad.ok, true, 'other content installs');
    assert.equal(bad.warnings[0].path, 'content.names.river');
    assert.equal(packs.list().find(item => item.id === 'bad-names').warnings[0].path, 'content.names.river');
    await packs.setEnabled('rivers', false);
    assert.deepEqual(ctx.query('packs.content', { kind: 'names' }), []);
});
