import test from 'node:test';
import { seedPeople } from './helpers/seed-people.js';
import assert from 'node:assert/strict';
import { createStorySuiteV2Adapter } from '../src/storysuite-v2.js';
import { DEFAULT_CHANGE_CAP, MAX_NPCS, meterDefs, validateNpcSlice } from '../src/npc-meters.js';
import { fakeRoot } from './helpers/fake-dom.js';
import { STAGES, fakeDelta, fakeDoc, host, timers } from './storysuite-v2-meters.helpers.js';

test('rollback via ops: swipes and deletes take meters back; replay equals rebuild', async () => {
    const h = await host({ settings: { stages: STAGES } });
    h.reply('One.', '~ npc Mira | trust: +10');
    const { index } = h.reply('Two.', '~ npc Mira | trust: +15');
    assert.equal(h.npc('Mira').meters.trust, 35);
    assert.equal(h.npc('Mira').stages.trust, 'Friend');
    h.swipe(index, '~ npc Mira | trust: -5');
    assert.equal(h.npc('Mira').meters.trust, 15);
    assert.equal(h.npc('Mira').stages.trust, undefined, 'the stage went back with the swipe');
    const before = JSON.stringify(h.store.head());
    h.store.rebuild();
    assert.equal(JSON.stringify(h.store.head()), before, 'replaying the stored ops gives the same state');
    h.remove(index);
    h.remove(index - 1);
    assert.equal(h.npc('Mira').meters.trust, 20);
    h.remove(h.chat.length - 1);
    h.remove(h.chat.length - 1);
    assert.equal(h.npc('Mira'), null, 'deleting the first reply takes the entry away');
});

test('rapid swipes: each swipe keeps its own meters, the cap window included', async () => {
    const h = await host();
    h.reply('One.', '~ npc Mira | trust: +5');
    const { index } = h.reply('Two.', '~ npc Mira | trust: +15');
    const expected = [30];
    for (let n = 1; n <= 12; n += 1) {
        // Each swipe asks for more than the cap; it can only ever move 15 from where the reply started.
        h.swipe(index, `~ npc Mira | trust: +${n * 3}\n~ npc Mira | trust: +${n * 3}`);
        expected.push(15 + Math.min(DEFAULT_CHANGE_CAP, n * 6));
        assert.equal(h.npc('Mira').meters.trust, expected[n], `swipe ${n}`);
    }
    for (let n = 12; n >= 0; n -= 1) {
        h.swipeTo(index, n);
        assert.equal(h.npc('Mira').meters.trust, expected[n], `back to swipe ${n}`);
    }
    const head = JSON.stringify(h.store.head());
    h.store.rebuild();
    assert.equal(JSON.stringify(h.store.head()), head);
});

test('Delta\'s own scan forwards are background changes; the reader\'s sends are not', async () => {
    const h = await host();
    await h.adapter.adjust({ name: 'Oren', meters: { trust: 3 }, start: { trust: 0, affection: 0, desire: 0, tension: 0 }, reply: 0 });
    await h.adapter.setMeters({ name: 'Oren', meters: { trust: 1 } });
    await h.adapter.refresh('Oren');
    assert.deepEqual(h.sent.map(item => [item.type, item.options.background === true]), [['npc.adjust', true], ['npc.set', false], ['npc.refresh', false]]);
    assert.equal(h.sent[0].options.cause, undefined, 'still the reader-level cause: background only says when to save');
});

test('a Story Block that ignores the command options still takes the forwards', async () => {
    const h = await host();
    const seen = [];
    const original = h.box.host.sdk.command;
    // an older Story Block: command(type, payload) only, a third argument is never looked at
    h.box.host.sdk.command = async function (type, payload) { seen.push(arguments.length); return original(type, payload); };
    const out = await h.adapter.adjust({ name: 'Oren', meters: { trust: 3 }, start: { trust: 0, affection: 0, desire: 0, tension: 0 }, reply: 0 });
    assert.equal(out.ok, true);
    assert.deepEqual(h.npc('Oren').meters.trust, 3);
    assert.deepEqual(seen, [3], 'the option is passed; the old command ignores it and applies the change');
});

