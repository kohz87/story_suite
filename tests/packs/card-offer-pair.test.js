// The card offer for format 4 (pack-format-4 §4.3, job P6): a card may hold one world pack and one game pack; one notice, one click installs
// both and selects both. The controller gives the view the offers (`notices()`); a click is `offer.install(id)` or `offer.notNow(id)`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cardPack, cardWorld, packEntry, settle } from './helpers/card.js';

const worldPack = (id = 'ersveil', version = '1.0.0') => ({ id, format: 4, kind: 'world', version, name: 'Ersveil', requires: { suite: '^0.1' }, content: { lore: [{ id: 'a', title: 'A', keys: ['a'], text: 'Text.' }] } });
const gamePack = (id = 'ersveil-rules', version = '1.0.0') => ({ id, format: 4, kind: 'game', version, name: 'Ersveil rules', requires: { suite: '^0.1' }, content: { currency: { name: 'mark', coins: [{ name: 'mark', value: 1 }] } } });
const entry = (pack, uid) => ({ ...packEntry(pack, `${pack.name} [storysuite:pack]`), uid });
const problems = world => world.runtime.turn.problems().filter(item => /^CARD_/.test(item.code));
const selected = world => world.runtime.packs.packs.selected();

test('a card with a world and a game: one notice for both, nothing installed or selected before the click', async t => {
    const world = await cardWorld(t, { entries: [entry(gamePack(), 2), entry(worldPack(), 1)] });
    assert.equal(world.notices().length, 1);
    const [notice] = world.notices();
    assert.deepEqual([notice.name, notice.version, notice.brings, notice.update], ['Ersveil and Ersveil rules', '1.0.0 + 1.0.0', 'money', false]);
    assert.equal(notice.packId, 'ersveil+ersveil-rules');
    assert.equal(world.runtime.packs.packs.list().length, 0);
    assert.deepEqual(selected(world), { world: null, game: null });
});

test('Install installs both and selects both, over a choice the player made before; the notice says so', async t => {
    const other = { ...worldPack('other'), name: 'Other' };
    const world = await cardWorld(t, { installed: [other], entries: [entry(worldPack(), 1), entry(gamePack(), 2)] });
    assert.equal(selected(world).world, 'other', 'the first world installed was selected');
    await world.offer.install(world.notices()[0].id);
    await settle();
    assert.deepEqual(world.runtime.packs.packs.list().map(item => item.id).sort(), ['ersveil', 'ersveil-rules', 'other']);
    assert.deepEqual(selected(world), { world: 'ersveil', game: 'ersveil-rules' });
    assert.deepEqual(world.st.ctx.extensionSettings.storySuite.selected, { world: 'ersveil', game: 'ersveil-rules' }, 'in the settings: a reload reads the same choice');
    assert.equal(world.notices()[0].result, 'Installed Ersveil 1.0.0. Installed Ersveil rules 1.0.0. Ersveil is the world and Ersveil rules is the game now.');
});

test('a second world, or a second game, on the card is refused with one Diagnostics line; the first of each is still offered', async t => {
    const world = await cardWorld(t, { entries: [entry(worldPack(), 1), entry(worldPack('second'), 3), entry(gamePack(), 2)] });
    assert.equal(world.notices().length, 1);
    assert.equal(problems(world).length, 1);
    assert.match(problems(world)[0].message, /one world pack and one game pack/);
    await world.offer.install(world.notices()[0].id);
    await settle();
    assert.deepEqual(world.runtime.packs.packs.list().map(item => item.id).sort(), ['ersveil', 'ersveil-rules']);
});

test('a world alone is selected by its Install; an add-on game pack (trackers only) is installed but never selected', async t => {
    const alone = await cardWorld(t, { entries: [entry(worldPack(), 1)] });
    await alone.offer.install(alone.notices()[0].id);
    await settle();
    assert.deepEqual(selected(alone), { world: 'ersveil', game: null });
    const addOn = await cardWorld(t, { entries: [entry({ ...gamePack('trackers'), requires: { suite: '^0.1', capabilities: ['data-modules-v1'] }, content: cardPack({ id: 'trackers' }).content }, 1)] });
    assert.equal(addOn.notices().length, 1);
    await addOn.offer.install(addOn.notices()[0].id);
    await settle();
    assert.deepEqual(selected(addOn), { world: null, game: null });
    assert.doesNotMatch(addOn.notices()[0].result, /now\./);
});

test('both installed at the card\'s versions: no offer; a newer game alone brings the offer for both, and selects the world again', async t => {
    const same = await cardWorld(t, { installed: [worldPack(), gamePack()], entries: [entry(worldPack(), 1), entry(gamePack(), 2)] });
    assert.equal(same.notices().length, 0);
    const newer = await cardWorld(t, { installed: [worldPack(), gamePack(), { ...worldPack('mine'), name: 'Mine' }], entries: [entry(worldPack(), 1), entry(gamePack('ersveil-rules', '1.1.0'), 2)] });
    await newer.runtime.packs.packs.select('world', 'mine');
    assert.equal(newer.notices().length, 1);
    assert.equal(newer.notices()[0].update, true, 'an update: both are installed');
    await newer.offer.install(newer.notices()[0].id);
    await settle();
    assert.deepEqual(selected(newer), { world: 'ersveil', game: 'ersveil-rules' });
    assert.match(newer.notices()[0].result, /^Already installed: Ersveil 1\.0\.0\. Updated Ersveil rules 1\.1\.0\./);
});

test('"Not now" on a pair is remembered for that pair of versions', async t => {
    const memory = {};
    const entries = [entry(worldPack(), 1), entry(gamePack(), 2)];
    const world = await cardWorld(t, { entries, settings: memory });
    world.offer.notNow(world.notices()[0].id);
    assert.equal(world.notices().length, 0);
    await world.offer.refresh();
    await settle();
    assert.equal(world.notices().length, 0, 'not offered again');
    assert.equal(world.runtime.packs.packs.list().length, 0);
});
