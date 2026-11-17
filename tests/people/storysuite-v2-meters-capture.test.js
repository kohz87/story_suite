import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_ID, meterBarNode } from '../../modules/people/storysuite-v2.js';
import { DEFAULT_CHANGE_CAP, MAX_CUSTOM_METERS, normalizeMeterSettings, npcKey, parseMeterValue, stageAt, validateNpcSlice } from '../../modules/people/meters/npc-meters.js';
import { METERS_CARD_ID, metersCardScreen } from '../../modules/people/meters/npc-meters-screen.js';
import { fakeDocument } from './helpers/fake-dom.js';
import { CHANGED, changedHelper } from '../../ui/legacy/view/bind-parts/scope-shared.js';
import { STAGES, fakeDelta, host, plain } from './storysuite-v2-meters.helpers.js';

test('the real registry accepts the definition: meters in the people domain, npc kind, commands, queries, the NPC card screen', async () => {
    const h = await host();
    assert.equal(h.registry.domainOwner('npc'), null, 'no domain of its own: the meters are the people domain\'s bonds');
    assert.equal(h.registry.domainOwner('people'), 'story-block');
    assert.equal(h.registry.captureOwner('npc'), MODULE_ID);
    for (const type of ['npc.adjust', 'npc.set', 'npc.refresh']) assert.equal(h.registry.commandOwner(type), MODULE_ID);
    assert.deepEqual(Object.keys(h.store.head().domains.people?.bonds?.npcs ?? {}), [], 'no meters before the first change (a dossier write lays down only the empty bonds)');
    assert.equal(h.def.screens[0].id, METERS_CARD_ID);
    assert.deepEqual(metersCardScreen.mounts, ['card']);
    assert.match(metersCardScreen.template, /<ss-widget name="ss\.meter" data-props='\{"bind":"b"\}'><\/ss-widget>/, 'one ss.meter per bar');
    assert.match(metersCardScreen.template, /changed\(state\.people\.bonds\.npcs\[n\.key\]\)/, 'the card reads the meters where the store keeps them (people.bonds)');
    // The card's changed(...) finds a reply's bonds ops for that person, and only theirs.
    const scope = { n: { key: 'npc_mira' }, [CHANGED]: new Set(['/domains/people/bonds/npcs/npc_mira/meters/trust']) };
    assert.equal(changedHelper(scope)('state.people.bonds.npcs[n.key]'), true);
    assert.equal(changedHelper({ ...scope, n: { key: 'npc_oren' } })('state.people.bonds.npcs[n.key]'), false);
});

// ---- capture ----

test('capture: relative and absolute values, clamped to the range and to the per-reply cap', async () => {
    const h = await host();
    h.reply('Mira laughs.', '<Changes>\n~ npc Mira | trust: +5 | affection: =12\n</Changes>');
    assert.deepEqual(h.npc('Mira').meters, { trust: 15, affection: 12, desire: 0, tension: 0 }, 'a known NPC starts from her dossier (trust 10)');
    h.reply('Mira beams.', '~ npc Mira | trust: +90');
    assert.equal(h.npc('Mira').meters.trust, 15 + DEFAULT_CHANGE_CAP, 'held at the per-reply cap');
    h.reply('Mira beams.', '~ npc Mira | trust: 100');
    assert.equal(h.npc('Mira').meters.trust, 30 + DEFAULT_CHANGE_CAP, 'an absolute value is capped too');
    for (let i = 0; i < 6; i += 1) h.reply('Again.', '~ npc Mira | trust: +15');
    assert.equal(h.npc('Mira').meters.trust, 100, 'never above the range');
    for (let i = 0; i < 20; i += 1) h.reply('Down.', '~ npc Mira | trust: -15');
    assert.equal(h.npc('Mira').meters.trust, -100, 'never below it');
});

test('capture: two lines in one reply share the cap; the next reply starts a new window', async () => {
    const h = await host();
    const { index } = h.reply('Twice.', '~ npc Oren | tension: +10\n~ npc Oren | tension: +10');
    assert.equal(h.npc('Oren').meters.tension, 1 + DEFAULT_CHANGE_CAP);
    // Delta's scanner on the same reply is held by the same window.
    await h.adapter.adjust({ name: 'Oren', meters: { tension: 8 }, reply: index });
    assert.equal(h.npc('Oren').meters.tension, 1 + DEFAULT_CHANGE_CAP);
    h.reply('Once more.', '~ npc Oren | tension: +10');
    assert.equal(h.npc('Oren').meters.tension, 26);
});

