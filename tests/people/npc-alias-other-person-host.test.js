// The same rule on the real adapter (./npc-alias-other-person.test.js has the record helpers): every path that maps a person to a meters entry,
// with Ana alive, archived or confirmed dead, in both directions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeDelta, host } from './storysuite-v2-meters.helpers.js';
import { seedPeople } from './helpers/seed-people.js';

const ID = 'sec_cccccccc';
const note = (who, extra) => ({ id: ID, title: `${who} title`, when: `${who} event happens`, text: `${who} keeps a spare oar.`, from: 'pack', ...extra });
const person = (id, name, aliases) => ({
    id, name, aliases, present: true, relationship: { trust: 10, affection: 0, desire: 0, tension: 0 }, secrets: [note(name, { meter: 'trust', at: 15 })],
});
const DEATH = { archived: true, present: false, lifeState: 'deceased', lifeStateCertainty: 'explicit' };

async function pair() {
    const delta = fakeDelta();
    delta.records = { npc_ana: person('npc_ana', 'Ana', []), npc_bo: person('npc_bo', 'Bo', ['Ana']) };
    const h = await host({ delta });
    h.bonds = () => h.store.head().domains.people.bonds?.npcs ?? {};
    h.end = async change => {
        Object.assign(delta.records.npc_ana, change);
        h.reply('Later.');
        // (The stored dossiers carry no archive flag; only the live list has one.)
        await seedPeople(h.sdk, h.store, Object.values(delta.records).map(({ archived, ...record }) => record));
    };
    h.record = id => delta.api.getNpc(id);
    h.cast = () => h.runQuery('npc.cast');
    return h;
}

// What the editor and the dossier view show of `id`'s note: every word of `who` that is there.
const shown = (h, id) => {
    const npc = h.record(id);
    return { editor: h.adapter.editorHtml(npc), view: JSON.stringify(h.adapter.dossierMeters([h.record('npc_ana'), h.record('npc_bo')])[id] ?? null) };
};
const showsNothingOpened = (h, id, label) => {
    const { editor, view } = shown(h, id);
    const who = h.record(id).name;
    assert.doesNotMatch(editor, new RegExp(`${who} (title|keeps|event)`), `${label}: the editor keeps ${who}'s note hidden`);
    assert.doesNotMatch(editor, /value="open" selected/, `${label}: not marked opened`);
    assert.doesNotMatch(view, /"state":"open"/, `${label}: the dossier view has no opened note`);
};

for (const [state, change] of [['alive', null], ['archived', { archived: true, present: false }], ['confirmed dead', DEATH]]) {
    test(`Ana ${state}, her note opened: Bo shows nothing of hers, and "~ npc Bo" leaves her entry`, async () => {
        const h = await pair();
        h.reply('Warm.', '~ npc Ana | trust: +10');
        assert.deepEqual(h.bonds().npc_ana.unlocked, [ID]);
        if (change) await h.end(change);
        const ana = structuredClone(h.bonds().npc_ana);
        const bo = () => h.record('npc_bo');
        showsNothingOpened(h, 'npc_bo', 'before Bo has an entry');
        assert.equal(h.npc('Bo'), null);
        assert.equal(h.adapter.meters('Bo'), null);
        assert.equal(h.runQuery('npc.dossier', { name: 'Bo' }).unlocked, undefined);
        assert.equal(h.adapter.sliceView([bo()])[0].relationship.trust, 10);
        assert.equal(h.cast().find(item => item.name === 'Bo').key, 'npc_bo');
        assert.deepEqual(h.cast().find(item => item.name === 'Bo').opened, []);
        assert.equal(h.adapter.readEditor(() => undefined, bo()).noteStates, undefined);
        assert.deepEqual(h.adapter.eventWatch([bo()]).map(item => item.note), [ID], 'Bo\'s own note is still watched for');

        const [result] = h.reply('Cold.', '~ npc Bo | trust: -7').results;
        assert.equal(result.ok, true, JSON.stringify(result));
        assert.deepEqual(h.bonds().npc_ana, ana, 'Ana\'s entry is as it was');
        assert.equal(h.bonds().npc_bo.meters.trust, 3);
        assert.equal(h.adapter.meters('Bo').key, 'npc_bo');
        assert.equal(h.cast().find(item => item.name === 'Bo').key, 'npc_bo');
        showsNothingOpened(h, 'npc_bo', 'with an entry of his own');
    });

    test(`Ana ${state}, Bo's note opened: Ana's dossier shows nothing of his`, async () => {
        const h = await pair();
        for (let i = 0; i < 2; i += 1) h.reply('Warm.', '~ npc Bo | trust: +10');
        assert.deepEqual(h.bonds().npc_bo.unlocked, [ID]);
        assert.equal(h.bonds().npc_ana, undefined);
        if (change) await h.end(change);
        showsNothingOpened(h, 'npc_ana', 'before Ana has an entry');
        assert.equal(h.adapter.meters('Ana'), null);
        assert.equal(h.npc('Ana'), null);
        assert.equal(h.runQuery('npc.dossier', { name: 'Ana' })?.unlocked, undefined);
        assert.equal(h.adapter.sliceView([h.record('npc_ana')])[0].relationship.trust, 10);

        const his = structuredClone(h.bonds().npc_bo);
        h.reply('Memory.', '~ npc Ana | trust: -4');
        assert.deepEqual(h.bonds().npc_bo, his, '"~ npc Ana" never moves Bo');
        assert.equal(h.bonds().npc_ana.meters.trust, 6);
        showsNothingOpened(h, 'npc_ana', 'with an entry of her own');
    });
}

test('Ana\'s entry under an older key stays hers: Bo\'s alias reaches it on no path', async () => {
    const h = await pair();
    h.reply('Warm.', '~ npc Ana | trust: +10');
    // The same chat as an older one would hold it: her entry under a key that is no dossier's id.
    const people = structuredClone(h.store.head());
    const bonds = people.domains.people.bonds;
    bonds.npcs = { npc_old: bonds.npcs.npc_ana };
    const at = name => h.def.queries['npc.meters'](people, { name }, null);
    assert.equal(at('Bo'), null);
    assert.equal(at('Ana').key, 'npc_old');
    const cast = Object.fromEntries(h.def.queries['npc.cast'](people, {}, null).map(item => [item.name, item.key]));
    assert.deepEqual(cast, { Ana: 'npc_old', Bo: 'npc_bo' });
});

test('an older entry under no dossier\'s id, found by the person\'s own name, is still theirs on every path', async () => {
    const h = await pair();
    const state = structuredClone(h.store.head());
    state.domains.people.bonds = { npcs: { npc_older: { name: 'Bo', meters: { trust: 30 }, stages: {}, unlocked: [ID], milestones: {} } }, problems: [] };
    assert.equal(h.def.queries['npc.meters'](state, { name: 'Bo' }, null).key, 'npc_older');
    assert.equal(h.def.queries['npc.meters'](state, { id: 'npc_bo', name: 'Bo', aliases: ['Ana'] }, null).key, 'npc_older');
    assert.equal(h.def.queries['npc.cast'](state, {}, null).find(item => item.name === 'Bo').key, 'npc_older');
    assert.equal(h.def.queries['npc.meters'](state, { id: 'npc_ana', name: 'Ana', aliases: [] }, null), null);
});
