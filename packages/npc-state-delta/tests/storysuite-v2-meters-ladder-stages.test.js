import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_ID } from '../src/storysuite-v2.js';
import { FEATURE_DRIFT, FEATURE_PRESETS, bandWord, createNpcPart, limitsFromLines, limitsToLines, normalizeMeterSettings, parseBands } from '../src/npc-meters.js';
import { BUILT_IN_PRESETS, presetCatalog } from '../src/npc-meters-presets.js';
import { LADDER, dossiers, fakeDom, lastReceipt, suite } from './storysuite-v2-meters-ladder.helpers.js';

// ---- 1. stages with several needs and a milestone ----

test('ladder: a rung needs every meter at once plus its milestone; code promotes and tells the next reply', async () => {
    const s = await suite({ settings: { ladder: LADDER } });
    await s.say(['~ npc Mira | trust: +12']);
    assert.equal(s.npc('Mira').rank, 'Friend', 'trust 22: the first rung');
    assert.equal(s.receipts().some(receipt => receipt.summary.includes('Mira: now Friend') && receipt.narrate), true);
    for (let i = 0; i < 3; i += 1) await s.say(['~ npc Mira | trust: +15 | affection: +15']);
    assert.deepEqual([s.npc('Mira').meters.trust, s.npc('Mira').meters.affection], [67, 45]);
    assert.equal(s.npc('Mira').rank, 'Friend', 'the numbers alone are not enough: Confidant needs its milestone');
    assert.equal(s.host.sdk.query('npc.next', { name: 'Mira' }).text, 'Next: Confidant — milestone “saved her brother”');
    await s.say(['+ milestone Mira — saved her brother']);
    assert.equal(s.npc('Mira').rank, 'Confidant');
    assert.deepEqual(s.npc('Mira').milestones, { 'saved-her-brother': 'saved her brother' });
    const receipt = lastReceipt(s, 'capture.milestone');
    assert.match(receipt.summary, /^Mira: now Confidant\. Mira: milestone “saved her brother”\./);
    assert.equal(receipt.narrate, true);
    assert.equal(s.host.sdk.query('npc.next', { name: 'Mira' }).next, null, 'the top of the ladder');
});

test('milestones: added once by key, never taken away by the story; the reader edits them; nothing in the prompt', async () => {
    const s = await suite({ settings: { ladder: LADDER } });
    const statics = s.def.context.static();
    await s.say(['+ milestone Mira — Saved her brother!']);
    await s.say(['+ milestone Mira — saved  her brother', '- milestone Mira — saved her brother', '+ milestone Mira']);
    const problems = s.host.turn.problems().map(problem => `${problem.code}: ${problem.message}`);
    assert.ok(problems.some(text => /REFUSED: .*Mira already has the milestone “Saved her brother!”/.test(text)), `the same words again are one milestone: ${problems.join(' | ')}`);
    assert.ok(problems.some(text => /REFUSED: .*A milestone is only ever added/.test(text)));
    assert.ok(problems.some(text => /INVALID: .*The line names no milestone/.test(text)));
    assert.deepEqual(s.npc('Mira').milestones, { 'saved-her-brother': 'Saved her brother!' });
    assert.equal(s.def.context.static(), statics, 'the static part does not move');
    assert.doesNotMatch(JSON.stringify(s.def.context.tail(s.view())), /brother/, 'a milestone writes nothing to the tail by itself');
    const added = await s.sdk.command('npc.milestone', { name: 'Mira', add: ['Kept the oath'], remove: ['saved her brother'] });
    assert.equal(added.ok, true, JSON.stringify(added));
    assert.deepEqual(s.npc('Mira').milestones, { 'kept-the-oath': 'Kept the oath' });
    const same = await s.sdk.command('npc.milestone', { name: 'Mira', add: ['kept the oath'] });
    assert.equal(same.code, 'REFUSED');
});

test('ladder: no promotion while a conflict is on (tension above the threshold); it comes once tension falls', async () => {
    const s = await suite({ settings: { ladder: LADDER, conflictAt: 30 } });
    await s.say(['~ npc Oren | tension: +15']);
    await s.say(['~ npc Oren | tension: +15 | trust: +15']);
    await s.say(['~ npc Oren | trust: +10']);
    assert.equal(s.npc('Oren').meters.tension, 30);
    assert.equal(s.npc('Oren').rank, 'Friend', 'tension 30 is not above 30');
    await s.say(['~ npc Oren | tension: +5']);
    for (let i = 0; i < 3; i += 1) await s.say(['~ npc Oren | trust: +15 | affection: +15']);
    await s.say(['+ milestone Oren — saved her brother']);
    assert.equal(s.npc('Oren').rank, 'Friend', 'the conflict holds Confidant back');
    assert.match(lastReceipt(s, 'capture.milestone').summary, /Confidant waits while tension is above 30/);
    assert.match(s.host.sdk.query('npc.next', { name: 'Oren' }).text, /^Next: Confidant — waits while tension is above 30/);
    await s.say(['~ npc Oren | tension: -10']);
    assert.equal(s.npc('Oren').rank, 'Confidant', 'tension 25: promoted on that line');
});

