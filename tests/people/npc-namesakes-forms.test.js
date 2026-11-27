// Name "Nickname", as the people list shows a namesake, is that person wherever it comes back: a "+ npc" line (also after one of them dies), a scan's rows
// and a scene's list. A scene entry that is any alias only one of them holds settles a shared name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyScenePresence, createNpcRecord, mergeScanResult } from '../../modules/people/core/core.js';
import { applyScenePresence as sceneOnly, mergeScanResult as mergeOnly } from '../../modules/people/core/core-mechanics.js';
import { settleScanRows } from '../../modules/people/core/core-merge-namesakes.js';
import { stampScenePresence } from '../../modules/people/calls/hosted-presence.js';
import { ownerTargets } from '../../modules/people/npc-api/dossier-target.js';
import { cast, person } from './npc-alias-lines.helpers.js';

const OLD = 'Guard "the gate guard"';
const NORTH = 'Guard "Guard from the North Gate"';
const guard = (id, aliases, extra = {}) => person(id, 'Guard', aliases, { role: 'guard', present: false, ...extra });
// (the two automatic nicknames overlap: each one's words are in the other)
const pair = () => [guard('npc_g1', ['the gate guard']), guard('npc_g2', ['Guard from the North Gate'], { present: true })];
const ids = h => Object.keys(h.store.head().domains.people.npcs);

for (const dies of [null, 'npc_g1', 'npc_g2']) {
    test(`"+ npc" with a shown form makes nobody${dies ? ` (after ${dies} died)` : ''}`, async () => {
        const h = await cast(...pair());
        if (dies) await h.die(dies);
        for (const form of [OLD, NORTH]) {
            assert.equal(h.refused(`+ npc ${form} | guard | tall`).message, `${form} is already listed as Guard; + npc is only for someone new.`);
        }
        assert.deepEqual(ids(h), ['npc_g1', 'npc_g2']);
        assert.deepEqual(Object.keys(h.bonds()), []);
    });
}

test('after the other dies, the survivor\'s shown form still finds that one and no other', async () => {
    for (const [dies, form, lives] of [['npc_g2', OLD, 'npc_g1'], ['npc_g1', NORTH, 'npc_g2']]) {
        const h = await cast(...pair());
        await h.die(dies);
        h.line(`~ npc ${form} | trust: +5`);
        assert.deepEqual(Object.keys(h.bonds()), [lives]);
    }
});

test('a nickname nobody of a shared name has is refused, never made a dossier', async () => {
    const h = await cast(...pair());
    assert.match(h.refused('+ npc Guard "the tall one" | guard | tall').message, /^Two people are called Guard; write /);
    assert.deepEqual(ids(h), ['npc_g1', 'npc_g2']);
});

const record = (id, aliases, extra = {}) => ({ ...createNpcRecord('Guard', []), id, aliases, role: 'guard', ...extra });
const stored = (extra = [{}, { present: true }]) => ({ npcs: [record('npc_g1', ['the gate guard'], extra[0]), record('npc_g2', ['Guard from the North Gate'], extra[1])], candidates: [], turn: 3 });
const moods = npcs => npcs.map(npc => [npc.id, npc.mood || '', npc.present]);
const row = (name, extra = {}) => ({ name, mood: 'wary', present: true, dossierSignal: 'persistent', ...extra });

for (const [what, merge] of [['the whole merge', mergeScanResult], ['the inner merge', mergeOnly]]) {
    test(`scan rows (${what}): the shown form is that person; the plain name is the one present`, () => {
        for (const [name, who] of [[OLD, 'npc_g1'], [NORTH, 'npc_g2'], ['Guard', 'npc_g2']]) {
            const out = merge(stored(), { npcs: [row(name)] }, { turn: 4 });
            assert.deepEqual(out.state.npcs.map(npc => npc.name), ['Guard', 'Guard'], name);
            assert.deepEqual(out.state.candidates, [], name);
            assert.deepEqual(Object.fromEntries(out.state.npcs.map(npc => [npc.id, [npc.mood || '', npc.present]])),
                { npc_g1: who === 'npc_g1' ? ['wary', true] : ['', false], npc_g2: who === 'npc_g2' ? ['wary', true] : ['', false] }, name);
            assert.ok(out.state.npcs.every(npc => !npc.aliases.some(alias => alias.includes('"'))), name);
        }
    });

    test(`scan rows (${what}): the plain name with none or both present is skipped`, () => {
        for (const present of [false, true]) {
            const before = stored([{ present }, { present }]);
            const out = merge(structuredClone(before), { npcs: [row('Guard')] }, { turn: 4 });
            assert.equal(out.state.npcs.length, 2);
            assert.deepEqual(out.state.candidates, []);
            assert.deepEqual(moods(out.state.npcs).map(item => item[1]), ['', '']);
            assert.deepEqual(out.report.skipped, ['Guard']);
        }
    });
}

