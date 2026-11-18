// Pack format 4, job M2: the level cap reads the reader, then the selected game, then 99; ranks and the player rank come from the selected game; packRulesOf has no dead branches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstalled } from '../../../packs/installed.js';
import { contentOf } from '../../../packs/content.js';
import { levelCapFor, packInForce, packRulesOf, rulesFromSettings, packLevelsOf, DIFFICULTY_SETTING, STANDARD_PRESETS } from '../../../modules/rpg/index.js';
import { rankQuery } from '../../../modules/rpg/levels.js';
import { LEVEL_CAP_SETTING } from '../../../modules/rpg/names.js';
import { fakeSettings } from '../../packs/helpers/fake-settings.js';

const REQ = { suite: '^0.1', capabilities: ['data-modules-v1'] };
const tracker = slug => ({ slug, name: slug, schema: 1, stateVersion: 1, scope: 'chat', kinds: {}, state: { letter: { type: 'text', max: 4, default: 'F' } } });
const game = (id, rpg) => ({ id, format: 4, kind: 'game', version: '1.0.0', requires: REQ, content: { dataModules: [tracker('guild')], rpg: { formula: 'v1', ...rpg } } });
const ranksA = [{ name: 'Low', from: 1, to: 9 }, { name: 'High', from: 10, to: 50 }];
const ranksB = [{ name: 'Bronze', from: 1, to: 30 }];
const rankA = { module: 'guild', field: 'letter', label: 'Guild' };
const setup = async () => {
    const installed = createInstalled({ settings: fakeSettings() });
    for (const input of [game('ga', { levelCap: 50, ranks: ranksA, playerRank: rankA }), game('gb', { levelCap: 30, ranks: ranksB })]) { const made = await installed.install(input); assert.equal(made.ok, true, JSON.stringify(made.errors)); }
    return installed;
};
const recordsOf = installed => contentOf(installed.packs(), 'rpg');

test('the cap: a reader setting below 99 wins, else the game\'s cap, else 99; 99 and junk count as not chosen', () => {
    assert.equal(levelCapFor({ [LEVEL_CAP_SETTING]: 20 }, 50), 20, 'the reader wins over the game');
    assert.equal(levelCapFor({ [LEVEL_CAP_SETTING]: 60 }, 50), 60, 'also above the game cap');
    assert.equal(levelCapFor({ [LEVEL_CAP_SETTING]: 99 }, 50), 50, '99 is the unset default: the game');
    assert.equal(levelCapFor({}, 50), 50);
    assert.equal(levelCapFor({ [LEVEL_CAP_SETTING]: 'x' }, 50), 50);
    assert.equal(levelCapFor({ [LEVEL_CAP_SETTING]: 20 }), 20);
    assert.equal(levelCapFor({}, null), 99);
    assert.equal(levelCapFor(undefined, 0), 99);
    assert.equal(levelCapFor({}, 120), 99, 'an out-of-range game cap is not a cap');
});

test('the selected game gives the cap, the ranks and the player rank; selecting another changes them; none gives the built-ins', async () => {
    const installed = await setup();
    assert.equal(installed.selected().game, 'ga');
    let found = packLevelsOf(recordsOf(installed));
    assert.deepEqual(found, { ranks: ranksA, levelCap: 50, playerRank: rankA });
    assert.equal(levelCapFor({}, found.levelCap), 50);
    assert.equal(levelCapFor({ [LEVEL_CAP_SETTING]: 12 }, found.levelCap), 12, 'the reader beats the game');
    assert.deepEqual(rankQuery({}, { level: 10 }, { query: (name, args) => (name === 'packs.content' ? contentOf(installed.packs(), args.kind) : null) }), { name: 'High' });

    assert.equal(await installed.select('game', 'gb'), true);
    found = packLevelsOf(recordsOf(installed));
    assert.deepEqual(found, { ranks: ranksB, levelCap: 30 }, 'the other game: its ranks, its cap, no player rank');
    assert.equal(levelCapFor({}, found.levelCap), 30);

    assert.equal(await installed.select('game', null), true);
    found = packLevelsOf(recordsOf(installed));
    assert.equal(found, null, 'the built-in game has no ranks and no cap');
    assert.equal(levelCapFor({}, found?.levelCap), 99);
    assert.equal(rankQuery({}, { level: 10 }, { query: () => recordsOf(installed) }), null);
});

test('packRulesOf reads only the formula record\'s pack: no numbers, no formula word, no cap', () => {
    const records = [{ slug: 'formula', formula: 'v1', pack: 'ga', numbers: { foeBase: 40 }, levelCap: 12 }];
    assert.deepEqual(packRulesOf(records), { pack: 'ga' });
    assert.equal(packRulesOf([{ slug: 'formula', pack: 'ga', numbers: { foeBase: 40 } }]), null, 'numbers alone no longer make an ask');
    assert.equal(packRulesOf([{ slug: 'ranks', levelCap: 12 }]), null);
    assert.equal(packRulesOf([]), null);
    assert.equal(packRulesOf(null), null);
});

test('a pack\'s numbers change nothing: the rules are the settings\' alone, and no ask is in force', () => {
    const asked = packRulesOf([{ slug: 'formula', formula: 'v1', pack: 'ga', numbers: { foeBase: 40 } }]);
    assert.deepEqual(rulesFromSettings({}, asked), rulesFromSettings({}));
    assert.deepEqual(rulesFromSettings({ [DIFFICULTY_SETTING]: 'harsh' }, asked), { ...STANDARD_PRESETS.harsh, levelDivisor: 5 });
    assert.deepEqual(packInForce({}, asked), { formula: false, numbers: false });
    assert.deepEqual(packInForce({}, null), { formula: false, numbers: false });
});
