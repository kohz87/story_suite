import test from 'node:test';
import assert from 'node:assert/strict';
import { noteKinds } from '../src/npc-notes-kinds.js';
import { tastesText, mergeRefreshTastes, readTastes } from '../src/npc-notes-tastes.js';
import { suite } from './helpers/pacing-suite.js';
import { validateNpcSlice } from '../src/npc-meters.js';
import { MODULE_ID } from '../src/storysuite-v2.js';
import { FEATURE_NOTES } from '../src/npc-meters-config.js';
import { projectDossierState } from '../dossier-ui-catalog.js';
import { dossierProfileHtml } from '../dossier-ui-profile.js';
import { ON, oren, crowded } from './npc-notes-kinds.helpers.js';

const exampleOf = grammar => /e\.g\. ([^)]+)\)$/.exec(grammar)?.[1];

test('notes grammar: each kind says plainly when to write it and carries one example line that the real parser takes', async () => {
    const kinds = noteKinds(() => {});
    const s = await suite({ allowance: null, features: ON });
    await s.setDay(1);
    for (const kind of ['lie', 'know', 'taste', 'tie']) {
        const grammar = kinds[kind].grammar;
        assert.match(grammar, /write it when /, kind);
        const example = exampleOf(grammar);
        assert.ok(example && example.startsWith(`~ ${kind} `), `${kind}: ${grammar}`);
        const stored = await s.say([example]);
        assert.ok(stored !== undefined, kind);
    }
    const o = Object.values(s.host.head().domains.people.bonds.npcs).find(npc => npc.name === 'Person A');
    assert.ok(o, 'the examples name a generic person');
    assert.equal(JSON.parse(o.lies).length, 1, 'the lie example wrote a lie leaf');
    assert.equal(JSON.parse(o.knows).length, 1);
    assert.ok(o.tastes && o.ties, 'the taste and tie examples wrote their leaves');
    const { createNpcPart } = await import('../src/npc-meters.js');
    const milestone = createNpcPart({ settings: () => ({}), present: () => [], feature: () => true }).kinds.milestone.grammar;
    assert.match(milestone, /when a bond changes for good; e\.g\. \+ milestone Person A — a promise was kept\)$/);
});

test('notes grammar: the example lines use generic placeholder people and facts, never a name or fact of any world', () => {
    const all = Object.values(noteKinds(() => {})).map(kind => exampleOf(kind.grammar)).join('\n');
    for (const name of ['Pell', 'Temiwa', 'Astra', 'Oren', 'Mira', 'Ersveil', 'Rika', 'Tomas']) assert.ok(!all.includes(name), name);
    assert.ok(!/\bill\b/.test(all));
    assert.ok((all.match(/Person [AB]/g) ?? []).length >= 4);
});

test('notes grammar: the lie line agrees with itself: when and example both use the host\'s {{user}} macro, no hard-coded name', () => {
    const lie = noteKinds(() => {}).lie.grammar;
    assert.match(lie, /^~ lie Name \| to: \{\{user\}\} \|/);
    assert.match(lie, /write it when someone lies to \{\{user\}\};/);
    assert.match(lie, /e\.g\. ~ lie Person A \| to: \{\{user\}\} \|/);
    assert.ok(!/Astra|to the player|to: Person B/.test(lie));
});

test('notes grammar: the static text is the same bytes every time and the added text stays small', async () => {
    const once = JSON.stringify(noteKinds(() => {}));
    assert.equal(JSON.stringify(noteKinds(() => {})), once);
    const bare = 88 + 107 + 54 + 70; // the four lines as they were (lie, know, taste, tie)
    const added = Object.values(noteKinds(() => {})).reduce((sum, kind) => sum + kind.grammar.length, 0) - bare;
    assert.ok(added > 0 && added < 500, `added ${added} chars`);
});

const CUE = /^Whenever anything changed, write the <Changes> block \(just before <Blocks>, which still ends the reply\), even if <Blocks> is empty/;
const tailOf = s => s.host.registry.module(MODULE_ID).context.tail({ state: s.host.head(), chat: { length: s.host.ctx.chat.length } });
const cueLines = tail => tail.lines.filter(line => CUE.test(typeof line === 'string' ? line : line?.text));