test('scan rows follow the scene\'s list, which settles it when the stored flags are cleared (the live scan)', () => {
    const cleared = stored([{}, {}]).npcs;
    const { scanResult, skipped } = settleScanRows(cleared, { npcs: [row('Guard')], profileUpdates: [{ name: OLD }] }, ['the gate guard']);
    assert.deepEqual([scanResult.npcs[0].id, scanResult.profileUpdates[0].id, skipped], ['npc_g1', 'npc_g1', []]);
    assert.deepEqual(settleScanRows(cleared, { npcs: [row('Guard')] }, ['Mira']).skipped, ['Guard']);
});

test('rows once settled, as the capture journal keeps them, stay with that person when a replay has no scene and other stored presence', () => {
    const live = settleScanRows(stored([{}, {}]).npcs, { npcs: [row('Guard'), row('Guard', { aliases: ['nobody'] })] }, ['the gate guard']).scanResult;
    const kept = JSON.parse(JSON.stringify(live));
    assert.deepEqual(settleScanRows(stored().npcs, kept, []).scanResult.npcs.map(item => item.id), ['npc_g1', 'npc_g1']);
});

test('scan rows about unique names or namesakes without nicknames are handed on untouched', () => {
    for (const npcs of [[record('npc_g1', []), record('npc_g2', [])], [record('npc_g1', ['the gate guard']), record('npc_g2', [])], [{ ...record('npc_t', ['Bull']), name: 'Tom' }]]) {
        const scan = { npcs: [row('Guard'), row('Tom'), row('Tom "Bull"'), row('Bull', { id: 'npc_t' })] };
        assert.equal(settleScanRows(npcs, scan, []).scanResult, scan);
    }
});

test('scene presence: the shown form is that person; the plain name goes to the one present, else nobody', () => {
    for (const apply of [applyScenePresence, sceneOnly].filter(Boolean)) {
        const shown = stored([{}, {}]).npcs;
        apply(shown, { present: [OLD] });
        assert.deepEqual(shown.map(npc => npc.present), [true, false]);
        const one = stored().npcs;
        apply(one, { present: ['Guard'] });
        assert.deepEqual(one.map(npc => npc.present), [false, true]);
        const gone = stored().npcs;
        apply(gone, { present: [], offscreen: ['Guard'] });
        assert.deepEqual(gone.map(npc => npc.present), [false, false]);
        const none = stored([{}, {}]).npcs;
        assert.deepEqual(apply(none, { present: ['Guard'] }), { cleared: [], added: [] });
    }
    const old = [record('npc_g1', []), record('npc_g2', [])];
    sceneOnly(old, { present: ['Guard'] });
    assert.deepEqual(old.map(npc => npc.present), [true, true], 'without nicknames, as before');
});

test('the hosted presence stamp reads the scene the same way', () => {
    assert.deepEqual(stampScenePresence(stored(), ['Guard']), ['npc_g2']);
    assert.deepEqual(stampScenePresence(stored(), [OLD]), ['npc_g1']);
    assert.deepEqual(stampScenePresence(stored([{}, {}]), ['Guard']), []);
});

// (the expected values are what the code before the namesakes work answered)
test('a unique name written in quotes is no shown form: presence reads it as before', () => {
    const tom = () => [{ ...record('npc_t', ['Bull']), name: 'Tom', present: true }];
    assert.equal(ownerTargets(tom())('Tom "Bull"'), '');
    assert.deepEqual(stampScenePresence({ npcs: tom(), turn: 1 }, ['Tom "Bull"']), []);
});

test('a scene entry that is any alias only one of them has settles the shared name', async () => {
    const h = await cast(guard('npc_g1', ['Old Tom', 'Tommy']), guard('npc_g2', ['Bo']));
    h.registry.register({ id: 'test-scene', name: 'Scene', queries: { 'scene.present': () => ['Tommy'] } });
    h.line('~ npc Guard | trust: +1');
    assert.deepEqual(Object.keys(h.bonds()), ['npc_g1']);
});
