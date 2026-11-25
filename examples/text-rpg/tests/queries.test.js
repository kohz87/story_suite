import test from 'node:test';
import assert from 'node:assert/strict';
import { selectParty } from '../../../ui/select/party.js';
import { levelFor } from '../src/rules/growth.js';
import { astraOf, newHost, reply, slice, withAstra } from './helpers/host.js';

const partyOf = host => selectParty({ actors: host.sdk.query('party.actors'), levels: host.sdk.query('party.levels'), sheet: host.sdk.query('rpg.sheet') });

test('rpg.sheet rows have the shape the Party tab reads (memberOf), stats and skills as the RPG gives them', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        const [row] = host.sdk.query('rpg.sheet');
        assert.deepEqual(Object.keys(row).sort(), ['away', 'bars', 'bonus', 'commands', 'effects', 'id', 'level', 'line', 'name', 'points', 'portrait', 'skills', 'stats', 'xpLabel', 'xpPct']);
        assert.deepEqual([row.name, row.line, row.level, row.xpPct, row.points, row.portrait, row.effects], ['Astra', 'Lv 1', 1, 0, 0, null, []]);
        assert.equal(row.xpLabel, '0/100', 'the xp held in this level over the 100 it takes');
        assert.deepEqual(row.stats, { STR: 7, VIT: 6, AGI: 7, DEX: 7, INT: 6, WIS: 6, CHA: 6 });
        assert.deepEqual(row.bars.map(bar => [bar.kind, bar.value, bar.max, bar.label]), [['hp', 5, 5, 'Health: Unhurt'], ['mp', 11, 11, 'Mana: Fresh'], ['sp', 11, 11, 'Stamina: Fresh']]);
        assert.deepEqual(row.commands, { spend: 'textRpg.spend', skillEdit: 'textRpg.skillEdit', export: 'textRpg.export' });
        assert.deepEqual(Object.keys(row.skills[0]).sort(), ['about', 'cost', 'glyph', 'kind', 'mastery', 'name', 'next', 'practice', 'rank', 'resource', 'stat']);
        assert.deepEqual([row.skills[0].stat, row.skills[0].rank, row.skills[0].resource, row.skills[0].cost, row.skills[0].next.name], ['AGI', 'Novice', 'stamina', 2, 'Apprentice']);
        assert.equal(row.newCharacterScreen, undefined, 'a pc exists');
    } finally {
        host.close();
    }
});

test('the Party tab\'s view-model takes the rows: the member, its level, bars and stats as the RPG\'s would', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        const party = partyOf(host);
        assert.equal(party.members.length, 1);
        const [member] = party.members;
        assert.deepEqual([member.id, member.name, member.level, member.line, member.xpPct, member.points], [astraOf(host).id, 'Astra', 1, 'Lv 1', 0, 0]);
        assert.equal(member.bars.length, 3);
        assert.equal(member.stats.AGI, 7);
        assert.equal(member.skills[0].name, 'Obscure');
    } finally {
        host.close();
    }
});

test('xpPct is the way from this level to the next; effects are conditions and injuries as words', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        await host.send('Go.', reply('Ow.', ['~ condition Astra — poisoned | until: treated', '+ injury Astra — cracked rib | hampers: str | grave: minor']));
        assert.deepEqual(host.sdk.query('rpg.sheet')[0].effects, ['poisoned', 'cracked rib']);
        await host.send('Again.', reply('Ow.', ['? try Astra | Obscure | normal | threat: above you', '+ xp Party — the ogre | size: real']));
        const me = astraOf(host);
        const { next } = levelFor(me.xp);
        assert.equal(host.sdk.query('rpg.sheet')[0].xpPct, Math.round((100 * me.xp) / next));
    } finally {
        host.close();
    }
});

test('party.levels and party.actors answer for the party; with no character the sheet is empty and textRpg.view names the screen', async t => {
    t.mock.method(console, 'warn', () => {});
    const empty = await newHost();
    const host = await withAstra();
    try {
        assert.deepEqual(empty.sdk.query('rpg.sheet'), []);
        assert.deepEqual(empty.sdk.query('textRpg.view'), { pcId: null, members: [], newCharacterScreen: 'text-rpg/new-character' });
        assert.deepEqual(host.sdk.query('party.levels'), [{ id: astraOf(host).id, name: 'Astra', level: 1, left: false }]);
        assert.deepEqual(host.sdk.query('party.actors'), [{ id: astraOf(host).id, name: 'Astra', pc: true }]);
        await host.send('Hello.', reply('Rorke joins.', ['+ companion Rorke | level: 9 | strengths: very strong, swordswoman']));
        assert.deepEqual(host.sdk.query('party.actors').map(actor => actor.name), ['Astra', 'Rorke']);
        const view = host.sdk.query('textRpg.view');
        assert.equal(view.pcId, astraOf(host).id);
        assert.equal(view.members[1].line, 'Lv 9 · companion');
        assert.equal(view.members[1].stats, null);
        assert.equal(host.sdk.query('rpg.sheet').find(row => row.name === 'Rorke').points, 0, 'a companion has no stat sheet, so no points to spend');
        assert.equal(partyOf(host).members.length, 2);
        assert.equal(slice(host).members[view.members[1].id].companion.level, 9);
    } finally {
        empty.close();
        host.close();
    }
});

test('a fallen character leaves the party but stays in the domain', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        await host.send('Run.', reply('The bridge.', ['! fall Astra — cut down on the bridge']));
        assert.deepEqual(host.sdk.query('rpg.sheet'), [], 'the sheet is closed');
        assert.equal(astraOf(host).fallen.how, 'cut down on the bridge');
    } finally {
        host.close();
    }
});

test('party.newCharacter names the screen only while no member is the reader\'s, and the sheet rows never do', async t => {
    t.mock.method(console, 'warn', () => {});
    const empty = await newHost();
    const host = await withAstra();
    const off = await newHost({ 'text-rpg.on': false });
    try {
        assert.equal(empty.sdk.query('party.newCharacter'), 'text-rpg/new-character');
        assert.deepEqual(empty.sdk.query('rpg.sheet'), []);
        assert.equal(host.sdk.query('party.newCharacter'), null, 'a member is the reader\'s');
        assert.equal(host.sdk.query('rpg.sheet').some(row => 'newCharacterScreen' in row), false);
        assert.equal(off.sdk.query('party.newCharacter'), null, 'not active');
        assert.equal(selectParty({ actors: [], newCharacter: empty.sdk.query('party.newCharacter') }), null);
        const party = selectParty({ actors: [{ id: 'x', name: 'X' }], newCharacter: empty.sdk.query('party.newCharacter') });
        assert.equal(party.newCharacterScreen, 'text-rpg/new-character');
        assert.equal(selectParty({ actors: [{ id: 'x', name: 'X' }], newCharacter: host.sdk.query('party.newCharacter') }).newCharacterScreen, undefined, 'null keeps today\'s path');
    } finally {
        empty.close();
        host.close();
        off.close();
    }
});