test('notes tail: the Changes cue is one kept line, last of the lines, with the notes feature on whoever is in the scene, and absent with it off', async () => {
    const on = await suite({ allowance: null, features: ON });
    await on.setDay(1);
    await on.say(['~ npc Oren | trust: +1']);
    const tail = tailOf(on);
    assert.equal(cueLines(tail).length, 1);
    assert.deepEqual(tail.lines.at(-1), { text: tail.lines.at(-1).text, keep: true });
    assert.match(tail.lines.at(-1).text, CUE);
    assert.ok(!tail.optional.some(line => /<Changes>/.test(line)), 'not an optional line: the host drops those first');
    const off = await suite({ allowance: null, features: { [FEATURE_NOTES]: false } });
    await off.setDay(1);
    await off.say(['~ npc Oren | trust: +1']);
    assert.equal(cueLines(tailOf(off)).length, 0);
});

test('notes tail: the cue is sent in a reply with nobody present (a quiet travel reply) and with no dossier at all', async () => {
    const empty = await suite({ allowance: null, features: ON });
    assert.equal(cueLines(tailOf(empty)).length, 1);
    const alone = await suite({ allowance: null, features: ON, present: [] });
    await alone.setDay(1);
    await alone.say(['~ npc Oren | trust: +1']);
    assert.equal(cueLines(tailOf(alone)).length, 1);
});

test('notes tail: under a tight tail budget (the run\'s 550 tokens, here 60 with a crowded section) the host still sends the cue (the meters line is the one that goes)', async () => {
    const { assemble } = await import('../../story-block/src/v2/prompt.js');
    const s = await suite({ allowance: null, features: ON });
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +1']);
    const view = { state: s.host.head(), query: () => null, settings: {}, chat: { length: s.host.ctx.chat.length } };
    const built = assemble({ registry: s.host.registry, view, settings: { tailBudget: 60 } });
    assert.ok(CUE.test(built.tailText.split('\n').find(line => CUE.test(line)) ?? ''), built.tailText);
    const ours = built.parts.find(part => part.module === MODULE_ID && part.place === 'tail');
    assert.match(ours.text, /Whenever anything changed/);
    assert.ok(!/NPC meters now/.test(ours.text), 'the ordinary line was dropped, the kept cue stayed');
});

test('notes tail: tailBudget 550, nobody present, a crowded section: the other module\'s kept line wins, the cue is kept when it fits after it, the tail is under budget', async () => {
    const { built, initiative, estimateTokens } = await crowded(32);
    assert.ok(built.tailText.includes(initiative), 'the Initiative kept line stays');
    assert.ok(CUE.test(built.tailText.split('\n').find(line => CUE.test(line)) ?? ''), 'the cue is sent');
    assert.ok(estimateTokens(built.tailText) <= 550, `tail ${estimateTokens(built.tailText)} tokens`);
    assert.ok(!built.tailText.includes('Guild: the last'), 'ordinary lines go before the kept ones (the crowd was over budget)');
});

test('notes tail: when the shared kept cap is spent (past 120 tokens) the cue is an ordinary line: the other kept lines still stay, the tail is under budget', async () => {
    const { built, initiative, estimateTokens } = await crowded(100);
    assert.ok(built.tailText.includes(initiative), 'the kept line stays whatever happens to the cue');
    assert.ok(estimateTokens(built.tailText) <= 550, `tail ${estimateTokens(built.tailText)} tokens`);
    assert.ok(!/Whenever anything changed/.test(built.tailText), 'no room after the others\' kept lines: the cue goes first, as an ordinary line');
});