test('ladder: a rung is lost only after its needs failed N replies in a row; a recovery resets the count', async () => {
    const s = await suite({ settings: { ladder: LADDER, demoteAfter: 3 } });
    await s.say(['~ npc Mira | trust: +12']);
    assert.equal(s.npc('Mira').rank, 'Friend');
    await s.say(['~ npc Mira | trust: -5']);
    assert.equal(s.npc('Mira').rank, 'Friend', 'one reply low');
    assert.equal(s.host.sdk.query('npc.next', { name: 'Mira' }).risk.replies, 1);
    await s.say();
    assert.match(s.host.sdk.query('npc.next', { name: 'Mira' }).text, /Friend slipping — trust 17\/20 \(2\/3 replies\)/);
    await s.say(['~ npc Mira | trust: +5']);
    assert.equal(s.host.sdk.query('npc.next', { name: 'Mira' }).risk, null, 'recovered: the count is gone');
    await s.say(['~ npc Mira | trust: -5']);
    await s.say();
    assert.equal(s.npc('Mira').rank, 'Friend', 'two replies low after the recovery');
    await s.say();
    assert.equal(s.npc('Mira').rank, undefined, 'the third reply in a row takes it');
    const tick = lastReceipt(s, 'npc.tick');
    assert.match(tick.summary, /Mira: no longer Friend/);
    assert.equal(tick.narrate, true);
    assert.equal(tick.cause, 'ui', 'Delta\'s own step after the reply, on that reply');
});

test('the per-reply step rolls back with its reply: a swipe or a regenerate never counts a reply twice', async () => {
    const s = await suite({ settings: { ladder: LADDER, demoteAfter: 3 } });
    await s.say(['~ npc Mira | trust: +12']);
    await s.say(['~ npc Mira | trust: -5']);
    await s.say();
    assert.equal(s.host.sdk.query('npc.next', { name: 'Mira' }).risk.replies, 2);
    for (let i = 0; i < 4; i += 1) await s.swipe();
    assert.equal(s.host.sdk.query('npc.next', { name: 'Mira' }).risk.replies, 2, 'each swipe has its own step');
    await s.regenerate();
    assert.equal(s.host.sdk.query('npc.next', { name: 'Mira' }).risk.replies, 2);
    assert.equal(s.npc('Mira').rank, 'Friend');
    await s.host.st.swipeTo(s.host.store.headIndex(), 0);
    assert.equal(s.host.sdk.query('npc.next', { name: 'Mira' }).risk.replies, 2);
    const head = JSON.stringify(s.host.head());
    s.host.store.rebuild();
    assert.equal(JSON.stringify(s.host.head()), head, 'replay equals the live state');
    // A button cannot take the step.
    const out = await s.host.sdk.command('npc.tick', {});
    assert.equal(out.code, 'REFUSED');
});

// ---- 2. per-NPC ceilings and floors ----

test('limits: growth stops at the ceiling, a fall at the floor; a change back always lands; the reader may go past', async () => {
    const records = dossiers();
    records.npc_mira.meterSetup = { limits: { affection: { ceiling: 30 }, trust: { floor: 0 } } };
    const s = await suite({ records });
    await s.say(['~ npc Mira | affection: +15']);
    await s.say(['~ npc Mira | affection: +15']);
    await s.say(['~ npc Mira | affection: +15 | trust: -15']);
    assert.deepEqual([s.npc('Mira').meters.affection, s.npc('Mira').meters.trust], [30, 0]);
    assert.match(lastReceipt(s, 'capture.npc').summary, /affection 30 → 30 \(held at 30, at the ceiling; \+15 asked\), trust 10 → 0 \(held at 0, at the floor; -15 asked\)/);
    await s.say(['~ npc Mira | affection: -12 | trust: +5']);
    assert.deepEqual([s.npc('Mira').meters.affection, s.npc('Mira').meters.trust], [18, 5], 'away from a limit, a change lands in full');
    await s.sdk.command('npc.set', { name: 'Mira', meters: { affection: 50 } });
    assert.equal(s.npc('Mira').meters.affection, 50, 'the reader\'s own value may pass the ceiling');
    await s.say(['~ npc Mira | affection: +5']);
    assert.equal(s.npc('Mira').meters.affection, 50, 'never pulled down to the ceiling, never raised past it');
    await s.say(['~ npc Mira | affection: -5']);
    assert.equal(s.npc('Mira').meters.affection, 45, 'a loss lands from where it is');
    // Delta's scanner is held the same way.
    await s.adapter.adjust({ name: 'Mira', meters: { affection: 9 }, reply: s.host.store.headIndex() });
    assert.equal(s.npc('Mira').meters.affection, 45);
});

