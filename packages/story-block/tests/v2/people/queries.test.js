// The people read queries answer from the head's stored slice alone: the list, one dossier, the ties and the secret owners; here, dormant, portraits (safe file
// paths only) and the meters from the bonds. They answer the head after a swipe and a delete because they read the store, never a cache.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';

const person = (id, name, extra = {}) => ({ id, name, ...extra });
const view = {
    v: 1, order: ['npc_ann', 'npc_bea', 'npc_cy', 'npc_dee', 'npc_old'],
    npcs: {
        npc_ann: person('npc_ann', 'Ann', { aliases: ['The Smith'], present: true, role: 'smith', mood: 'calm', location: 'the forge', secrets: [{ id: 's1', title: 'The Second Ledger', text: 'hidden' }] }),
        npc_bea: person('npc_bea', 'Bea', { followed: true, lastSeenTurn: 1, relationship: { trust: 4, affection: 1, desire: 0, tension: 0 } }),
        npc_cy: person('npc_cy', 'Cy', { lastSeenTurn: 1 }),
        npc_dee: person('npc_dee', 'Dee', { lastSeenTurn: 40, portrait: { path: '/user/files/dee.webp', type: 'image/webp', hash: 'h' } }),
        npc_old: person('npc_old', 'Old', { archived: true }),
    },
    candidates: [], dismissed: [], userDismissedGroups: [], turn: 40,
    socialGraph: { edges: [{ aId: 'npc_ann', bId: 'npc_bea', aToB: 'sister', bToA: 'sister' }, { aId: 'npc_ann', bId: 'npc_old', aToB: 'friend', bToA: '' }] },
    portraitAssets: { npc_ann: { path: '/user/files/ann.webp', type: 'image/webp', hash: 'a' }, npc_cy: { path: '//evil.example/x.png', type: 'image/png', hash: 'c' } },
};

async function rig(t) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost();
    t.after(() => host.close());
    await host.send('Go.', 'The road.');
    const s = host.store.sourceAt(host.store.headIndex());
    assert.equal((await host.sdk.command('people.write', { v: 1, source: { sid: s.sid, swipeKey: s.swipeKey }, view })).ok, true);
    return host;
}
const row = (host, name) => host.sdk.query('people.list', {}).find(item => item.name === name);

test('people.list: stored, not archived people in order, with here, followed, dormant, the bonds\' or the record\'s meters and a safe portrait', async t => {
    const host = await rig(t);
    const list = host.sdk.query('people.list', {});
    assert.deepEqual(list.map(item => item.name), ['Ann', 'Bea', 'Cy', 'Dee']);
    assert.equal(row(host, 'Ann').present, true);
    assert.equal(row(host, 'Ann').portrait, '/user/files/ann.webp');
    assert.equal(row(host, 'Bea').followed, true);
    assert.equal(row(host, 'Bea').dormant, false, 'followed people never go dormant');
    assert.equal(row(host, 'Cy').dormant, true, '39 replies unseen');
    assert.equal(row(host, 'Dee').dormant, false, 'seen at the head turn');
    assert.equal(row(host, 'Cy').portrait, null, 'a //host path is not a safe URL');
    assert.equal(row(host, 'Dee').portrait, '/user/files/dee.webp', 'the record\'s own file reference when there is no asset');
    assert.deepEqual(row(host, 'Bea').meters, { trust: 4, affection: 1, desire: 0, tension: 0 });
    assert.equal(row(host, 'Ann').meters, null);
});

test('people.dossier finds by id, name or alias; joins the bonds; leaves the portrait file out of the fields', async t => {
    const host = await rig(t);
    for (const args of [{ id: 'npc_ann' }, { name: 'ann' }, { name: 'the smith' }]) assert.equal(host.sdk.query('people.dossier', args).id, 'npc_ann', JSON.stringify(args));
    assert.equal(host.sdk.query('people.dossier', { name: 'Old' }), null, 'an archived person is not listed');
    assert.equal(host.sdk.query('people.dossier', { name: 'Nobody' }), null);
    const dossier = host.sdk.query('people.dossier', { id: 'npc_dee' });
    assert.equal(dossier.portrait, '/user/files/dee.webp');
    assert.equal(JSON.stringify(dossier).includes('"path"'), false);
    assert.equal(host.sdk.query('people.dossier', { id: 'npc_ann' }).role, 'smith');
});

