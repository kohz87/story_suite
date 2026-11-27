// The ownership rule on the paths beside the meters mapping: the world's opened notes, the public paths, the per-reply step's away names,
// one name comparison, portraits and presence, and the owners read once per pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { closedSecrets } from '../../modules/world/chronicle/world-daily/arc-brief.js';
import { learnedAnchors } from '../../modules/world/chronicle/world-daily/learned.js';
import { personNamed } from '../../modules/people/meters/npc-lines-parts/names.js';
import { ownersOf } from '../../modules/people/meters/npc-meters-parts/owners.js';
import { ownerTargets } from '../../modules/people/npc-api/dossier-target.js';
import { stampScenePresence } from '../../modules/people/calls/hosted-presence.js';
import { FEATURE_DRIFT } from '../../modules/people/meters/npc-meters.js';
import { DEATH, ID, cast, note, person } from './npc-alias-lines.helpers.js';
import { REN_AWAY, key, suite } from './away.helpers.js';
import { seedPeople } from './helpers/seed-people.js';

const entry = (name, unlocked = []) => ({ name, meters: { trust: 5 }, stages: {}, unlocked, milestones: {} });
const gated = text => [{ id: ID, gate: 'trust 5', packId: 'oar', text }];

for (const [label, first, key0] of [
    ['a dead namesake', { name: 'Ana', lifeState: 'deceased' }, 'npc_ana'],
    ['a renamed person whose entry has the old name', { name: 'Annie' }, 'npc_ana'],
]) {
    test(`the world does not read the opened notes of ${label} as a new "Ana"'s`, () => {
        const people = {
            npcs: {
                npc_ana: { id: 'npc_ana', aliases: [], castFrom: { id: 'old' }, ...first },
                npc_new: { id: 'npc_new', name: 'Ana', aliases: [], castFrom: { id: 'new' }, secrets: gated('new text') },
            },
            order: ['npc_ana', 'npc_new'], bonds: { npcs: { [key0]: entry('Ana', [ID]) } },
        };
        assert.deepEqual(closedSecrets(people), [{ name: 'Ana', text: 'new text' }]);
        assert.deepEqual(learnedAnchors(people, [{ id: 'new', secrets: [{ id: 'oar', text: 'new text' }] }]), []);
    });
}

test('the world still reads an older entry under no dossier\'s id as its person\'s', () => {
    const people = { npcs: { npc_ana: { name: 'Ana', castFrom: { id: 'a' }, secrets: gated('text') } }, order: ['npc_ana'], bonds: { npcs: { npc_older: entry('Ana', [ID]) } } };
    assert.deepEqual(closedSecrets(people), []);
    assert.deepEqual(learnedAnchors(people, [{ id: 'a', secrets: [{ id: 'oar' }] }]), ['learned:a/oar']);
});

test('lines name a living namesake before a dead one, and a dead one before an archived one', () => {
    const rows = { a: { name: 'Ana', archived: true }, b: { name: 'Ana', lifeState: 'deceased', lifeStateCertainty: 'explicit' }, c: { name: 'Ana' } };
    assert.equal(personNamed(rows, 'Ana').key, 'c');
    assert.equal(personNamed({ a: rows.a, b: rows.b }, 'Ana').key, 'b');
});

test('whose entry a key is: the id\'s dossier, else the one the rule assigns; nobody\'s hooks are asked through another\'s alias', () => {
    const owners = ownersOf({ npc_ana: { name: 'Annie', aliases: [] }, npc_bo: { name: 'Bo', aliases: ['Ana'] } });
    const npcs = { npc_ana: entry('Ana'), npc_bo: entry('Bo'), npc_older: entry('Ana') };
    assert.equal(owners.ownerOf(npcs, 'npc_ana').id, 'npc_ana');
    assert.equal(owners.ownerOf(npcs, 'npc_older'), null);
    assert.deepEqual(owners.asking(npcs, 'npc_older'), { name: '', labels: [] });
    assert.equal(owners.ownerOf({ npc_older: entry('Ana') }, 'npc_older').id, 'npc_bo', 'with no entry of their own, the older one is theirs');
});

const publicTrust = (h, name) => h.publicPaths[0].get(`npc.${name}.trust`);

test('public paths: a dead person\'s alias does not hide the living person of that name', async () => {
    const h = await cast(person('npc_bo', 'Bo', ['Ana']), person('npc_ana', 'Ana'));
    h.line('~ npc Ana | trust: +5');
    await h.die('npc_bo');
    assert.equal(publicTrust(h, 'Ana'), 15);
    assert.equal(publicTrust(h, 'Bo'), undefined);
});