test('Delta\'s scanner path: npc.adjust from the adapter, seeded from the dossier, with the same clamps', async () => {
    const h = await host();
    const out = await h.adapter.adjust({ name: 'Oren', meters: { trust: 3, tension: 40 }, start: { trust: -5, affection: 2, desire: 0, tension: 1 }, reply: 0 });
    assert.equal(out.ok, true);
    assert.deepEqual(h.npc('Oren').meters, { trust: -2, affection: 2, desire: 0, tension: 16 });
    assert.equal(out.receipt.cause, 'ui', 'Delta\'s own action: the host keeps story and system causes for itself');
    assert.equal(out.receipt.narrate, false, 'the reply already told it');
    assert.deepEqual(h.sent.map(item => item.type), ['npc.adjust']);
    assert.equal(h.sent[0].options.cause, undefined);
});

// (NSD r2) npc.adjust is the scanner's and other modules': a button, screen or pack that names it at
// the top (cause ui, no calling module) is refused and nothing is saved, as the host's own steps are.
test('npc.adjust from a button is refused and saves nothing; another module\'s command may send it', async () => {
    const h = await host();
    const rev = h.store.head().meta?.rev;
    const before = structuredClone(h.store.head().domains.people?.bonds);
    const out = await h.sdk.command('npc.adjust', { name: 'Oren', meters: { trust: 50 }, reply: 7 });
    assert.equal(out.ok, false);
    assert.equal(out.code, 'REFUSED');
    assert.deepEqual(h.store.head().domains.people?.bonds, before, 'nothing saved');
    assert.equal(h.store.head().meta?.rev, rev);
    // The same payload through another module's command (ctx.call sets ctx.caller).
    h.registry.register({
        id: 'zz-nudge', name: 'Nudge',
        commands: { 'zz.nudge': (ctx, payload) => { ctx.call('npc.adjust', payload); return { summary: 'nudged' }; } },
    });
    const called = await h.sdk.command('zz.nudge', { name: 'Oren', meters: { trust: 3 }, reply: 0 });
    assert.equal(called.ok, true, JSON.stringify(called));
    assert.equal(h.npc('Oren').meters.trust, -2);
    // Delta's own scanner (the adapter) still gets through; a copy sent after it has finished does not.
    const own = await h.adapter.adjust({ name: 'Oren', meters: { trust: 2 }, reply: 0 });
    assert.equal(own.ok, true);
    assert.equal(h.npc('Oren').meters.trust, 0);
    const replayed = await h.sdk.command('npc.adjust', { name: 'Oren', meters: { trust: 2 }, reply: 0 });
    assert.equal(replayed.code, 'REFUSED', 'the adapter\'s pass is for its own send only');
    assert.equal(h.npc('Oren').meters.trust, 0);
});

test('npc.set from the UI ignores a caller-chosen reply: the window starts at the latest reply', async () => {
    let latest = 0;
    const h = await host({ settings: { changeCap: 5 }, headReply: () => latest });
    h.reply('Warm.', '~ npc Mira | trust: +5');
    latest = 2;
    assert.equal(h.npc('Mira').reply, 2);
    // A pack button names an old reply to reopen its window; the editor's own value starts reply 2's.
    const set = await h.sdk.command('npc.set', { name: 'Mira', meters: { trust: 40 }, reply: 0 });
    assert.equal(set.ok, true);
    assert.equal(h.npc('Mira').reply, 2, 'the latest reply, not the payload\'s');
    assert.equal(h.npc('Mira').meters.trust, 40);
    // The scanner's change on reply 2 is held within the cap of the reader's value.
    await h.adapter.adjust({ name: 'Mira', meters: { trust: 30 }, reply: 2 });
    assert.equal(h.npc('Mira').meters.trust, 45);
    // Without a latest reply the reader's value ends the window instead.
    latest = null;
    await h.sdk.command('npc.set', { name: 'Mira', meters: { trust: 10 }, reply: 2 });
    assert.equal(h.npc('Mira').reply, undefined);
    // The adapter's editor path sends no reply of its own.
    latest = 2;
    await h.adapter.setMeters({ name: 'Mira', meters: { trust: 12 }, reply: 0 });
    assert.equal(h.sent.at(-1).type, 'npc.set');
    assert.equal('reply' in h.sent.at(-1).payload, false);
    assert.equal(h.npc('Mira').reply, 2);
});

