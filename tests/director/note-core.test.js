// Tests for src/note.js: the note's format, its budget and the change-line instruction.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHANGE_INSTRUCTION, ENCOUNTER_CUE, NOTE_PART_WORDS, NPC_PLANS_ONLY, PACING, PACING_NO_CHANGES, buildNote, noteParts } from '../../modules/world/note.js';
import { estimateTokens } from '../../modules/atlas/relevance.js';
import { brant, calendar, council, courier, debt, fires, geva, graves, lines, record, sale, selection, stranger, weir } from './note.helpers.js';

test('the header carries the formatted time and the place', () => {
    const note = buildNote(selection({ relevant: [fires] }), { calendar });
    assert.equal(lines(note)[0], '[Story Director · CY 611, Goldwane 16, 09:00 am · Auvoth]');
});

test('Due now and Arriving lines', () => {
    const note = buildNote(selection({ due: [sale, geva], arriving: [courier] }), { calendar });
    assert.deepEqual(lines(note).slice(1, 3), [
        "Due now: Saartje's sale (Goldwane 16) · Geva — files the warrant (Goldwane 17)",
        'Arriving: Courier arrives Varnhold Watch (Goldwane 16, morning)',
    ]);
});

test('one line per kind, in the contract order', () => {
    const thys = record({ key: 'Thys', fields: { now: 'at the gate' } });
    const note = buildNote(selection({ relevant: [council, graves, geva, stranger, fires, brant, thys] }), { calendar });
    assert.deepEqual(lines(note).slice(1, -CHANGE_INSTRUCTION.split('\n').length - 1), [
        'Off-screen: Geva — Bailiff Court → files the warrant (Goldwane 17) · Brant — on the frontier road with a dray → arrives Auvoth (Goldwane 19) · Thys — at the gate',
        'World: Canal Street fires — curfew in force',
        'Hooks: River stranger — who pulled Ren from the sump',
        "Clocks: Hollin's Reach graves — the dead rise (Goldwane 28) · shown: sign",
        'Beats: Council session opens (Goldwane 18, 09:00 am)',
    ]);
});

test('Do not reveal lists secret keys only', () => {
    const note = buildNote(selection({ secrets: [weir, debt] }), { calendar });
    assert.ok(lines(note).includes("Do not reveal: who sold the weir route; Chiyo's debt"));
    assert.ok(!note.includes('Brant sold it'));
});

test('corrections get their own line', () => {
    const note = buildNote(selection({ relevant: [courier] }), {
        calendar,
        corrections: ['Courier — leg is Shorn → Varnhold Watch 35 km B, arrive Goldwane 16, morning'],
    });
    assert.ok(lines(note).includes('Corrections: Courier — leg is Shorn → Varnhold Watch 35 km B, arrive Goldwane 16, morning'));
});

test('corrections for keys that are not tracked share the line, and only when there are some', () => {
    const untracked = '"Footing in Bluewatch" is not tracked: add it with "+ kind Footing in Bluewatch — …" before changing it.';
    const note = buildNote(selection({ relevant: [courier] }), {
        calendar,
        corrections: ['Courier — leg Shorn → Varnhold Watch 35 B', untracked],
    });
    assert.ok(lines(note).includes(`Corrections: Courier — leg Shorn → Varnhold Watch 35 B · ${untracked}`));
    // With nothing tracked yet the correction still reaches the model, before the instruction.
    assert.deepEqual(noteParts(selection(), { calendar, corrections: [untracked] }).map(entry => entry.label), ['Header', 'Corrections', 'Change instruction']);
    assert.ok(estimateTokens(untracked) <= 30);
    // Nothing to correct: no Corrections line at all.
    assert.ok(!buildNote(selection({ relevant: [courier] }), { calendar, corrections: [] }).includes('Corrections'));
    assert.equal(buildNote(selection(), { calendar, corrections: [] }), CHANGE_INSTRUCTION);
});

