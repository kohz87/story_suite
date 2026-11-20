// Worn gear's stat bonuses count in a v1 fight's rolls (`gearStats: 1`, read live like soak); a fight opened before the mark rolls with the sheet's stats; the log names the AGI used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/index.js';
import { fightKind } from '../../../../modules/rpg/board/interaction.js';
import { dice } from '../../../../core/interaction/dice.js';
import { hashJson } from '../../../../core/replay.js';
import { COMBAT_V1_TEMPLATES } from '../../../../modules/rpg/templates-combat.js';
import { logOfV1 } from '../../../../modules/rpg/board/fight-view-v1-log.js';
import { readSheet } from '../../../../modules/rpg/read.js';
import { gearQuery } from '../../../../modules/rpg/board/gear-query.js';
import { sheetWithGear } from '../../../../modules/rpg/gear.js';
import { bonusTable } from '../../../../modules/rpg/checks/result.js';
import { STATS } from '../../../../modules/rpg/names.js';
import { equip, reply } from '../../inventory/gear-inventory.helpers.js';

const set = (host, slug, fields) => host.sdk.command('dm.set', { module: `pack.chat/${slug}`, fields });
async function world(t) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings: { features: { 'story-block.gear': true, 'story-block.rpg': true } } });
    t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    for (const { definition } of COMBAT_V1_TEMPLATES) {
        const made = structuredClone(definition);
        if (made.slug === 'skills') delete made.state.practice1.edit;
        assert.equal((await host.sdk.command('dm.define', { definition: made })).ok, true);
    }
    await set(host, 'character', { who: 'Ren' });
    await set(host, 'character', { level: 8, agi: 11 });
    await set(host, 'skills', { who: 'Ren' });
    await host.send('Foes.', reply('Rats.', ['+ dm foes — why | kind: set-slot-1 | name: Brutes | count: 4 | level: 6 | tier: standard']));
    await host.send('Boots.', reply('Boots.', ['+ item Swift Boots | slot: feet | rarity: epic | AGI: 4']));
    return host;
}
const heroId = host => fightKind.actors(host.head())[0].id;
const steps = host => [{ inputs: [{ actor: heroId(host), choice: 'normal', args: { target: '1.1' } }] }];
const agiOf = (host, setup) => fightKind.play(host.head(), setup, steps(host), dice(11, 0)).view.result.party[0].stats.agi;

test('a worn piece\'s AGI is in the hero\'s stat; a setup without the mark keeps the sheet\'s; the log names it', async t => {
    const host = await world(t);
    const marked = fightKind.open(host.head(), { anchor: 'a', seed: 11, args: { rules: {} } }).setup;
    assert.equal(marked.gearStats, 1);
    const old = { ...marked }; delete old.gearStats;
    assert.equal(agiOf(host, marked), 11, 'not worn yet');
    await equip(host, 'Swift Boots');
    assert.equal(agiOf(host, marked), 15, 'base 11 + 4 worn');
    assert.equal(agiOf(host, old), 11, 'an old setup replays with the sheet\'s stat');
    assert.equal(agiOf(host, marked), agiOf(host, marked), 'the same input twice: the same rolls');
    const log = logOfV1({ party: [{ label: 'Ren', stats: { agi: 15 } }], rounds: [[['tempo', 'Ren', 'Brute', 9, 13, 5, 8, true]]] }, true);
    assert.match(log[0].rows[0].math, /AGI 15$/);
    assert.doesNotMatch(logOfV1({ party: [{ label: 'Ren', stats: { agi: 15 } }], rounds: [[['tempo', 'Ren', 'Brute', 9, 13, 5, 8, true]]] })[0].rows[0].math, /AGI/, 'an unmarked fight shows none');
});

test('the witness holds the geared stats for a marked fight only', async t => {
    const host = await world(t), marked = fightKind.open(host.head(), { anchor: 'a', seed: 11, args: { rules: {} } }).setup, old = { ...marked };
    delete old.gearStats;
    const bare = [hashJson(fightKind.witness(host.head(), marked, [])), hashJson(fightKind.witness(host.head(), old, []))];
    await equip(host, 'Swift Boots');
    assert.notEqual(hashJson(fightKind.witness(host.head(), marked, [])), bare[0], 'worn: another fight');
    assert.equal(hashJson(fightKind.witness(host.head(), old, [])), bare[1], 'an old fight reads no gear stats');
});

test('a story check\'s table uses the stat with gear; the sheet without it gives the base', async t => {
    const host = await world(t), query = (name, args) => gearQuery(host.head())(name, args);
    const bonusOf = sheet => bonusTable([{ name: 'Ren', level: 8, stats: sheet.characters[0].stats, skills: [] }])[0].stats[STATS.indexOf('agi')];
    const sheet = readSheet(host.head());
    assert.equal(bonusOf(sheetWithGear(sheet, query)), bonusOf(sheet), 'nothing worn');
    await equip(host, 'Swift Boots');
    const base = readSheet(host.head());
    assert.equal(bonusOf(sheetWithGear(base, query)) - bonusOf(base), Math.floor(15 / 2) - Math.floor(11 / 2));
});