test('the definition asks for Story Block 2.31.1 or later', async () => {
    const h = await host();
    assert.deepEqual(h.def.requires, { storyBlock: '>=2.31.1' });
});

test('the slice is the truth while hosted: npc.dossier, npc.present and sliceView read it', async () => {
    const h = await host();
    h.reply('Warm.', '~ npc Mira | trust: +15 | desire: +2');
    const dossier = h.runQuery('npc.dossier', { name: 'The Smith' });
    assert.deepEqual(dossier.relationship, { trust: 25, affection: 0, desire: 2, tension: 0 });
    assert.deepEqual(dossier.unlocked, []);
    assert.equal('secrets' in dossier, false);
    assert.deepEqual(h.runQuery('npc.present'), ['Mira'], 'names, as before');
    assert.deepEqual(h.runQuery('npc.present', { meters: true }), [{ name: 'Mira', meters: { trust: 25, affection: 0, desire: 2, tension: 0 }, stages: {} }]);
    const records = Object.values(h.delta.records);
    const view = h.adapter.sliceView(records);
    assert.notEqual(view, records);
    assert.deepEqual(view[0].relationship, { trust: 25, affection: 0, desire: 2, tension: 0 });
    assert.equal(records[0].relationship.trust, 10, 'Delta\'s own records are not changed');
    assert.equal(view[1], records[1], 'an NPC with no entry is passed through');
    assert.equal(h.adapter.meters('The Smith').meters.trust, 25);
});

test('validation: the 81st NPC is refused and nothing is saved; a bad slice is refused', async () => {
    const h = await host();
    const block = Array.from({ length: MAX_NPCS }, (_, i) => `+ npc Guard ${i + 1} | trust: +1`).join('\n');
    h.reply('A crowd.', block);
    assert.equal(Object.keys(h.store.head().domains.people.bonds.npcs).length, MAX_NPCS);
    const rev = h.store.head().meta.rev;
    const { results } = h.reply('One more.', '+ npc Guard 81 | trust: +1');
    assert.equal(results[0].ok, false);
    assert.equal(results[0].code, 'REFUSED');
    assert.equal(h.store.head().meta.rev, rev, 'nothing saved');
    assert.ok(validateNpcSlice({ npcs: { Bad: { name: 'x', meters: {}, stages: {}, unlocked: [] } }, problems: [] }).length > 0);
    assert.ok(validateNpcSlice({ npcs: { npc_a: { name: 'A', meters: { trust: 1.5 }, stages: {}, unlocked: [] } }, problems: [] }).length > 0);
    assert.ok(validateNpcSlice({ npcs: { npc_a: { name: 'A', meters: { trust: 5000 }, stages: {}, unlocked: [] } }, problems: [] }).length > 0);
    assert.ok(validateNpcSlice({ npcs: { npc_a: { name: 'A', meters: {}, stages: {}, unlocked: ['x', 'x'] } }, problems: [] }).length > 0);
    assert.ok(validateNpcSlice({ npcs: { npc_a: { name: 'A', meters: {}, stages: {}, unlocked: [], secret: 'no' } }, problems: [] }).length > 0, 'no stray fields (a note text could not hide here)');
});

// ---- the host goes away ----