test('limits from a preset: the Mentor keeps desire at 0; the NPC\'s own limit wins over the preset\'s', async () => {
    const records = dossiers();
    records.npc_mira.meterSetup = { track: 'mentor' };
    records.npc_oren.meterSetup = { track: 'mentor', limits: { desire: { ceiling: 10 } } };
    const s = await suite({ records, settings: { presets: ['mentor'] } });
    await s.say(['~ npc Mira | desire: +10 | approval: +15', '~ npc Oren | desire: +15']);
    assert.equal(s.npc('Mira').meters.desire, 0);
    assert.equal(s.npc('Oren').meters.desire, 10);
    assert.equal(s.npc('Mira').meters.approval, 25, 'the preset\'s meter, from its start');
    assert.equal(s.npc('Mira').rank, 'Student', 'the preset\'s ladder runs for the NPCs given it');
    assert.equal(s.host.sdk.query('npc.cast').find(entry => entry.key === 'npc_mira').bars.find(bar => bar.id === 'desire').ceiling, 0);
});

test('limits as editor lines read back; bad lines are problems', () => {
    const { limits, problems } = limitsFromLines('trust: floor -20, ceiling 60\naffection: max 40\nnot a limit\ndesire: ceiling 5, floor 9');
    assert.deepEqual(limits, { trust: { ceiling: 60, floor: -20 }, affection: { ceiling: 40 } });
    assert.deepEqual(problems, ['not a limit', 'desire: ceiling 5, floor 9']);
    assert.equal(limitsToLines(limits), 'trust: floor -20, ceiling 60\naffection: ceiling 40');
    assert.deepEqual(limitsFromLines(limitsToLines(limits)).limits, limits);
});

// ---- 3. fuller custom meters ----

test('custom meters: the rule line goes in the static part only while presets and rules are on; band words go in the tail', () => {
    const settings = { customMeters: [{ name: 'Loyalty', min: 0, max: 100, describe: 'rises when you keep promises.', bands: 'doubtful 25, steady 60, devoted' }] };
    const make = presets => createNpcPart({ settings: () => settings, present: () => ['Mira'], feature: id => (id === FEATURE_PRESETS ? presets : id === 'npc-state-delta.anti-lever' ? false : undefined) });
    const on = make(true).context.static();
    const off = make(false).context.static();
    assert.match(on, / Meter rules: loyalty rises when you keep promises\.$/);
    assert.equal(off, 'NPC meters: trust, affection, desire, tension (-100..100), loyalty (0..100). When the scene changes how someone feels: ~ npc Name | meter: +N, -N or =N. Code clamps each meter, moves it at most 15 a reply and sets the stages; never write a stage. Add | why: what caused it.');
    assert.equal(on.startsWith(off.slice(0, -1)), true, 'the rule line is added at the end');
    const state = { domains: { people: { v: 1, order: [], npcs: {}, bonds: { problems: [], npcs: { npc_mira: { name: 'Mira', meters: { trust: 5, affection: 0, desire: 0, tension: 0, loyalty: 61 }, stages: {}, unlocked: [], turn: { reply: 2, from: {} } } } } } } };
    assert.deepEqual(make(true).context.tail({ state, chat: { length: 3 } }).lines.filter(line => typeof line === 'string'), ['NPC meters now: Mira trust 5, affection 0, desire 0, tension 0, loyalty devoted.']);
    assert.deepEqual(parseBands('doubtful 25, steady <= 60, devoted, 2bad, steady 99').map(band => [band.upTo, band.word]), [[25, 'doubtful'], [60, 'steady'], [99, 'steady'], [null, 'devoted']]);
    assert.equal(bandWord(parseBands('low 10, high'), 10), 'low');
    assert.equal(bandWord(parseBands('low 10, high'), 11), 'high');
    assert.equal(bandWord([], 11), '');
});

