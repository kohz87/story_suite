// textRpg.export (the Party tab's Export for a Text RPG member): a file in the RPG character file's shape, plus Text RPG's own part; the RPG's parser reads it, and so does Text RPG's wizard, which gets back what it had.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCharacterFile as rpgParse } from '../../../modules/rpg/charfile.js';
import { parseCharacterFile } from '../src/wizard/charfile.js';
import { exportFile } from '../src/module-parts/export.js';
import { SKILLS, astraOf, reply, withAstra } from './helpers/host.js';
import { astra, sliceOf } from './helpers/fake-ctx.js';

const exported = host => host.sdk.query('textRpg.export', { id: astraOf(host).id });

test('the sheet row names the export query, and the query gives the file the Party tab saves (stores nothing)', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        assert.equal(host.sdk.query('rpg.sheet')[0].commands.export, 'textRpg.export');
        const before = JSON.stringify(host.head());
        const answer = exported(host);
        assert.deepEqual([answer.ok, answer.name, answer.fileName, answer.own, answer.level, answer.points, answer.items, answer.money], [true, 'Astra', 'astra.character.json', true, 1, 0, 0, 0]);
        assert.equal(JSON.stringify(host.head()), before, 'a query: nothing is stored');
        assert.equal(host.sdk.query('textRpg.export', { id: 'ac_nobody00' }).ok, false);
        assert.equal(host.sdk.query('textRpg.export', { id: 'ac_nobody00' }).message, 'That character is not in the story any more.');
    } finally {
        host.close();
    }
});

test('the file has the RPG character file\'s fields for what Text RPG has, and the RPG\'s own parser reads it', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra({}, { modules: { 'text-rpg': { tone: 'gritty' } } });
    try {
        await host.send('One.', reply('Told.', ['? try Astra | Obscure | hard | threat: a fair match', '+ xp Party — a deed | size: major']));
        const file = JSON.parse(exported(host).text);
        assert.deepEqual([file.storySuiteCharacter, file.level, file.points, file.stats], [1, 1, 0, { str: 7, vit: 6, agi: 7, dex: 7, int: 6, wis: 6, cha: 6 }]);
        assert.deepEqual(file.skills.map(skill => [skill.name, skill.stat, skill.uses, skill.type]), [['Obscure', 'agi', 'stamina', 'speed'], ['Lore', 'int', 'stamina', 'utility']]);
        assert.equal(file.textRpg.xp, 60);
        const read = rpgParse(exported(host).text);
        assert.equal(read.ok, true, read.message);
        assert.deepEqual([read.file.level, read.file.points, read.file.skills.length, read.file.skills[0].type], [1, 0, 2, 'speed']);
    } finally {
        host.close();
    }
});

test('Text RPG\'s wizard reads its own file back exactly: the level, the stats, the types (social and craft too), the costs and the ranks', () => {
    const me = astra({ xp: 400, stats: { str: 9, vit: 8, agi: 7, dex: 6, int: 5, wis: 5, cha: 5 }, practice: { obscure: 150 } });
    me.skills = [
        { name: 'Obscure', about: 'melts into shadow', stat: 'agi', type: 'movement', cost: { pool: 'sp', n: 3 } },
        { name: 'Haggle', about: 'a fair price', stat: 'cha', type: 'social', cost: null },
        { name: 'Tinker', about: '', stat: 'dex', type: 'craft', cost: { pool: 'mp', n: 2 } },
    ];
    const answer = exportFile({ domains: { textRpg: sliceOf([me]) } }, { id: me.id });
    assert.equal(answer.ok, true);
    assert.equal(rpgParse(answer.text).ok, true, 'and the RPG reads it too');
    const read = parseCharacterFile(answer.text);
    assert.equal(read.ok, true, read.message);
    assert.deepEqual([read.file.level, read.file.points, read.file.extras], [5, 4, true]);
    assert.deepEqual(read.file.skills.map(skill => [skill.name, skill.stat, skill.type, skill.rank, skill.cost ?? null]), [
        ['Obscure', 'agi', 'movement', 2, { pool: 'sp', n: 3 }], ['Haggle', 'cha', 'social', 0, null], ['Tinker', 'dex', 'craft', 0, { pool: 'mp', n: 2 }]]);
});

test('the RPG\'s file keeps at most three utility skills: the first three go in', () => {
    const me = astra();
    me.skills = Array.from({ length: 5 }, (_, at) => ({ name: `U${at}`, about: '', stat: 'str', type: 'utility', cost: null }));
    const file = JSON.parse(exportFile({ domains: { textRpg: sliceOf([me]) } }, { id: me.id }).text);
    assert.deepEqual(file.skills.map(skill => skill.name), ['U0', 'U1', 'U2']);
    assert.equal(rpgParse(JSON.stringify(file)).ok, true);
});

test('a companion, a fallen character and a stranger have no file', () => {
    const state = { domains: { textRpg: sliceOf([astra({ id: 'ac_rorke001', name: 'Rorke', pc: false, companion: { level: 3, strengths: [] } }), astra({ id: 'ac_edda0001', name: 'Edda', pc: false, fallen: { how: 'cut down' } })]) } };
    for (const id of ['ac_rorke001', 'ac_edda0001', 'ac_nobody00']) assert.equal(exportFile(state, { id }).ok, false);
    assert.equal(exportFile(null, { id: 'x' }).ok, false);
    assert.equal(SKILLS.length, 2);
});