test('host lost mid-reply: Delta stops sending, its views pass through, the host\'s own capture still finishes', async () => {
    const h = await host();
    const { index } = h.reply('Warm.', '~ npc Mira | trust: +5');
    const pending = h.adapter.adjust({ name: 'Mira', meters: { trust: 2 }, reply: index });
    h.box.host = undefined;
    assert.equal(h.adapter.check(), false, 'the host is gone');
    assert.equal(h.adapter.hosted(), false);
    await pending;
    assert.equal(await h.adapter.adjust({ name: 'Mira', meters: { trust: 2 }, reply: index }), null, 'nothing is sent without a host');
    assert.equal(await h.adapter.setMeters({ name: 'Mira', meters: { trust: 2 } }), null);
    assert.equal(await h.adapter.refresh('Mira'), null);
    assert.equal(h.adapter.meters('Mira'), null);
    const records = Object.values(h.delta.records);
    assert.equal(h.adapter.sliceView(records), records, 'the same array: v1 numbers');
    // The old host finishing that reply's capture does not throw (its definition still answers).
    const late = h.capture(index, '~ npc Mira | trust: +1 | charm: +2');
    assert.equal(late[0].ok, true);
    assert.equal(h.npc('Mira').meters.trust, 16, 'the story\'s +5 and +1 only: the scan\'s +2 left trust to the story line (RT2)');
    assert.deepEqual(h.sent.map(item => item.type), ['npc.adjust']);
    h.adapter.stop();
});

test('without a host the adapter changes nothing and sends nothing', async () => {
    const delta = fakeDelta();
    const calls = [];
    const adapter = createStorySuiteV2Adapter({
        suiteApi: delta.suiteApi, delta: () => delta.api, host: () => undefined, doc: fakeDoc(), timers,
        logger: { warn: (...args) => calls.push(args) },
    });
    adapter.start();
    const records = Object.values(delta.records);
    assert.equal(adapter.sliceView(records), records);
    assert.equal(await adapter.adjust({ name: 'Mira', meters: { trust: 1 } }), null);
    assert.equal(await adapter.setMeters({ name: 'Mira', meters: { trust: 1 } }), null);
    assert.equal(adapter.meters('Mira'), null);
    assert.deepEqual(calls, []);
    assert.deepEqual(meterDefs({}).map(def => def.id), ['trust', 'affection', 'desire', 'tension']);
    adapter.stop();
});

test('the Dossiers tab (once Cast) shows a meter bar per shown meter for the present NPCs, escaped', async () => {
    const h = await host({ settings: { stages: STAGES, customMeters: [{ name: 'Lust', show: 'bar' }, { name: 'Secretive', show: 'hidden' }] } });
    h.reply('Warm.', '~ npc Mira | trust: +12 | lust: +3\n~ npc Oren | trust: +1\n+ npc <b>Bold</b> | trust: +1');
    h.delta.records.npc_bold = { id: 'npc_bold', name: '<b>Bold</b>', aliases: [], present: true, archived: false, relationship: {} };
    await seedPeople(h.sdk, h.store, h.delta.records);   // Bold's new dossier is stored too (npc.cast lists the store's people)
    const el = fakeRoot();
    h.def.tabs[0].render(el);
    // The present cast and its meters, before the dossier list (which names everyone, Oren too).
    const html = el.innerHTML.split('npc-state-delta-v2-dossiers')[0];
    assert.match(el.innerHTML, /npc-state-delta-v2-dossiers/, 'the dossier list under them');
    assert.match(html, /<section class="npc-state-delta-present-roster">cast<\/section>/, 'Delta\'s own cards first');
    const bars = html.match(/role="meter"/g) ?? [];
    assert.equal(bars.length, 10, 'five bars each for Mira and Bold; Oren is not present; the hidden meter has none');
    assert.match(html, /aria-label="Trust" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="22" aria-valuetext="22 · Friend"/);
    assert.match(html, /<h4>&lt;b&gt;Bold&lt;\/b&gt;<\/h4>/);
    assert.doesNotMatch(html, /<b>Bold/);
    assert.doesNotMatch(html, /Oren/);
    h.delta.enabled = false;
    h.def.tabs[0].render(el);
    assert.doesNotMatch(el.innerHTML, /role="meter"/, 'nothing while Delta is off');
});