test('people.dossier never carries a secret\'s text or a never-prompt setting', async t => {
    const host = await rig(t);
    const dossier = host.sdk.query('people.dossier', { id: 'npc_ann' });
    assert.deepEqual(dossier.secrets, [{ id: 's1', title: 'The Second Ledger' }]);
    assert.equal(JSON.stringify(dossier).includes('hidden'), false);
    for (const field of ['portraitPromptPositive', 'portraitSeed', 'meterSetup', 'castFrom']) assert.equal(field in dossier, false, field);
});

test('a portrait path is kept when it is a relative or root path or https, and refused otherwise', async t => {
    const host = await rig(t);
    const s = host.store.sourceAt(host.store.headIndex());
    const paths = { npc_ann: 'user/files/a.png', npc_bea: 'javascript:alert(1)', npc_cy: '?x', npc_dee: 'https://img.example/d.png' };
    const next = { ...view, npcs: Object.fromEntries(Object.entries(view.npcs).map(([id, record]) => [id, { ...record, portrait: undefined }])),
        portraitAssets: Object.fromEntries(Object.entries(paths).map(([id, path]) => [id, { path, type: 'image/png', hash: 'h' }])) };
    assert.equal((await host.sdk.command('people.write', { v: 1, source: { sid: s.sid, swipeKey: s.swipeKey }, view: JSON.parse(JSON.stringify(next)) })).ok, true);
    assert.deepEqual(['Ann', 'Bea', 'Cy', 'Dee'].map(name => row(host, name).portrait), ['user/files/a.png', null, null, 'https://img.example/d.png']);
});

test('people.ties lists the edges between stored active people; people.secretOwners names whose dossier holds a secret', async t => {
    const host = await rig(t);
    assert.deepEqual(host.sdk.query('people.ties', {}), [{ aId: 'npc_ann', bId: 'npc_bea', aToB: 'sister', bToA: 'sister' }]);
    assert.deepEqual(host.sdk.query('people.secretOwners', {}), { 'the second ledger': { id: 'npc_ann', name: 'Ann' }, s1: { id: 'npc_ann', name: 'Ann' } });
});

test('no people slice yet: every query answers null', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost();
    t.after(() => host.close());
    await host.send('Go.', 'The road.');
    for (const name of ['people.list', 'people.ties', 'people.secretOwners']) assert.equal(host.sdk.query(name, {}), null, name);
    assert.equal(host.sdk.query('people.dossier', { name: 'Ann' }), null);
});

test('the queries answer the head after a swipe, a swipe back and a middle delete', async t => {
    const host = await rig(t);
    await host.send('Next.', 'More road.');
    const s2 = host.store.sourceAt(host.store.headIndex());
    const more = { ...view, order: [...view.order, 'npc_eve'], npcs: { ...view.npcs, npc_eve: person('npc_eve', 'Eve', { present: true }) } };
    assert.equal((await host.sdk.command('people.write', { v: 1, source: { sid: s2.sid, swipeKey: s2.swipeKey }, view: more })).ok, true);
    assert.equal(row(host, 'Eve').present, true);
    await host.swipe('Other road.');
    await host.st.swipeTo(host.store.headIndex(), 0);
    assert.equal(row(host, 'Eve')?.present, true, 'swipe back');
    await host.st.deleteMessage(host.ctx.chat.length - 1);
    assert.equal(row(host, 'Eve'), undefined, 'the reply that stored Eve is gone');
    assert.equal(row(host, 'Ann').present, true);
});