test('capture: huge and malformed values are problems, not numbers', async () => {
    const h = await host();
    const block = ['~ npc Mira | trust: +99999', '~ npc Mira | trust: 1e9', '~ npc Mira | trust: Infinity', '~ npc Mira | trust: NaN', '~ npc Mira | trust: 1.5', '~ npc Mira | trust: lots'].join('\n');
    const { results } = h.reply('Wild.', block);
    assert.ok(results.every(result => result.ok === false && result.code === 'REFUSED'), 'each line names no usable change');
    assert.equal(h.npc('Mira'), null, 'nothing was saved');
    assert.equal(h.store.head().meta.rev, 1, 'only the fixture\'s people write (rev 1) is stored');
    assert.equal(h.problems.length, 6);
    for (const raw of ['+99999', '1e9', 'Infinity', 'NaN', '1.5', 'lots', '', '+', '=']) assert.equal(parseMeterValue(raw), null, raw);
    // A huge number sent by a command is refused as a meter value, and the range holds anyway.
    const out = await h.sdk.command('npc.adjust', { name: 'Mira', meters: { trust: 1e12 } });
    assert.equal(out.ok, false);
    await h.sdk.command('npc.set', { name: 'Mira', meters: { trust: 1999 } });
    assert.equal(h.npc('Mira').meters.trust, 100);
    await h.sdk.command('npc.set', { name: 'Mira', meters: { trust: -1999 } });
    assert.equal(h.npc('Mira').meters.trust, -100);
});

test('capture: unknown meters are problems on the slice and the receipt; known ones still apply; a stage label is ignored', async () => {
    const h = await host();
    const { results } = h.reply('Hm.', '~ npc Mira | trust: +2 | charm: +4 | stage: Lover | reason: she was helped');
    assert.equal(results[0].ok, true);
    assert.equal(h.npc('Mira').meters.trust, 12);
    assert.deepEqual(h.npc('Mira').stages, {});
    const problems = h.store.head().domains.people.bonds.problems.map(item => item.text);
    assert.equal(problems.length, 2);
    assert.match(problems[0], /"charm" is not a meter/);
    assert.match(problems[1], /Stages are set by code/);
    assert.deepEqual(results[0].receipt.data.problems, problems);
    const only = h.reply('Hm.', '~ npc Mira | charm: +4');
    assert.equal(only.results[0].ok, false, 'a line with no usable meter is refused: a host Problem');
    assert.match(only.results[0].message, /"charm" is not a meter/);
});

test('capture: someone Delta does not know gets an entry keyed by name, from the base values', async () => {
    const delta = fakeDelta();
    delta.baseline = { trust: 5, affection: 0, desire: 0, tension: 0 };
    const h = await host({ delta });
    h.reply('A stranger.', '+ npc Captain Ilse Vorn | trust: +3');
    const entry = h.npc('Captain Ilse Vorn');
    assert.equal(entry.key, 'npc_captain-ilse-vorn', 'keyed by the id Delta would give her dossier');
    assert.equal(entry.meters.trust, 8);
    assert.equal(delta.records.npc_ilse, undefined, 'Delta\'s own dossiers are not touched');
    h.reply('Again.', '~ npc captain ilse vorn | trust: +1');
    assert.equal(h.npc('Captain Ilse Vorn').meters.trust, 9, 'the same entry by name, whatever the case');
    // An alias of a dossier finds the dossier's entry.
    h.reply('Smith.', '~ npc The Smith | affection: +4');
    assert.deepEqual(Object.keys(h.store.head().domains.people.bonds.npcs).sort(), ['npc_captain-ilse-vorn', 'npc_mira']);
    assert.equal(h.npc('Mira').meters.affection, 4);
});

