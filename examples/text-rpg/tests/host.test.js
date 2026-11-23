import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHost } from '../../../testkit/index.js';
import { active } from '../src/module-parts/active.js';
import { textRpgModule } from '../src/module.js';
import { BUY, astraOf, drawn, newHost, reply, sent, slice, tries, withAstra } from './helpers/host.js';

const STATIC = 'story_suite_static';
const TAIL = 'story_suite_tail_1';
const TRY = ['? try Astra | Obscure | normal | threat: a fair match', '+ xp Party — slipped past | size: real'];

test('the active rule: Text RPG on and the RPG off', () => {
    const view = (on, rpg) => ({ feature: id => (id === 'text-rpg.on' ? on : rpg) });
    assert.deepEqual([[true, false], [true, true], [false, false], [false, true]].map(([a, b]) => active(view(a, b))), [true, false, false, false]);
    assert.equal(active({}), false);
    assert.equal(active({ feature: () => { throw new Error('no'); } }), false);
});

test('the definition registers on the host; the feature is off until the reader turns it on', async t => {
    t.mock.method(console, 'warn', () => {});
    let host = null;
    host = await createHost({ modules: [textRpgModule({ feature: id => host.sdk.feature(id) })] });
    try {
        assert.ok(host.sdk.modules().some(entry => entry.id === 'text-rpg'));
        const feature = host.sdk.features().find(entry => entry.id === 'text-rpg.on');
        assert.deepEqual([feature.label, feature.on, feature.default], ['Text RPG', false, false]);
        const refused = await host.sdk.command('textRpg.create', { name: 'A', stats: {} });
        assert.equal(refused.code, 'FEATURE_OFF');
        host.features.set('text-rpg.on', true);
        assert.equal(host.sdk.feature('text-rpg.on'), true);
    } finally {
        host.close();
    }
});

test('off means off: no static text, no grammar, no tail, no answers, a quiet Problem for a line', async t => {
    t.mock.method(console, 'warn', () => {});
    const off = await newHost({ 'text-rpg.on': false });
    const plain = await newHost({ 'text-rpg.on': false });
    try {
        await off.send('Hello.', reply('A gate.', TRY));
        await plain.send('Hello.', reply('A gate.'));
        for (const key of [STATIC, TAIL]) assert.deepEqual(sent(off, key), sent(plain, key), `${key}: byte for byte as without the module`);
        assert.doesNotMatch(sent(off, STATIC).at(-1), /Text RPG|\? try|\+ xp/);
        for (const name of ['rpg.sheet', 'party.levels', 'party.actors', 'textRpg.view', 'textRpg.dice']) assert.equal(off.sdk.query(name), null, name);
        assert.equal(drawn(off), null, 'no dice are drawn');
        assert.deepEqual(off.turn.problems().filter(problem => problem.module === 'text-rpg').map(problem => [problem.code, problem.quiet]), [['FEATURE_OFF', true], ['FEATURE_OFF', true]]);
    } finally {
        off.close();
        plain.close();
    }
});

test('while active the static part holds the approved rules and the kinds\' grammar, byte-identical every reply', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        await host.send('One.', reply('A.'));
        await host.send('Two.', reply('B.', TRY));
        const statics = sent(host, STATIC);
        assert.equal(new Set(statics).size, 1);
        assert.match(statics[0], /Text RPG: tell every fight, chase, trap and danger as it would really unfold/);
        assert.match(statics[0], /Never write numbers, dice or luck\./);
        assert.match(statics[0], /^\? try Who \| skill or stat \| easy\|normal\|hard\|very hard/m);
        assert.match(statics[0], /^\+ xp Party — what was overcome \| size: minor\|real\|major\|great/m);
    } finally {
        host.close();
    }
});

test('the RPG on turns Text RPG off, even with its own feature on', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await newHost({ 'story-block.rpg': true });
    try {
        await host.send('Hello.', reply('A gate.'));
        assert.equal(host.sdk.query('textRpg.view'), null);
        assert.doesNotMatch(sent(host, STATIC).at(-1), /Text RPG:/);
        assert.equal((await host.sdk.command('textRpg.create', { name: 'A', stats: {} })).code, 'FEATURE_OFF');
    } finally {
        host.close();
    }
});

