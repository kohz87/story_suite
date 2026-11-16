// The v1 sheet read for a fight and the result envelope, on the real reader's output: the party, the foe members, the witness input, and the swipe / delete / Re-read / reload
// agreement of the pure functions (they read only the sheet, so the same chat state gives the same input).

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../packages/story-block/testkit/index.js';
import { COMBAT_V1_TEMPLATES } from '../../../../modules/rpg/templates-combat.js';
import { readSheet } from '../../../../modules/rpg/read.js';
import { fightInputOf, witnessOf } from '../../../../modules/rpg/combat/input.js';
import { envelopeOf, hurtsOf } from '../../../../modules/rpg/combat/envelope.js';
import { playBoard } from '../../../../modules/rpg/combat/play.js';
import { seeded } from './dice.helper.js';
import { reply, success } from '../../../../packages/story-block/tests/v2/data-modules/helpers.js';

const sign = kind => (/^(practice-|set-slot)/u.test(kind) ? '+' : '~');
const line = (slug, kind, extra = '') => `${sign(kind)} dm ${slug} — why | kind: ${kind}${extra}`;
const FOES = line('foes', 'set-slot-1', ' | name: Wolf | count: 3 | level: 8 | tier: elite');
async function story(t) {
    const host = await createHost(); t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    for (const { definition } of COMBAT_V1_TEMPLATES) {
        const made = structuredClone(definition);
        if (made.slug === 'skills') delete made.state.practice1.edit;
        success(await host.sdk.command('dm.define', { definition: made }));
    }
    for (const slug of ['character', 'skills']) success(await host.sdk.command('dm.set', { module: `pack.chat/${slug}`, fields: { who: 'Ren' } }));
    success(await host.sdk.command('dm.set', { module: 'pack.chat/character', fields: { level: 10, int: 12, wis: 12 } }));
    await host.send('Learn.', reply(line('skills', 'learn-1', ' | name: Bolt | about: Fire. | stat: int | type: attack')));
    success(await host.sdk.command('dm.set', { module: 'pack.chat/skills', fields: { practice1: 300 } }));
    return host;
}
const input = (host, options) => fightInputOf(readSheet(host.head()), options);

test('the engine input holds the living v1 heroes with their skills and mastery, and every foe member at full HP', async t => {
    const host = await story(t);
    await host.send('Wolves.', reply(FOES));
    const { party, foes, groups } = input(host);
    assert.equal(party.length, 1);
    assert.deepEqual([party[0].id, party[0].label, party[0].level, party[0].mastery, party[0].skills], ['ren', 'Ren', 10, 3, [{ name: 'Bolt', type: 'attack', stat: 'int' }]], 'Adept at level 10');
    assert.deepEqual([party[0].hp, party[0].maxHp, party[0].mp, party[0].maxMp], [10, 10, party[0].maxMp, party[0].maxMp]);
    assert.deepEqual(foes.map(foe => [foe.id, foe.label, foe.tier, foe.level, foe.hp === foe.maxHp]), [1, 2, 3].map(n => [`1.${n}`, `Wolf ${n}`, 'elite', 8, true]));
    assert.deepEqual(groups, [1]);
    const run = playBoard({ party, foes }, seeded({ seed: 4, maxExchanges: 2 }), [{}, {}]);
    assert.equal(run.exchanges, 2, 'the engine takes the input as it is');
    // a later segment starts from the record: the foes keep the HP the record left them
    const carried = input(host, { carried: run });
    const left = new Map(run.foes.map(foe => [foe.id, foe.hp]));
    assert.deepEqual(carried.foes.map(foe => foe.hp), carried.foes.map(foe => left.get(foe.id)));
    assert.deepEqual(carried.party, party, 'heroes come from the sheet, not the record');
});

test('no foes, no heroes, a dead hero and an earlier block all read as nothing to fight', () => {
    assert.deepEqual(fightInputOf({ characters: [], foes: [] }), { party: [], foes: [], groups: [] });
    assert.deepEqual(fightInputOf(null), { party: [], foes: [], groups: [] });
    const old = { characters: [{ who: 'Old', key: 'old', alive: true }, { v1: true, who: 'Dead', key: 'dead', alive: false }], foes: [{ slot: 1, name: 'Rat', count: 2, level: 1, filled: true }] };
    assert.deepEqual(fightInputOf(old), { party: [], foes: [], groups: [] });
});