test('the instruction comes last', () => {
    const note = buildNote(selection({ relevant: [fires] }), { calendar });
    assert.ok(note.endsWith(`\n${CHANGE_INSTRUCTION}`));
    const custom = buildNote(selection({ relevant: [fires] }), { calendar, instruction: 'Write <Director>.' });
    assert.ok(custom.endsWith('\nWrite <Director>.'));
});

test('the budget drops the lowest-priority relevant records first', () => {
    const relevant = [graves, council, geva, fires, stranger];
    const full = buildNote(selection({ relevant }), { calendar });
    const withoutLast = buildNote(selection({ relevant: relevant.slice(0, -1) }), { calendar });
    const note = buildNote(selection({ relevant }), { calendar, budgetTokens: estimateTokens(withoutLast) });
    assert.ok(estimateTokens(full) > estimateTokens(withoutLast));
    assert.equal(note, withoutLast);
    assert.ok(!note.includes('River stranger'));
    assert.ok(note.includes("Hollin's Reach graves"));
});

test('a tiny budget keeps the header, due lines, Do not reveal and the instruction', () => {
    const note = buildNote(selection({ due: [sale], arriving: [courier], relevant: [graves, geva, fires], secrets: [debt] }), {
        calendar,
        budgetTokens: 5,
    });
    assert.deepEqual(lines(note), [
        '[Story Director · CY 611, Goldwane 16, 09:00 am · Auvoth]',
        "Due now: Saartje's sale (Goldwane 16)",
        'Arriving: Courier arrives Varnhold Watch (Goldwane 16, morning)',
        "Do not reveal: Chiyo's debt",
        PACING,
        ...CHANGE_INSTRUCTION.split('\n'),
    ]);
});

test('pacing: only when something is scheduled, in the capture wording without change lines', () => {
    const thys = record({ key: 'Thys', fields: { now: 'at the gate' } });
    const quiet = buildNote(selection({ relevant: [thys, fires] }), { calendar });
    assert.ok(!quiet.includes('Pacing:'), 'nothing dated or planned: no pacing line');

    const due = buildNote(selection({ due: [sale] }), { calendar });
    assert.equal(lines(due).at(-CHANGE_INSTRUCTION.split('\n').length - 1), PACING);
    assert.match(PACING, /Never cut into or bend the current scene for a beat/);
    assert.match(PACING, /\{\{user\}\}/);
    assert.ok(estimateTokens(PACING) < 100, 'short');

    assert.ok(buildNote(selection({ relevant: [council] }), { calendar }).includes(PACING), 'a beat counts');
    assert.ok(buildNote(selection({ relevant: [geva] }), { calendar }).includes(PACING), 'a next step counts');

    const captured = buildNote(selection({ due: [sale] }), { calendar, instruction: '' });
    assert.equal(lines(captured).at(-1), PACING_NO_CHANGES);
    assert.doesNotMatch(PACING_NO_CHANGES, /~ on|\(!\)/);
});

test('no records gives the instruction alone', () => {
    assert.equal(buildNote(selection(), { calendar }), CHANGE_INSTRUCTION);
    assert.equal(buildNote(selection(), { calendar, instruction: 'Only this.' }), 'Only this.');
});

test('CHANGE_INSTRUCTION: about 165 tokens, the four ops, kinds, fields and the rules', () => {
    const tokens = estimateTokens(CHANGE_INSTRUCTION);
    assert.ok(tokens >= 100 && tokens <= 165, `${tokens} tokens`);
    assert.match(CHANGE_INSTRUCTION, /a job only offered: \+ hook with giver, reward/);
    assert.match(CHANGE_INSTRUCTION, /<Director>/);
    assert.match(CHANGE_INSTRUCTION, /^\+ kind Key — summary \| label: value/m);
    assert.match(CHANGE_INSTRUCTION, /^~ Key — label: value/m);
    assert.match(CHANGE_INSTRUCTION, /^- Key — reason/m);
    assert.match(CHANGE_INSTRUCTION, /^! Key — what happened/m);
    for (const kind of ['agenda', 'event', 'hook', 'clock', 'beat', 'secret']) assert.ok(CHANGE_INSTRUCTION.includes(kind), kind);
    assert.match(CHANGE_INSTRUCTION, /now, then, on, due, leg, arrive, shown/);
    assert.match(CHANGE_INSTRUCTION, /Dates go only in on, due and arrive, with a clock time/);
    assert.match(CHANGE_INSTRUCTION, /never the whole list/);
    assert.ok(CHANGE_INSTRUCTION.includes('Never write actions for {{user}}'));
});