test('a reply\'s lines run end to end: the roll, its cost, practice and the xp, with no Problem', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        await host.send('We sneak.', reply('The gate looms.', TRY));
        const me = astraOf(host);
        assert.equal(me.pools.sp.now, me.pools.sp.max - 2);
        assert.equal(Object.values(me.practice).some(n => n > 0), true);
        assert.equal(me.xp, 20);
        assert.deepEqual(host.turn.problems(), []);
        const [rolled] = tries(host);
        assert.equal(rolled.data.die, drawn(host).list[0], 'the first die of the reply');
        assert.equal(rolled.narrate, true);
    } finally {
        host.close();
    }
});

test('a reply with no dice of its own to read (a continue) draws none and the old ones are not used again', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        await host.send('We sneak.', reply('The gate looms.'));
        const kept = JSON.stringify(drawn(host));
        const steps = host.store.receipts().length;
        await host.cont(' More.');
        assert.equal(JSON.stringify(drawn(host)), kept, 'a continue draws nothing');
        assert.equal(host.store.receipts().length, steps);
    } finally {
        host.close();
    }
});

test('a party with injuries and conditions keeps the whole dice note in the real prompt: the note leads the tail (gear is in tail.test.js)', async t => {
    t.mock.method(console, 'warn', () => {});
    const skills = ['Obscure', 'Lore', 'Tracking', 'Knots', 'Haggling'].map((name, at) => ({ name, about: `a long description of what ${name} lets her do in a hard place`, stat: ['agi', 'int', 'wis', 'dex', 'cha'][at], type: 'utility' }));
    const host = await newHost();
    try {
        assert.equal((await host.sdk.command('textRpg.create', { name: 'Astra', stats: BUY, skills })).ok, true);
        const lines = ['Astra', 'Rorke', 'Edda'].flatMap(name => [...(name === 'Astra' ? [] : [`+ companion ${name} | level: 9 | strengths: very strong, a veteran swordswoman, tracker`]), `+ injury ${name} — cracked rib | hampers: str | grave: minor`, `~ condition ${name} — poisoned | until: treated`]);
        await host.send('We go on.', reply('The road.', lines));
        await host.send('Onward.', reply('The next day.'));
        const tail = sent(host, TAIL).at(-1);
        const note = tail.split('\n').find(line => line.startsWith('Dice for this reply'));
        assert.ok(note, 'the note is in the tail');
        assert.match(note, /Bonus by stat or skill: Astra: .*\. The story must follow each result strictly\./);
        assert.match(note, /for example \? try Astra \| Obscure \| normal\.$/, 'the note ends whole');
        for (const name of ['Astra', 'Rorke', 'Edda']) assert.match(tail, new RegExp(`${name} \\(`), `${name}'s line is there`);
        for (const name of ['Astra', 'Rorke', 'Edda']) assert.ok(tail.indexOf(note) < tail.indexOf(`${name} (`), `the note comes before ${name}'s line`);
        assert.equal(textRpgModule(null).context.budget, 600);
    } finally {
        host.close();
    }
});

test('the manifest depends on Story Block and the code imports nothing outside the folder', () => {
    const root = new URL('../', import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
    assert.deepEqual(manifest.dependencies, ['third-party/Story_block']);
    assert.equal(manifest.display_name, 'Story Suite Text RPG');
    assert.equal(manifest.js, 'index.js');
    const files = [];
    const walk = dir => readdirSync(dir).forEach(name => {
        const path = new URL(`${name}${statSync(new URL(name, dir)).isDirectory() ? '/' : ''}`, dir);
        if (name.endsWith('.js')) files.push(path);
        else if (statSync(path).isDirectory() && name !== 'tests') walk(path);
    });
    walk(root);
    assert.ok(files.length > 30);
    for (const file of files.filter(path => !path.pathname.includes('/tests/'))) {
        const source = readFileSync(file, 'utf8');
        for (const [, from] of source.matchAll(/\bfrom\s+'([^']+)'/g)) {
            assert.match(from, /^(?:\.{1,2}\/)+(?:[\w-]+\/)*[\w-]+\.js$/, `${file.pathname} imports ${from}`);
            assert.ok(new URL(from, file).href.startsWith(root.href), `${file.pathname} imports ${from} from outside the folder`);
        }
        assert.doesNotMatch(source, /Math\.random|generateRaw|generateQuiet/, `${file.pathname} uses no Math.random and no model calls`);
    }
});
