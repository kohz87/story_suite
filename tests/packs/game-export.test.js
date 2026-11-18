// Export settings as a game pack (job S2): export -> validate -> re-import is lossless; the registry's sections.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCardSettings } from '../../packs/card-settings.js';
import { buildGamePack, applyGamePack } from '../../packs/game-export.js';
import { validatePack } from '../../packs/validate.js';
import { moneySections } from '../../modules/scene/domains/core/game-sections.js';
import { rpgSections } from '../../modules/rpg/game-sections.js';

/** A registry whose one owner keeps its settings in a plain object, like Story Block's own bucket. */
function rig(stored = {}) {
    const bucket = { ...stored };
    const io = { read: key => bucket[key], write: (key, value) => { bucket[key] = value; } };
    const registry = createCardSettings();
    registry.registerOwn({ owner: 'story-block', label: 'Story Block', read: () => undefined, apply: async () => ({ applied: [] }), keys: { rpg: { label: 'RPG', valueText: String, valid: () => true } },
        sections: { ...moneySections(io), ...rpgSections(io) } });
    return { bucket, registry };
}
const own = { currency: 'mark', currencyPlural: 'marks', currencyShort: 'm', economyScale: '100', rpgLevelCap: 20,
    coins: [{ name: 'ore/oren', value: 1 }, { name: 'silver', value: 10 }] };

test('export gives a valid game pack holding what the reader changed', () => {
    const made = buildGamePack(rig(own).registry, { name: 'Marks and pennies' });
    assert.equal(made.ok, true, made.message);
    assert.equal(made.pack.kind, 'game');
    assert.equal(made.pack.id, 'marks-and-pennies');
    assert.deepEqual(made.sections.map(item => item.section).sort(), ['currency', 'economy', 'rpg']);
    assert.deepEqual(made.pack.content.rpg, { formula: 'v1', levelCap: 20 });
    assert.deepEqual(made.pack.content.economy, { scale: 100 });
    assert.equal(made.pack.content.currency.name, 'mark');
    assert.deepEqual(made.pack.content.currency.coins.map(coin => [coin.name, coin.plural, coin.value]), [['ore', 'oren', 1], ['silver', 'silver', 10]]);
    assert.equal(validatePack(made.text).ok, true);
});

test('export, validate, re-import into fresh settings, export again: the same pack', async () => {
    const first = buildGamePack(rig(own).registry, { name: 'Same' });
    const fresh = rig();
    const back = await applyGamePack(fresh.registry, first.text);
    assert.deepEqual(back, { ok: true, applied: ['currency', 'economy', 'rpg'], skipped: [], failed: [] });
    assert.equal(fresh.bucket.rpgLevelCap, 20);
    assert.equal(fresh.bucket.economyScale, '100');
    assert.deepEqual(fresh.bucket.coins.map(coin => coin.name), ['ore/oren', 'silver']);
    const second = buildGamePack(fresh.registry, { name: 'Same' });
    assert.equal(second.text, first.text);
});

test('settings left alone export nothing; a section the pack lacks is not touched on import', async () => {
    assert.equal(buildGamePack(rig({ currency: 'gold', economyScale: '0', rpgLevelCap: 99 }).registry).ok, false);
    const target = rig({ currency: 'crown', rpgLevelCap: 50 });
    const pack = { id: 'tiny', format: 4, kind: 'game', version: '1.0.0', requires: { suite: '^0.1' }, content: { economy: { scale: 2 } } };
    assert.equal((await applyGamePack(target.registry, pack)).ok, true);
    assert.deepEqual([target.bucket.currency, target.bucket.rpgLevelCap, target.bucket.economyScale], ['crown', 50, '2']);
});

test('import refuses a world pack, an invalid pack and a section nobody holds', async () => {
    const target = rig();
    const world = { id: 'w', format: 4, kind: 'world', version: '1.0.0', requires: { suite: '^0.1' }, content: {} };
    assert.equal((await applyGamePack(target.registry, world)).ok, false);
    assert.equal((await applyGamePack(target.registry, '{not json')).ok, false);
    const game = { id: 'g', format: 4, kind: 'game', version: '1.0.0', requires: { suite: '^0.1' }, content: { pacing: { tempo: 2 }, economy: { scale: 3 } } };
    const done = await applyGamePack(target.registry, game);
    assert.deepEqual([done.ok, done.applied, done.skipped], [true, ['economy'], ['pacing']]);
    assert.deepEqual(Object.keys(target.bucket), ['economyScale']);
});

test('a hostile section value never becomes a pack: the export reports why', () => {
    const registry = createCardSettings();
    registry.register({ owner: 'odd', label: 'Odd', sections: { economy: { read: () => ({ scale: 99999 }), apply: async () => true } } });
    const made = buildGamePack(registry);
    assert.equal(made.ok, false);
    assert.match(made.message, /economy/);
});

test('registry: sections need read and apply; one owner per section; a failing apply is reported', async () => {
    const registry = createCardSettings();
    assert.throws(() => registry.register({ owner: 'a', label: 'A', sections: { economy: { read: () => 1 } } }), /read\(\) and apply/);
    registry.register({ owner: 'a', label: 'A', sections: { economy: { read: () => ({ scale: 2 }), apply: async () => { throw new Error('no'); } } } });
    assert.throws(() => registry.register({ owner: 'b', label: 'B', sections: { economy: { read: () => 1, apply: async () => true } } }), /already belongs to A/);
    assert.throws(() => registry.register({ owner: 'c', label: 'C', read: () => 1, apply: async () => ({}), keys: {} }), /keys/);
    const done = await applyGamePack(registry, { id: 'g', format: 4, kind: 'game', version: '1.0.0', requires: { suite: '^0.1' }, content: { economy: { scale: 2 } } });
    assert.equal(done.ok, false);
    assert.match(done.failed[0].message, /could not apply/);
});