test('the current arc heads its beats, with no line of its own (0.9.3)', () => {
    const arc = { key: 'The Weir Bullion', kind: 'arc', status: 'active', fields: { desc: 'who sold the weir route' } };
    const empty = { now: null, place: '', arc, due: [], arriving: [], relevant: [], dormant: [], secrets: [], resolvedRecently: [] };
    const alone = buildNote(empty, { calendar: null }).split('\n');
    assert.equal(alone[1], 'Beats — The Weir Bullion (who sold the weir route)', 'every beat due or none left: the arc alone');
    assert.ok(!alone.some(line => line.startsWith('Arc:')));
    const riders = { key: 'Toll riders', kind: 'beat', status: 'active', fields: { desc: 'reach the ford', on: 'Goldwane 19' } };
    const withBeat = buildNote({ ...empty, relevant: [{ record: riders, reason: 'beat', priority: 2 }] }, { calendar: null }).split('\n');
    assert.equal(withBeat[1], 'Beats — The Weir Bullion (who sold the weir route): Toll riders — reach the ford (Goldwane 19)');
    // No arc: the beats line as before.
    assert.equal(buildNote({ ...empty, arc: null, relevant: [{ record: riders, reason: 'beat', priority: 2 }] }, { calendar: null }).split('\n')[1], 'Beats: Toll riders — reach the ford (Goldwane 19)');
});

test('with the agendas in the scene block\'s Off-Screen, the note leaves its Off-screen line out (0.9.3)', () => {
    const geva = { key: 'Geva', kind: 'agenda', status: 'active', fields: { now: 'Bailiff Court', then: 'files the warrant', on: 'Goldwane 17' } };
    const brant = { key: 'Brant', kind: 'agenda', status: 'active', fields: { now: 'on the road', arrive: 'Goldwane 16' } };
    const sel = { now: null, place: '', arc: null, due: [], arriving: [brant], relevant: [{ record: geva, reason: 'active', priority: 6 }], dormant: [], secrets: [], resolvedRecently: [] };
    assert.ok(buildNote(sel, { calendar: null }).split('\n').some(line => line.startsWith('Off-screen: Geva')));
    const lines = buildNote(sel, { calendar: null, offscreenInBlock: true }).split('\n');
    assert.ok(!lines.some(line => line.startsWith('Off-screen:')));
    assert.ok(lines.some(line => line.startsWith('Arriving: Brant')), 'arriving still told');
});

test('with capture writing the changes, the note carries no instruction', () => {
    const empty = { now: null, place: '', arc: null, due: [], arriving: [], relevant: [], dormant: [], secrets: [], resolvedRecently: [] };
    assert.equal(buildNote(empty, { calendar: null, instruction: '' }), '');
    const arc = { key: 'The Weir Bullion', kind: 'arc', status: 'active', fields: { desc: '' } };
    const note = buildNote({ ...empty, arc }, { calendar: null, instruction: '' });
    assert.ok(!/<Director>/.test(note));
    assert.ok(!note.endsWith('\n'));
});