test('the witness input changes with anything the fight reads and with nothing else; a swipe and a middle delete of another reply give the same one', async t => {
    const host = await story(t);
    await host.send('Wolves.', reply(FOES));
    const base = JSON.stringify(witnessOf(readSheet(host.head())));
    assert.equal(witnessOf(readSheet(host.head())).v1, 1);
    await host.swipe(reply(FOES));
    assert.equal(JSON.stringify(witnessOf(readSheet(host.head()))), base, 'a swipe with the same line');
    success(await host.sdk.command('dm.set', { module: 'pack.chat/skills', fields: { practice1: 100 } }));
    assert.notEqual(JSON.stringify(witnessOf(readSheet(host.head()))), base, 'a rank in force is read');
    success(await host.sdk.command('dm.set', { module: 'pack.chat/skills', fields: { practice1: 300 } }));
    assert.equal(JSON.stringify(witnessOf(readSheet(host.head()))), base);
    await host.send('Later.', 'Nothing changes.');
    await host.st.deleteMessage(host.ctx.chat.length - 1);
    assert.equal(JSON.stringify(witnessOf(readSheet(host.head()))), base, 'a middle delete of an unrelated reply');
});

test('the envelope is the record plus the old words, with the v1 marker inside board, no seed and no result version', () => {
    const party = [{ id: 'ren', label: 'Ren', level: 1, stats: {}, hp: 3, maxHp: 10, mp: 8, maxMp: 8, sp: 5, maxSp: 9 }];
    const record = {
        result: 'win', exchanges: 2, party, foes: [{ id: '1.1', label: 'Wolf' }], lines: [], rounds: [[], []],
        moves: [{ id: 'ren', label: 'Ren', bar: 'hp', from: 10, to: 6, amount: -4 }, { id: '1.1', label: 'Wolf', bar: 'hp', from: 9, to: 0, amount: -9 },
            { id: 'ren', label: 'Ren', bar: 'hp', from: 6, to: 3, amount: -3 }, { id: 'ren', label: 'Ren', bar: 'sp', from: 9, to: 9, amount: 0 }, { id: 'ren', label: 'Ren', bar: 'mp', from: 8, to: 7, amount: -1 },
            { id: 'ren', label: 'Ren', bar: 'mp', from: 7, to: 8, amount: 1 }],
    };
    const copy = structuredClone(record), where = { id: 'b:1', groups: [1], modules: { ren: 'pack.chat/character' } };
    const out = envelopeOf(record, where);
    assert.deepEqual(record, copy, 'the record is not changed');
    assert.deepEqual(out.hurts, [{ id: 'c:ren', kind: 'char', name: 'Ren', module: 'pack.chat/character', field: 'hp', from: 10, to: 3 }], 'net change per hero and bar; foes and a bar that came back are left out');
    assert.deepEqual([out.stop, out.board, 'v' in out, 'legend' in out, 'items' in out, 'cleared' in out], ['won', { id: 'b:1', offset: 0, groups: [1], v1: 1 }, false, false, false, false]);
    assert.equal(out.result, 'win', 'the v1 record stays whole');
    const full = envelopeOf(record, { ...where, legend: true, items: [{ stack: 's' }], cleared: [1] });
    assert.deepEqual([full.legend, full.items, full.cleared], [1, [{ stack: 's' }], [1]]);
    assert.deepEqual(['win', 'loss', 'fled', 'unfinished'].map(result => envelopeOf({ ...record, result }, where).stop), ['won', 'lost', 'fled', 'open']);
    assert.deepEqual(hurtsOf(null), []);
    // each bar has the old row id (`c:<key>`, `c:<key>:mana`, `c:<key>:stamina`); a later segment's offset is the exchanges before it (the record's exchanges less its rounds)
    const bars = hurtsOf({ party, moves: [{ id: 'ren', label: 'Ren', bar: 'mp', from: 8, to: 5 }, { id: 'ren', label: 'Ren', bar: 'sp', from: 9, to: 4 }] });
    assert.deepEqual(bars.map(row => [row.id, row.field]), [['c:ren:mana', 'mp'], ['c:ren:stamina', 'sp']]);
    assert.equal(envelopeOf({ ...record, exchanges: 5, rounds: [[], []] }, where).board.offset, 3);
    assert.ok(!('seed' in envelopeOf(record, { ...where, seed: 1 }).board), 'the envelope stores no seed');
});