test('hostile NPC and meter names never reach prototypes, keys or markup', async () => {
    const h = await host({ settings: { customMeters: [
        { name: '__proto__', min: 0, max: 10 }, { name: 'constructor' }, { name: 'prototype' }, { name: 'trust' }, { name: 'stage' },
        { name: '<img src=x onerror=alert(1)>', min: 0, max: 50 }, { name: 'Lust', min: 0, max: 100, start: 10 }, { name: 'lust' },
        { name: 'x'.repeat(500) }, { name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' },
    ] } });
    const custom = normalizeMeterSettings(h.sdk.settings(MODULE_ID)).custom;
    assert.equal(custom.length, MAX_CUSTOM_METERS);
    // `__proto__` reads as the word "proto": a plain meter id, never a key of the prototype.
    assert.deepEqual(custom.map(def => def.id), ['proto', 'img-src-x-onerror-alert-1', 'lust', 'x'.repeat(40), 'a', 'b']);
    const block = [
        '~ npc __proto__ | trust: +1',
        '~ npc constructor | __proto__: +5 | constructor: =9 | trust: +1',
        // The shared grammar reads only word labels; the same meter written in words is found by its id.
        '~ npc <img src=x onerror=alert(1)> | img src x onerror alert 1: +7',
        '~ npc Mira | lust: +3',
    ].join('\n');
    const { results } = h.reply('Strange guests.', block);
    assert.ok(results.every(result => result.ok), JSON.stringify(results.map(result => result.message)));
    const npcs = h.store.head().domains.people.bonds.npcs;
    assert.deepEqual(Object.keys(npcs).sort(), ['npc_constructor', 'npc_img-src-x-onerror-alert-1', 'npc_mira', 'npc_proto']);
    assert.equal(Object.getPrototypeOf(npcs), Object.prototype);
    assert.equal({}.trust, undefined, 'no prototype pollution');
    assert.equal(Object.prototype.constructor, Object);
    assert.equal(npcs['npc_img-src-x-onerror-alert-1'].meters['img-src-x-onerror-alert-1'], 7);
    assert.equal(npcs.npc_constructor.meters.proto, 5);
    assert.deepEqual(h.store.head().domains.people.bonds.problems.map(item => item.text), ['"constructor" is not a meter (meters: trust, affection, desire, tension, proto, img-src-x-onerror-alert-1, lust, xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx, a, b).']);
    assert.equal(npcs.npc_mira.meters.lust, 13, 'a custom meter starts at its own start');
    assert.deepEqual(validateNpcSlice(h.store.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
    // Markup: names and labels are escaped in the Cast tab bars.
    const bar = meterBarNode(fakeDocument(), { id: '<b>', label: '<img src=x onerror=alert(1)>', min: 0, max: 50, tone: '"><script>' }, 7, '<i>stage</i>').serialize();
    assert.doesNotMatch(bar, /<img|<script|<i>|<b>/);
    assert.match(bar, /ss-w-tone-neutral/, 'a tone outside the list is neutral');
    assert.match(bar, /--ss-w-ratio: 0\.14/);
    assert.equal(npcKey('__proto__'), 'proto');
    assert.equal(npcKey('constructor'), 'constructor-npc');
    assert.equal(npcKey('   '), null);
});

test('custom meters: their own range and start, a bar each, kept in the static line', async () => {
    const h = await host({ settings: { customMeters: [{ name: 'Lust', min: 0, max: 100, start: 0, show: 'bar' }, { name: 'Respect Level', min: -50, max: 50, start: 5, show: 'hidden' }] } });
    h.reply('Heat.', '~ npc Mira | lust: +3 | respect level: -60');
    assert.equal(h.npc('Mira').meters.lust, 3);
    assert.equal(h.npc('Mira').meters['respect-level'], -10, 'the cap holds a custom meter too');
    const cast = h.runQuery('npc.cast');
    assert.deepEqual(cast[0].bars.map(bar => bar.id), ['trust', 'affection', 'desire', 'tension', 'lust'], 'a hidden meter has no bar');
    assert.deepEqual(cast[0].bars.find(bar => bar.id === 'lust'), { id: 'lust', label: 'Lust', value: 3, min: 0, max: 100, stage: '', tone: 'neutral', text: '3', delta: 3 });
    assert.deepEqual(cast[0].still.find(bar => bar.id === 'lust'), { id: 'lust', label: 'Lust', value: 3, min: 0, max: 100, stage: '', tone: 'neutral', text: '3' }, 'still: the same bar without the change');
    // (The anti-lever sentence is on by default and tested in relationship-pacing.test.js; the line without it is what is pinned here.)
    // N7: the static line is the one NSD2 paragraph; custom meters add no text (code enforces their ranges, G2).
    assert.ok(h.def.context.static().startsWith('Relationships: when the scene changes how someone feels about {{user}}'));
    // A row just added in the overlay (empty name, zero range) is left out; an upside-down range reads 0..100.
    const odd = normalizeMeterSettings({ customMeters: [{ name: '', min: 0, max: 0 }, { name: 'Odd', min: 50, max: -50, start: 999 }] }).custom;
    assert.deepEqual(odd.map(({ id, min, max, start }) => ({ id, min, max, start })), [{ id: 'odd', min: 0, max: 100, start: 100 }]);
});

// ---- the prompt ----

test('the static part is byte-identical across replies and changes only with the settings', async () => {
    const h = await host({ settings: { stages: STAGES } });
    const first = h.def.context.static();
    h.reply('One.', '~ npc Mira | trust: +15');
    h.reply('Two.', '~ npc Oren | tension: +4');
    assert.equal(h.def.context.static(), first);
    assert.doesNotMatch(first, /Mira|Oren|Friend|\d{2,} a reply.*\d/, 'no names or stage names');
    h.setSettings({ stages: STAGES, changeCap: 10, customMeters: [{ name: 'Lust' }] });
    assert.equal(h.def.context.static(), first, 'settings that add no text leave the static text as it was');
    assert.doesNotMatch(h.def.context.static(), /lust|\(0\.\.100\)/, 'a custom meter adds no text (G2)');
    assert.doesNotMatch(h.def.context.static(), /at most 10/, 'the change cap adds no text (G2)');
    h.delta.enabled = false;
    assert.equal(h.def.context.static(), '', 'nothing while Delta is off');
});

test('the tail: present NPCs\' meters only when they moved lately, compactly', async () => {
    const h = await host({ settings: { stages: STAGES } });
    assert.deepEqual(plain(h.def.context.tail(h.view()).lines), []);
    h.reply('Warm.', '~ npc Mira | trust: +12\n~ npc Oren | tension: +3');
    assert.deepEqual(plain(h.def.context.tail(h.view()).lines), ['NPC meters now: Mira trust 22 (Friend), affection 0, desire 0, tension 0.'], 'Oren is not present');
    h.reply('Quiet.');
    h.reply('Quiet.');
    assert.deepEqual(plain(h.def.context.tail(h.view()).lines), [], 'not once the change is a few replies old');
});

// ---- stages ----

test('stages: code moves the stage when a meter crosses a threshold either way, with a receipt', async () => {
    const h = await host({ settings: { stages: STAGES } });
    let [result] = h.reply('Kind.', '~ npc Mira | trust: +12').results;
    assert.equal(h.npc('Mira').stages.trust, 'Friend');
    assert.equal(result.receipt.summary, 'Mira: trust reached Friend. Mira: trust 10 → 22.');
    assert.equal(result.receipt.narrate, true, 'the next reply is told');
    assert.deepEqual(result.receipt.data.stages, [{ meter: 'trust', from: null, to: 'Friend' }]);
    [result] = h.reply('Kind.', '~ npc Mira | trust: +2').results;
    assert.equal(result.receipt.narrate, false, 'no stage moved: the reply told it already');
    for (let i = 0; i < 3; i += 1) h.reply('Kinder.', '~ npc Mira | trust: +15');
    assert.equal(h.npc('Mira').stages.trust, 'Confidant');
    [result] = h.reply('Cold.', '~ npc Mira | trust: -15').results;
    assert.equal(h.npc('Mira').meters.trust, 54);
    assert.match(result.receipt.summary, /^Mira: trust fell back to Friend\./);
    for (let i = 0; i < 3; i += 1) [result] = h.reply('Colder.', '~ npc Mira | trust: -15').results;
    assert.equal(h.npc('Mira').stages.trust, undefined);
    assert.match(result.receipt.summary, /^Mira: trust left Friend\./);
    for (let i = 0; i < 3; i += 1) [result] = h.reply('Betrayal.', '~ npc Mira | trust: -15').results;
    assert.equal(h.npc('Mira').stages.trust, 'Wary');
    assert.match(result.receipt.summary, /^Mira: trust reached Wary\./);
    assert.equal(stageAt([{ at: -30, name: 'Wary' }, { at: 0, name: 'Neutral' }], 0)?.name, 'Neutral', 'a threshold at 0 is reached at 0');
    assert.equal(stageAt([{ at: -30, name: 'Wary' }, { at: 0, name: 'Neutral' }], -5), null, 'between them: no stage');
    assert.equal(stageAt([{ at: -60, name: 'Enemy' }, { at: -30, name: 'Wary' }], -70)?.name, 'Enemy', 'the farthest negative one');
});

test('stages: the story cannot set one, and the reader\'s own set moves it too', async () => {
    const h = await host({ settings: { stages: STAGES } });
    h.reply('Hm.', '~ npc Mira | stage: Confidant | trust: +1');
    assert.deepEqual(h.npc('Mira').stages, {});
    const out = await h.adapter.setMeters({ name: 'Mira', meters: { trust: 70 } });
    assert.equal(out.ok, true);
    assert.equal(h.npc('Mira').stages.trust, 'Confidant');
    assert.match(out.receipt.summary, /trust reached Confidant/);
});