test('quests: their own line, deadline wording when due, and the instruction names them', () => {
    const bounty = record({ key: 'Bounty on Kettle Jack', kind: 'quest', fields: { giver: 'Warden Hale', goal: 'bring him in alive', reward: '40 crowns', step: 'cornered at the weir', due: 'Goldwane 30' } });
    const note = buildNote(selection({ relevant: [bounty] }), { calendar });
    assert.ok(lines(note).includes('Quests: Bounty on Kettle Jack — bring him in alive · at: cornered at the weir · for Warden Hale · 40 crowns · by Goldwane 30'));
    assert.ok(note.includes(PACING), 'a deadline is a schedule');
    const due = buildNote(selection({ due: [bounty] }), { calendar });
    assert.ok(lines(due).includes('Due now: Bounty on Kettle Jack — deadline Goldwane 30 reached (bring him in alive)'));
    assert.match(CHANGE_INSTRUCTION, /quest \(a job \{\{user\}\} accepted, not an errand; a job only offered: \+ hook with giver, reward; done or failed: - it\): type, giver, goal, reward, step, due, difficulty\./);
});

test('quest difficulty: shown with the type unless it is normal', () => {
    const quest = (key, fields) => record({ key, kind: 'quest', fields: { goal: 'bring him in', ...fields } });
    const note = buildNote(selection({ relevant: [
        quest('Kettle Jack', { type: 'bounty', difficulty: 'hard' }),
        quest('Drowned Crown', { difficulty: 'nightmare' }),
        quest('Rat cellar', { type: 'side', difficulty: 'normal' }),
        quest('Herb run', {}),
    ] }), { calendar });
    assert.ok(lines(note).includes('Quests: Kettle Jack (bounty, hard) — bring him in · Drowned Crown (nightmare) — bring him in · Rat cellar (side) — bring him in · Herb run — bring him in'));
});

// (0.9.19)
test('reach: a due beat says how it touches {{user}}, a beat still ahead does not', () => {
    const sack = record({ key: 'Guards sack the Stray Oar', kind: 'beat', fields: {
        desc: 'drunken convoy guards wreck the taproom', on: 'Goldwane 16, 10:30 pm', place: 'Stray Oar',
        reach: 'the inn shuts for repairs; Marrit is out of work and asks Wessel for a charter' } });
    const due = buildNote(selection({ due: [sack] }), { calendar });
    assert.equal(lines(due)[1], 'Due now: Guards sack the Stray Oar (Goldwane 16, 10:30 pm) · reach: the inn shuts for repairs; Marrit is out of work and asks Wessel for a charter');

    const fight = record({ key: 'Ambush at the weir', kind: 'beat', fields: { on: 'Goldwane 16', encounter: '3 bandit', reach: 'the weir road closes' } });
    assert.equal(lines(buildNote(selection({ due: [fight] }), { calendar }))[1], 'Due now: Ambush at the weir (Goldwane 16) (fight: 3 bandit) · reach: the weir road closes');

    const ahead = buildNote(selection({ relevant: [record({ ...sack, fields: { ...sack.fields, on: 'Goldwane 19' } })] }), { calendar });
    assert.ok(lines(ahead).some(line => line.startsWith('Beats: Guards sack the Stray Oar')));
    assert.doesNotMatch(ahead, /reach/);

    // A long reach ends in "…" in the note only.
    const long = record({ ...sack, fields: { ...sack.fields, reach: Array.from({ length: 30 }, (_, i) => `w${i}`).join(' ') } });
    assert.match(lines(buildNote(selection({ due: [long] }), { calendar }))[1], / · reach: w0 .* w15…$/);
    assert.equal(NOTE_PART_WORDS.reach, 16);
});