test('mergeRefreshTastes: new tastes merge like ~ taste lines; a taste already there (either sign) and a full sign are never changed or pushed out', () => {
    const own = tastesText([{ sign: '+', item: 'Burnt Sugar', from: 'narrator', day: 1, r: 'r1' }, { sign: '-', item: 'Paperwork', day: 1, r: 'r1' }]);
    const out = mergeRefreshTastes(own, [
        { sign: '+', item: 'burnt  sugar', from: 'again' }, { sign: '+', item: 'paperwork', from: 'flip' }, { sign: '+', item: 'old maps', from: 'collects them [m4]' },
        { sign: '-', item: 'loud bells', from: 'flinches' }, { sign: 'x', item: 'junk' }, { sign: '+', item: '' },
    ], { name: 'Oren', day: 3, r: 'r9' });
    assert.equal(out.added, 2);
    const rows = readTastes(out.text);
    assert.deepEqual(rows.map(row => [row.sign, row.item, row.from ?? null, row.r]), [['+', 'Burnt Sugar', 'narrator', 'r1'], ['-', 'Paperwork', null, 'r1'], ['+', 'old maps', 'collects them', 'r9'], ['-', 'loud bells', 'flinches', 'r9']]);
    const full = tastesText(Array.from({ length: 6 }, (_, i) => ({ sign: '+', item: `like ${i}`, day: 0, r: 'r1' })));
    const none = mergeRefreshTastes(full, [{ sign: '+', item: 'one more' }], { r: 'r2' });
    assert.equal(none.added, 0, 'a full sign takes nothing');
    assert.equal(none.text, full, 'and nothing is pushed out');
    assert.equal(mergeRefreshTastes('', [{ sign: '+', item: 'tea' }], {}).added, 1);
    assert.equal(mergeRefreshTastes(null, 'nope').added, 0);
});