test('public paths: a living person\'s alias does not hide another who has no entry yet', async () => {
    const h = await cast(person('npc_bo', 'Bo', ['Ana']), person('npc_ana', 'Ana'));
    h.line('~ npc Bo | trust: -7');
    assert.deepEqual([publicTrust(h, 'Bo'), publicTrust(h, 'Ana')], [3, 10]);
});

test('public paths: an entry still under an old name goes out as its owner, and the new holder of the name has their own', async () => {
    const h = await cast(person('npc_ana', 'Ana'));
    h.line('~ npc Ana | trust: +5');
    await h.change('npc_ana', { name: 'Annie' });
    await h.add(person('npc_new', 'Ana'));
    assert.deepEqual([publicTrust(h, 'Annie'), publicTrust(h, 'Ana')], [15, 10]);
});

test('one name comparison: "Ana Maria" is the dossier "Ana-Maria", so a person with that alias never answers for her', async () => {
    const h = await cast(person('npc_am', 'Ana-Maria'), person('npc_bo', 'Bo', ['Ana Maria'], { portrait: { url: 'https://img.invalid/bo.png' } }));
    await h.die('npc_am');
    assert.equal(h.adapter.meters('Ana Maria'), null);
    assert.equal(h.runQuery('npc.portrait', { name: 'Ana Maria' }), null);
    assert.match(h.refused('~ npc Ana Maria | trust: +5').message, /has died/);   // the line is hers, not Bo's
    assert.deepEqual(h.bonds(), {});
});

for (const [state, change] of [['confirmed dead', DEATH], ['archived', { archived: true, present: false }]]) {
    test(`Ana ${state}: her name shows no portrait of, and marks nobody, who only has it as an alias`, async () => {
        const url = 'https://img.invalid/bo.png';
        const h = await cast(person('npc_ana', 'Ana'), person('npc_bo', 'Bo', ['Ana', 'Ferryman'], { portrait: { url } }));
        await h.change('npc_ana', change);
        assert.equal(h.runQuery('npc.portrait', { name: 'Ana' }), null);
        assert.equal(h.runQuery('npc.portrait', { name: 'Ferryman' }), url);
        const list = Object.values(h.delta.records).map(record => ({ ...record, present: false }));
        assert.deepEqual(stampScenePresence({ npcs: list, turn: 1 }, ['Ana']), []);
        assert.deepEqual(stampScenePresence({ npcs: list, turn: 1 }, ['Ferryman']), ['npc_bo']);
        const target = ownerTargets(list);
        assert.deepEqual([target('Ana'), target('npc_bo'), target('Bo')], ['', 'npc_bo', 'npc_bo']);
    });
}

test('the editor\'s read and a pass over several dossiers read the stored dossiers once each', async () => {
    const h = await cast(person('npc_ana', 'Ana'), person('npc_bo', 'Bo'));
    h.line('~ npc Ana | trust: +5');
    const query = h.sdk.query;
    let lists = 0;
    h.sdk.query = (name, args) => { if (name === 'people.list') lists += 1; return query(name, args); };
    h.adapter.readEditor(() => '', h.delta.api.getNpc('npc_ana'));
    assert.equal(lists, 1);
    lists = 0;
    const holds = h.adapter.meterHolders();
    assert.deepEqual(['npc_ana', 'npc_bo', 'npc_ana'].map(id => holds(h.delta.api.getNpc(id))), [true, false, true]);
    assert.equal(lists, 1);
});

test('the per-reply step: "Ana" being away does not hold Bo, who has "Ana" as an alias', async () => {
    const people = {
        npc_ana: person('npc_ana', 'Ana'),
        npc_bo: person('npc_bo', 'Bo', ['Ana']),
    };
    const s = await suite({ settings: { customMeters: [{ name: 'Mood', min: -50, max: 50, start: 0, drift: 4, driftTo: 0 }] }, features: { [FEATURE_DRIFT]: true }, people });
    await s.say();
    await seedPeople(s.host.sdk, s.host.store, Object.values(people));
    await s.say(['~ npc Ana | mood: +15', '~ npc Bo | mood: +15']);
    await s.keys([key('Ana', { here: false, away: REN_AWAY })], 3 * 1440);
    await s.say();
    await s.say();
    assert.deepEqual([s.meters('Ana').meters.mood, s.meters('Bo').meters.mood], [15, 3]);
});