test('encounters: a due fight names its foes, the kind lines show them compactly', () => {
    const ambush = record({ key: 'Ambush at the weir', kind: 'beat', fields: { desc: 'bandits hit the road', on: 'Goldwane 16', place: 'Weir road', encounter: '3 bandit, bandit captain (boss)' } });
    const due = buildNote(selection({ due: [ambush] }), { calendar });
    assert.equal(lines(due)[1], 'Due now: Ambush at the weir (Goldwane 16) (fight: 3 bandit, bandit captain (boss))');

    const raiders = record({ key: 'Raiders', fields: { leg: 'Shorn → Auvoth 120 B, ride 60/day → 2', arrive: 'Goldwane 16', encounter: '2 x raider rank D' } });
    const arriving = buildNote(selection({ arriving: [raiders] }), { calendar });
    assert.equal(lines(arriving)[1], 'Arriving: Raiders arrives Auvoth (Goldwane 16) (fight: 2 x raider rank D)');

    const later = record({ ...ambush, fields: { ...ambush.fields, on: 'Goldwane 19' } });
    const bounty = record({ key: 'Bounty on Kettle Jack', kind: 'quest', fields: { goal: 'bring him in alive', encounter: 'Kettle Jack (boss), 2 thug' } });
    const planned = buildNote(selection({ relevant: [later, bounty] }), { calendar });
    assert.ok(lines(planned).includes('Beats: Ambush at the weir — bandits hit the road (Goldwane 19) · fight: 3 bandit, bandit captain (boss)'));
    assert.ok(lines(planned).includes('Quests: Bounty on Kettle Jack — bring him in alive · fight: Kettle Jack (boss), 2 thug'));
    assert.ok(!lines(due).some(line => line.startsWith('Beats:')), 'a due fight is not repeated');
});

test('ENCOUNTER_CUE: short, and only while a due or arriving record carries a fight', () => {
    assert.ok(estimateTokens(ENCOUNTER_CUE) <= 35, `${estimateTokens(ENCOUNTER_CUE)} tokens`);
    assert.match(ENCOUNTER_CUE, /first blow/);
    assert.match(ENCOUNTER_CUE, /resolved outside the story/);
    const ambush = record({ key: 'Ambush at the weir', kind: 'beat', fields: { on: 'Goldwane 16', encounter: '3 bandit' } });
    const later = record({ ...ambush, fields: { on: 'Goldwane 19', encounter: '3 bandit' } });

    const due = buildNote(selection({ due: [ambush] }), { calendar });
    assert.equal(lines(due).at(-CHANGE_INSTRUCTION.split('\n').length - 1), `${PACING} ${ENCOUNTER_CUE}`);
    const captured = buildNote(selection({ due: [ambush] }), { calendar, instruction: '' });
    assert.equal(lines(captured).at(-1), `${PACING_NO_CHANGES} ${ENCOUNTER_CUE}`);

    assert.ok(!buildNote(selection({ relevant: [later] }), { calendar }).includes(ENCOUNTER_CUE), 'a planned fight not yet due');
    assert.ok(!buildNote(selection({ due: [sale] }), { calendar }).includes(ENCOUNTER_CUE), 'a due record without foes');
    assert.match(CHANGE_INSTRUCTION, /shown, encounter;/);
});

test('npcPlansOnly: one short line after the instruction, and only where change lines are asked for', () => {
    assert.ok(estimateTokens(NPC_PLANS_ONLY) <= 25, `${estimateTokens(NPC_PLANS_ONLY)} tokens`);
    assert.match(NPC_PLANS_ONLY, /NPC State Delta keeps who each NPC is/);
    assert.match(NPC_PLANS_ONLY, /what they plan and when/);
    const scene = selection({ due: [sale], relevant: [geva, fires] });

    // Alone (the default) the note is exactly as before.
    const alone = buildNote(scene, { calendar });
    assert.equal(buildNote(scene, { calendar, npcPlansOnly: false }), alone);
    assert.ok(!alone.includes(NPC_PLANS_ONLY));

    const deferring = buildNote(scene, { calendar, npcPlansOnly: true });
    assert.equal(deferring, `${alone}\n${NPC_PLANS_ONLY}`);
    assert.ok(lines(deferring).includes('Off-screen: Geva — Bailiff Court → files the warrant (Goldwane 17)'), 'the plan and its timing stay');
    assert.equal(buildNote(selection(), { calendar, npcPlansOnly: true }), `${CHANGE_INSTRUCTION}\n${NPC_PLANS_ONLY}`);

    // With capture writing the changes, the note asks for none, so there is nothing to steer.
    assert.equal(buildNote(scene, { calendar, instruction: '', npcPlansOnly: true }), buildNote(scene, { calendar, instruction: '' }));
});