test('notes host: npc.taste records a Refresh\'s tastes on its reply; the narrator\'s taste stays; a button, an unknown person and a repeat write nothing; swipe and rebuild equal live', async () => {
    const s = await suite({ allowance: null, features: ON });
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +1']);
    await s.say(['~ taste Oren | likes: tea | from: the kettle']);
    const head = () => s.host.store.headIndex();
    assert.equal((await s.host.sdk.command('npc.taste', { name: 'Oren', tastes: [{ sign: '+', item: 'x' }] })).ok, false, 'not from a button');
    assert.equal(await s.adapter.tastes({ name: 'Sister Temiwa', tastes: [{ sign: '+', item: 'x' }], reply: head() }), null, 'no entry is made by a Refresh');
    assert.equal(await s.adapter.tastes({ name: 'Oren', tastes: [], reply: head() }), null);
    await s.say(['~ npc Oren | trust: +1']);
    await s.adapter.tastes({ name: 'Oren', tastes: [{ sign: '+', item: 'Tea', from: 'refresh' }, { sign: '-', item: 'loud bells', from: 'flinches [m3]' }, { sign: '+', item: 'old maps', from: 'collects them' }], reply: head() });
    const rows = () => readTastes(oren(s).tastes);
    assert.deepEqual(rows().map(row => [row.sign, row.item, row.from ?? null]), [['+', 'tea', 'the kettle'], ['-', 'loud bells', 'flinches'], ['+', 'old maps', 'collects them']].map(([a, b, c]) => [a, b === 'tea' ? 'tea' : b, c]));
    assert.ok(rows().slice(1).every(row => row.r), 'each Refresh taste carries its reply');
    const before = JSON.stringify(oren(s).tastes);
    await s.adapter.tastes({ name: 'Oren', tastes: [{ sign: '+', item: 'old maps', from: 'again' }], reply: head() });
    assert.equal(JSON.stringify(oren(s).tastes), before, 'a repeat changes nothing');
    const live = JSON.stringify(s.host.head().domains.people?.bonds);
    s.host.store.rebuild();
    assert.equal(JSON.stringify(s.host.head().domains.people?.bonds), live, 'rebuild equals live');
    assert.deepEqual(validateNpcSlice(s.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
    await s.swipe(['~ npc Oren | trust: +1']);
    assert.deepEqual(rows().map(row => row.item), ['tea'], 'a swipe of the reply that ran the Refresh takes its tastes back');
    const swiped = JSON.stringify(s.host.head().domains.people?.bonds);
    s.host.store.rebuild();
    assert.equal(JSON.stringify(s.host.head().domains.people?.bonds), swiped, 'rebuild equals live after the swipe');
    assert.deepEqual(validateNpcSlice(s.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
});

test('notes host: the Profile placeholders (Tastes, Drives) reach the real dossier chain only with notes ON (adapter.dossierMeters → projectDossierState → Profile)', async () => {
    const profile = async features => {
        const s = await suite({ allowance: null, features });
        await s.setDay(1);
        await s.say(['~ npc Oren | trust: +1']);
        const npcs = [{ id: 'npc_oren', name: 'Oren' }];
        const meterViews = s.adapter.dossierMeters(npcs);
        const projected = projectDossierState({ npcs, meterViews }).npcs[0];
        return { view: meterViews.npc_oren, html: dossierProfileHtml(projected, { layout: 'phone' }) };
    };
    const on = await profile(ON);
    assert.equal(on.view.notesOn, true, 'the adapter keeps the flag');
    assert.match(on.html, /<h3>Tastes<\/h3>/);
    assert.match(on.html, /No tastes yet/);
    assert.match(on.html, /<h3>Drives<\/h3>/);
    assert.equal((on.html.match(/class="delta-drive" data-level="normal"/g) || []).length, 7, 'no record: seven normal rows');
    assert.match(on.html, /The middle of each bar is normal/);
    const off = await profile({ [FEATURE_NOTES]: false });
    assert.equal(off.view.notesOn, undefined);
    assert.doesNotMatch(off.html, /Tastes|Drives|No tastes yet|All normal so far|delta-drive/);
});

test('notes host: npc.drives grows a drive on the 2nd different reply with a cue; live == rebuild, a swipe takes the step back, a button is refused', async () => {
    const s = await suite({ allowance: null, features: { ...ON } });
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +1']);
    const slice = () => s.host.head().domains.people?.bonds;
    const belonging = () => JSON.parse(slice().npcs.npc_oren.drives ?? '{"belo":2}').belo;
    assert.equal((await s.host.sdk.command('npc.drives', { name: 'Oren', texts: ['a friend'], rule: 1 })).ok, false, 'not from a button');
    assert.equal(await s.adapter.drives({ name: 'Oren', texts: ['made a friend at the inn'] }) !== null, true);
    assert.equal(belonging(), 2, 'one reply with a cue: still normal');
    await s.say(['~ npc Oren | trust: +1']);
    await s.adapter.drives({ name: 'Oren', texts: ['his family came to visit'] });
    assert.equal(belonging(), 3, 'a second different reply with a cue: high');
    assert.deepEqual(validateNpcSlice(slice()), []);
    const live = JSON.stringify(slice());
    s.host.store.rebuild();
    assert.equal(JSON.stringify(slice()), live, 'rebuild equals live');
    await s.adapter.drives({ name: 'Oren', texts: ['a friend again'] });
    assert.equal(JSON.stringify(slice()), live, 'the same reply again changes nothing');
    await s.swipe(['~ npc Oren | trust: +1']);
    assert.equal(belonging(), 2, 'a swipe of the reply takes the step back');
    assert.deepEqual(s.host.store.problems(), []);
});

test('notes host: the same reply twice counts once while the drive is below max (the 2-reply rule, not the max cap); an Re-read and a middle delete keep the drives', async () => {
    const s = await suite({ allowance: null, features: { ...ON } });
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +1']);
    const comfort = () => JSON.parse(s.host.head().domains.people.bonds.npcs.npc_oren.drives ?? '{"comf":2}').comf;
    await s.adapter.drives({ name: 'Oren', texts: ['found a cozy bed'] });
    const once = JSON.stringify(s.host.head().domains.people?.bonds);
    await s.adapter.drives({ name: 'Oren', texts: ['a warm meal'] });
    assert.equal(comfort(), 2, 'two cues in the SAME reply: still normal');
    assert.equal(JSON.stringify(s.host.head().domains.people?.bonds), once, 'nothing written for the same reply');
    const second = await s.say(['~ npc Oren | trust: +1']);
    await s.adapter.drives({ name: 'Oren', texts: ['a warm meal'] });
    assert.equal(comfort(), 3, 'the next reply: high');
    await s.say(['~ npc Oren | trust: +1']);
    assert.equal((await s.host.sdk.reread(second)).ok, true);
    let live = JSON.stringify(s.host.head().domains.people?.bonds);
    s.host.store.rebuild();
    assert.equal(JSON.stringify(s.host.head().domains.people?.bonds), live, 'a Re-read of the reply that carried npc.drives replays as stored');
    assert.equal(comfort(), 3);
    await s.host.st.deleteMessage(second - 1);
    live = JSON.stringify(s.host.head().domains.people?.bonds);
    s.host.store.rebuild();
    assert.equal(JSON.stringify(s.host.head().domains.people?.bonds), live, 'rebuild equals live after a middle delete');
    assert.deepEqual(s.host.store.problems(), []);
});
