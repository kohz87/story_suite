// The installed list in extension_settings.storySuite.packs: install, update, on/off,
// remove, and nothing saved when a pack is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInstalled } from '../../packs/installed.js';
import { resolveItemIn, contentOf } from '../../packs/content.js';
import { fakeSettings } from './helpers/fake-settings.js';
import { itemsPack, pack } from './helpers/fixtures.js';

const sampleText = readFileSync(new URL('./fixtures/riverside-starter.json', import.meta.url), 'utf8');
const sample = () => JSON.parse(sampleText);

const setup = (options = {}, initial = {}) => {
    const settings = fakeSettings(initial);
    return { settings, installed: createInstalled({ settings, ...options }) };
};

test('installing keeps the pack as given, under its id, switched on', async () => {
    const { settings, installed } = setup();
    const result = await installed.install(sampleText, { source: 'file', origin: 'riverside.json' });
    assert.deepEqual({ ...result, warnings: result.warnings.map(item => item.code) }, { ok: true, id: 'riverside-starter', name: 'Riverside Starter', action: 'installed', warnings: ['REGIONS_UNDECLARED'] });
    assert.equal(settings.saves, 1);
    const [stored] = settings.root.packs;
    assert.deepEqual({ ...stored, pack: undefined }, { id: 'riverside-starter', version: '4.0.0', kind: 'world', enabled: true, source: 'file', origin: 'riverside.json', pack: undefined });
    assert.deepEqual(stored.pack, sample(), 'the raw pack, not the normalized form');
    assert.deepEqual(JSON.parse(JSON.stringify(installed.list())).map(row => ({ ...row, warnings: row.warnings.map(item => item.code) })), [{
        id: 'riverside-starter', version: '4.0.0', name: 'Riverside Starter', author: 'Story Suite examples',
        description: sample().description, enabled: true, source: 'file', origin: 'riverside.json',
        counts: { items: 4, events: 0, places: 1, foes: 1 }, hasStart: true, extras: [], missing: [], problem: '',
        tag: 'World pack', warnings: ['REGIONS_UNDECLARED'], kind: 'world', addOn: false, has: { rank: false, rpg: false, months: 0, realMonths: false, modules: [] },
    }]);
    assert.equal(installed.packs()[0].content.items.length, 4);
});

test('a refused pack saves nothing and leaves the list as it was', async () => {
    const { settings, installed } = setup();
    await installed.install(pack({ id: 'first' }));
    const before = structuredClone(settings.root);
    for (const bad of ['{ nope', pack({ id: 'Bad Id' }), pack({ id: 'first', version: 'x' }), pack({ id: 'evil', name: '<script>' }), pack({ requires: { storyBlock: '^2' } })]) {
        const result = await installed.install(bad);
        assert.equal(result.ok, false);
        assert.ok(result.errors.length);
    }
    assert.deepEqual(settings.root, before);
    assert.equal(settings.saves, 1);
});

test('the same id updates in place, keeps its selection; the same pack again changes nothing', async () => {
    const { settings, installed } = setup();
    await installed.install(pack({ id: 'a' }));
    await installed.install(pack({ id: 'b', name: 'B one' }));
    await installed.install(pack({ id: 'c' }));
    assert.deepEqual(installed.list().map(entry => entry.enabled), [true, false, false], 'the first world installed is the selected one');
    await installed.setEnabled('b', true);
    const saves = settings.saves;
    assert.equal((await installed.install(pack({ id: 'b', name: 'B one' }))).action, 'unchanged');
    assert.equal(settings.saves, saves);
    const updated = await installed.install(pack({ id: 'b', version: '1.1.0', name: 'B two' }), { source: 'lorebook', origin: 'lorebook:x#1' });
    assert.equal(updated.action, 'updated');
    assert.deepEqual(installed.list().map(entry => [entry.id, entry.version, entry.name, entry.enabled, entry.source]), [
        ['a', '1.0.0', 'a', false, 'file'], ['b', '1.1.0', 'B two', true, 'lorebook'], ['c', '1.0.0', 'c', false, 'file'],
    ]);
});

test('only the selected world\'s content and items are in the lookups; selecting another, or none, changes them', async () => {
    const { installed } = setup();
    await installed.install(itemsPack('alpha', [{ name: 'Rope', value: 3 }]));
    await installed.install(itemsPack('beta', [{ name: 'Rope', value: 9 }, { name: 'Tar' }]));
    const lookup = name => resolveItemIn(installed.packs(), name)?.id ?? null;
    assert.equal(lookup('rope'), 'pack.alpha/rope', 'the first world installed is the selected one');
    assert.equal(contentOf(installed.packs(), 'items').length, 1, 'the other world adds nothing');
    assert.equal(await installed.setEnabled('beta', true), true);
    assert.equal(lookup('rope'), 'pack.beta/rope', 'the chosen world now answers');
    assert.deepEqual(contentOf(installed.packs(), 'items').map(item => item.id), ['pack.beta/rope', 'pack.beta/tar']);
    assert.equal(lookup('pack.alpha/rope'), null, 'a full ID of a world that is not selected is not found');
    await installed.setEnabled('beta', false);
    assert.equal(lookup('rope'), null);
    assert.deepEqual(contentOf(installed.packs(), 'items'), []);
    await installed.setEnabled('alpha', true);
    assert.equal(lookup('rope'), 'pack.alpha/rope');
    assert.equal(await installed.setEnabled('nobody', true), false);
});

test('removing a pack', async () => {
    const { settings, installed } = setup();
    await installed.install(pack({ id: 'a' }));
    await installed.install(pack({ id: 'b' }));
    assert.equal(await installed.remove('a'), true);
    assert.deepEqual(installed.list().map(entry => entry.id), ['b']);
    assert.equal(await installed.remove('a'), false);
    assert.equal(settings.saves, 3);
});