test('the static part stays byte-identical reply to reply with presets, rules, a ladder and milestones in use', async () => {
    const s = await suite({ settings: { presets: ['rival', 'companion'], ladder: LADDER, customMeters: [{ name: 'Awe', describe: 'rises with wonders' }] } });
    const first = s.def.context.static();
    assert.match(first, /awe \(0\.\.100\), respect \(0\.\.100\), rivalry \(0\.\.100\), loyalty \(0\.\.100\)/);
    assert.match(first, /Meter rules: awe rises with wonders; respect rises when you beat/);
    await s.say(['~ npc Mira | respect: +10 | trust: +15', '+ milestone Mira — saved her brother']);
    await s.say(['~ npc Oren | rivalry: +5']);
    assert.equal(s.def.context.static(), first);
    assert.doesNotMatch(first, /Mira|Oren|brother|Friend/);
});

test('drift: off by default; on, a drifting meter moves toward its resting value each story day (Story Director\'s clock)', async () => {
    // A stand-in for Story Director: its domain holds the story minutes, its query answers director.time.
    const clock = {
        id: 'zz-clock', name: 'Clock',
        domains: { director: { initial: () => ({ time: { minutes: 0 } }) } },
        commands: { 'zz.clock': (ctx, { minutes }) => { ctx.draft('director').time.minutes = minutes; return { summary: 'time passes' }; } },
        queries: { 'director.time': state => ({ minutes: state?.domains?.director?.time?.minutes ?? null }) },
    };
    const settings = { customMeters: [{ name: 'Mood', min: -50, max: 50, start: 0, drift: 4, driftTo: 0 }] };
    const off = await suite({ settings, modules: [clock] });
    await off.say(['~ npc Mira | mood: +15']);
    await off.host.sdk.command('zz.clock', { minutes: 3 * 1440 });
    await off.say();
    assert.equal(off.npc('Mira').meters.mood, 15, 'the drift feature is off by default');

    const s = await suite({ settings, modules: [clock], features: { [FEATURE_DRIFT]: true } });
    await s.say(['~ npc Mira | mood: +15']);
    assert.equal(s.npc('Mira').meters.mood, 15, 'the first step only notes the day');
    await s.host.sdk.command('zz.clock', { minutes: 2 * 1440 + 60 });
    await s.say();
    assert.equal(s.npc('Mira').meters.mood, 7, 'two days: 4 a day toward 0');
    assert.match(lastReceipt(s, 'npc.tick').summary, /Mira: mood 15 → 7 \(story days passed\)/);
    await s.say();
    assert.equal(s.npc('Mira').meters.mood, 7, 'the same day: no more');
    await s.host.sdk.command('zz.clock', { minutes: 10 * 1440 });
    await s.say();
    assert.equal(s.npc('Mira').meters.mood, 0, 'never past its resting value');
});

test('presets: the built-in three are plain; packs add theirs; the settings block turns one on in a click', async () => {
    assert.deepEqual(BUILT_IN_PRESETS.map(preset => preset.name), ['Companion', 'Rival', 'Mentor']);
    for (const preset of BUILT_IN_PRESETS) assert.doesNotMatch(JSON.stringify(preset), /lust|arous|sex|nsfw|erot/i);
    const catalog = presetCatalog([
        { id: 'pack.ersveil/knight', slug: 'knight', pack: 'ersveil', name: 'Sworn knight', meters: [{ name: 'Honour', describe: 'rises with oaths kept' }], ladder: [{ name: 'Squire', needs: 'honour 10' }] },
        { id: 'pack.x/empty', name: 'Nothing in it' },
        { id: 'pack.x/rival', name: 'Rival' },
    ]);
    assert.deepEqual(catalog.map(preset => preset.id), ['companion', 'rival', 'mentor', 'pack.ersveil/knight']);
    const normalized = normalizeMeterSettings({ presets: ['pack.ersveil/knight', 'nope'] }, { presets: catalog });
    assert.deepEqual(normalized.custom.map(def => [def.id, def.preset]), [['honour', 'pack.ersveil/knight']]);
    assert.deepEqual(normalized.ladder['pack.ersveil/knight'].map(step => step.name), ['Squire']);

    // The settings section's block: Use writes only the `presets` setting.
    const stored = {};
    const doc = fakeDom();
    const s = await suite({ doc });
    const el = doc.createElement('div');
    s.def.settings.section(el, { set: (key, value) => { stored[key] = value; }, values: () => ({ ...stored }) });
    const block = el.children[0];
    assert.equal(block.className, 'npc-state-delta-v2-presets');
    const rows = block.children.filter(node => node.className === 'npc-state-delta-v2-preset');
    assert.deepEqual(rows.map(row => row.dataset.preset), ['companion', 'rival', 'mentor']);
    rows[1].children[2].click();
    assert.deepEqual(stored, { presets: ['rival'] });
    const again = block.children.filter(node => node.className === 'npc-state-delta-v2-preset')[1].children[2];
    assert.equal(again.textContent, 'Stop using');
    again.click();
    assert.deepEqual(stored, { presets: [] });
});