test('a stored pack is checked again on read; one that fails is listed with its problem', () => {
    const tampered = pack({ id: 'tampered', content: { items: [{ name: 'Rope', note: '<script>x</script>' }] } });
    const { installed } = setup({}, { packs: [
        { id: 'tampered', version: '1.0.0', enabled: true, source: 'file', origin: '', pack: tampered },
        { id: 'empty', version: '1.0.0', enabled: true },
        'junk',
        { id: 'fine', version: '1.0.0', source: 'odd', kind: 'world', pack: pack({ id: 'fine', content: { items: [{ name: 'Tar' }] } }) },
    ], selected: { world: 'fine' } });
    const list = installed.list();
    assert.deepEqual(list.map(entry => entry.id), ['tampered', 'empty', 'fine']);
    assert.match(list[0].problem, /HTML tag/);
    assert.match(list[1].problem, /missing/);
    assert.equal(list[2].problem, '');
    assert.equal(list[2].source, 'file');
    assert.deepEqual(installed.packs().map(entry => entry.id), ['fine']);
});

test('a missing settings list is created; non-list values are replaced', () => {
    const { settings, installed } = setup({}, { packs: 'oops', modules: { x: 1 } });
    assert.deepEqual(installed.list(), []);
    assert.deepEqual(settings.root, { packs: [], modules: { x: 1 } });
    assert.throws(() => createInstalled({}), /settings/);
});

test('limits on how many packs and how much data are installed', async () => {
    const { installed } = setup({ limits: { ...(await import('../../packs/limits.js')).LIMITS, installed: 2, installedBytes: 400 } });
    assert.equal((await installed.install(pack({ id: 'a' }))).ok, true);
    assert.equal((await installed.install(pack({ id: 'b' }))).ok, true);
    const third = await installed.install(pack({ id: 'c' }));
    assert.equal(third.errors[0].code, 'TOO_MANY');
    assert.equal((await installed.install(pack({ id: 'b', version: '1.0.1' }))).action, 'updated', 'an update is not one more');
    const big = await installed.install(pack({ id: 'b', version: '1.0.2', description: 'd'.repeat(300) }));
    assert.equal(big.errors[0].code, 'TOO_LARGE');
});

test('capabilities: refused at install when known missing, reported live afterwards', async () => {
    let have = ['inventory', 'scene'];
    const { installed } = setup({ capabilities: () => have });
    const needsParty = pack({ id: 'battle', requires: { suite: '^0.1', capabilities: ['party'] } });
    assert.equal((await installed.install(needsParty)).errors[0].code, 'MISSING_CAPABILITY');
    have = ['inventory', 'scene', 'party'];
    assert.equal((await installed.install(needsParty)).ok, true);
    have = ['inventory'];
    assert.deepEqual(installed.list()[0].missing, ['party'], 'RPG Battle switched off later');
    assert.equal(installed.packs().length, 1, 'its content is still offered');
});

test('a pack that needs a newer suite than this one is refused at install', async () => {
    const { settings, installed } = setup();
    const result = await installed.install(pack({ requires: { suite: '^9' } }));
    assert.equal(result.errors[0].code, 'HOST_VERSION');
    assert.equal(settings.saves, 0);
});

test('listeners hear every change', async () => {
    const { installed } = setup();
    let heard = 0;
    const stop = installed.subscribe(() => { heard += 1; });
    await installed.install(pack());
    await installed.setEnabled('mini', false);
    await installed.setEnabled('mini', false);
    await installed.remove('mini');
    stop();
    await installed.install(pack());
    assert.equal(heard, 3, 'a switch to the same value is no change');
});

test('packs.content hands out the pack\'s own frozen records: same objects each call, nothing a caller can change, same JSON as a copy', async () => {
    const { settings, installed } = setup();
    await installed.install(sampleText, { source: 'file', origin: 'riverside.json' });
    const first = contentOf(installed.packs(), 'items');
    const again = contentOf(installed.packs(), 'items');
    assert.ok(first.length > 0);
    assert.ok(first.every((item, at) => item === again[at]), 'no copy per call');
    assert.ok(Object.isFrozen(first) && first.every(item => Object.isFrozen(item) && Object.isFrozen(item.tags)), 'frozen all the way down');
    assert.throws(() => { first[0].name = 'changed'; }, TypeError);
    assert.throws(() => first.push({}), TypeError);
    for (const kind of ['items', 'foes', 'places', 'cast', 'currency', 'nothing']) {
        const got = contentOf(installed.packs(), kind);
        assert.equal(JSON.stringify(got), JSON.stringify(JSON.parse(JSON.stringify(got))), kind);
    }
    assert.deepEqual(installed.list()[0].counts.items, first.length);
    assert.deepEqual(settings.root.packs[0].pack, sample(), 'the stored raw pack is untouched, and not frozen');
    assert.equal(Object.isFrozen(settings.root.packs[0].pack), false);
});

test('an installed format 4 pack keeps its kind in the store and is read through the selection, not the on/off switch', async () => {
    const { settings, installed } = setup();
    const world = { id: 'w', format: 4, kind: 'world', version: '1.0.0', requires: { suite: '^0.1' }, content: {} };
    assert.equal((await installed.install(world)).ok, true);
    assert.equal(settings.root.packs[0].kind, 'world');
    assert.deepEqual(installed.packs().map(each => each.id), ['w']);
    await installed.select('world', null);
    assert.deepEqual(installed.packs(), []);
});
