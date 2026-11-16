// Tests for src/planner.js: summarizeTracker, buildPlannerMessages, encounters, reach and autoPlanReason.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseChanges } from '../src/changes.js';
import { NPC_PLANS_ONLY } from '../src/note.js';
import { replay } from '../src/tracker.js';
import {
    DEFAULT_PLANNER_PROMPT,
    LOW_THREADS_REPLIES,
    arcBeats,
    autoPlanReason,
    buildPlannerMessages,
    openThreads,
    noteAfterAccept,
    parsePlan,
    planToOps,
    summarizeTracker,
    validatePlan,
} from '../src/planner.js';
import { calendar, now } from './planner.helpers.js';

// --- summarizeTracker --------------------------------------------------------------------

test('summarizeTracker: an empty tracker', () => {
    assert.equal(summarizeTracker({ version: 1, records: [], message: -1, time: null }), '(nothing tracked yet)');
    assert.equal(summarizeTracker(null), '(nothing tracked yet)');
});

test('summarizeTracker: active records by kind, soonest first, then resolved', () => {
    const lines = text => parseChanges(text).ops;
    const { tracker } = replay([
        {
            message: 1,
            time: now,
            text: '',
            ops: lines([
                '+ agenda Geva — now: Bailiff Court | then: files the warrant | on: Haywane 17',
                '+ agenda Brant — now: frontier road | then: reaches Auvoth | on: Haywane 14',
                '+ event Canal Street fires — curfew in force',
                '+ hook River stranger — who pulled Ren from the sump',
                '+ clock Hollin\'s Reach graves — the dead rise | due: Haywane 28 | shown: sign',
                '+ secret Kade\'s buyer — the Highmark legation',
                '+ beat Bells at the weir — the sluice fails | on: Haywane 13',
            ].join('\n')),
        },
        { message: 2, time: now, text: '', ops: lines('- Bells at the weir — the sluice held') },
    ]);

    assert.equal(summarizeTracker(tracker, { calendar }), [
        'Off-screen:',
        '- Brant — frontier road → reaches Auvoth (Haywane 14)',
        '- Geva — Bailiff Court → files the warrant (Haywane 17)',
        'World:',
        '- Canal Street fires — curfew in force',
        'Hooks:',
        '- River stranger — who pulled Ren from the sump',
        'Clocks:',
        '- Hollin\'s Reach graves — the dead rise (Haywane 28)',
        'Secrets:',
        '- Kade\'s buyer — the Highmark legation',
        'Resolved:',
        '- Bells at the weir — the sluice held',
    ].join('\n'));

    // Without a calendar the tracker order is kept.
    assert.match(summarizeTracker(tracker), /Off-screen:\n- Geva .*\n- Brant /);
});

// --- buildPlannerMessages ----------------------------------------------------------------

test('buildPlannerMessages fills macros and leaves the rest as written', () => {
    const messages = buildPlannerMessages({
        template: 'T {{now}} | {{place}} | {{nearby}} | {{note}} | {{genre}} | {{previous_arc}} | {{tracker}} | {{recent}} | {{user}} {{char}} {{mystery}}',
        recent: 'Geva: The vote is $& tomorrow.',
        trackerSummary: '(nothing tracked yet)',
        nowText: 'CY 611, Haywane 12, 05:35 pm',
        place: 'Auvoth',
        nearby: ['Shorn', 'Varnhold Watch'],
        genre: 'political intrigue',
        previousArc: 'The Flood — the levee broke',
    });
    assert.deepEqual(messages, [
        {
            role: 'system',
            content: 'T CY 611, Haywane 12, 05:35 pm | Auvoth | Shorn, Varnhold Watch | (none) | political intrigue | The Flood — the levee broke | (nothing tracked yet) | Geva: The vote is $& tomorrow. | {{user}} {{char}} {{mystery}}',
        },
        { role: 'user', content: 'Plan the next arc. Answer only with the <plan> block.' },
    ]);
});

test('buildPlannerMessages with the default prompt leaves only {{user}} and {{char}}', () => {
    const [system, user] = buildPlannerMessages({ nowText: 'Haywane 12', place: 'Auvoth' });
    assert.equal(system.role, 'system');
    assert.equal(user.role, 'user');
    const left = new Set(system.content.match(/\{\{[^}]*\}\}/g));
    assert.deepEqual([...left].sort(), ['{{char}}', '{{user}}']);
    assert.match(system.content, /Now: Haywane 12\nPlace: Auvoth\n/);
    assert.equal(buildPlannerMessages({ template: '' })[0].content, buildPlannerMessages()[0].content);
});

test('buildPlannerMessages with npcPlansOnly asks for agendas as plans and timing, in any template', () => {
    const alone = buildPlannerMessages({ nowText: 'Haywane 12' });
    assert.deepEqual(buildPlannerMessages({ nowText: 'Haywane 12', npcPlansOnly: false }), alone);
    const [system, user] = buildPlannerMessages({ nowText: 'Haywane 12', npcPlansOnly: true });
    assert.equal(system.content, alone[0].content, 'the system prompt is untouched');
    assert.equal(user.content, `Plan the next arc. Answer only with the <plan> block. ${NPC_PLANS_ONLY}`);
    const custom = buildPlannerMessages({ template: 'Plan {{now}}.', nowText: 'Haywane 12', npcPlansOnly: true });
    assert.equal(custom[0].content, 'Plan Haywane 12.');
    assert.ok(custom[1].content.endsWith(NPC_PLANS_ONLY), 'a reader\'s own template gets it too');
});

test('the default prompt asks for the plan lines and assumes no setting', () => {
    for (const macro of ['recent', 'tracker', 'now', 'place', 'nearby', 'note', 'genre', 'previous_arc', 'user', 'char']) {
        assert.ok(DEFAULT_PLANNER_PROMPT.includes(`{{${macro}}}`), macro);
    }
    for (const label of ['ARC:', 'BEAT:', 'AGENDA:', 'HOOK:', 'CLOCK:', 'SECRET:']) {
        assert.ok(DEFAULT_PLANNER_PROMPT.includes(label), label);
    }
    assert.match(DEFAULT_PLANNER_PROMPT, /<plan>[\s\S]*<\/plan>/);
    // (0.9.19) 640: the reach part and its rule.
    assert.ok(DEFAULT_PLANNER_PROMPT.split(/\s+/).length <= 640);

    // The template's own example block is itself a readable plan.
    const example = parsePlan(DEFAULT_PLANNER_PROMPT.slice(DEFAULT_PLANNER_PROMPT.indexOf('<plan>')));
    assert.ok(example.arc);
    assert.equal(example.items.length, 5);
    assert.deepEqual(example.errors, []);
});

// --- encounters ----------------------------------------------------------------------------

test('parsePlan and planToOps carry a fight beat\'s encounter', () => {
    const plan = parsePlan([
        '<plan>',
        'ARC: The Weir Bullion — who sold the weir route',
        'BEAT: Ambush at the weir — the legation\'s hirelings strike | on: in 2 days | place: Weir road | encounter: 3 bandit, bandit captain (boss)',
        '</plan>',
    ].join('\n'), { calendar, now });
    assert.deepEqual(plan.errors, []);
    const [beat] = plan.items;
    assert.equal(beat.kind, 'beat');
    assert.deepEqual(beat.fields, { desc: 'the legation\'s hirelings strike', on: 'Haywane 14, 05:35 pm', place: 'Weir road', encounter: '3 bandit, bandit captain (boss)' });

    const [, op] = planToOps(plan, { arcId: 'arc-3' });
    assert.equal(op.raw, '+ beat Ambush at the weir — the legation\'s hirelings strike | on: Haywane 14, 05:35 pm | place: Weir road | encounter: 3 bandit, bandit captain (boss) | arc: arc-3');
    const { ops: back } = parseChanges(op.raw);
    assert.equal(back[0].fields.encounter, '3 bandit, bandit captain (boss)');
    const { tracker } = replay([{ message: 0, time: now, text: '', ops: [op] }]);
    assert.equal(tracker.records[0].fields.encounter, '3 bandit, bandit captain (boss)');
    assert.equal(tracker.records[0].arc, 'arc-3');
});

test('an ENCOUNTER line is a beat with its foes, from encounter:, the description or the key', () => {
    const plan = parsePlan([
        '**ENCOUNTER:** Wolves on the ridge — 2 x dire wolf rank D | on: tomorrow at dusk',
        'ENCOUNTER: Kettle Jack\'s stand — he will not go quietly | encounter: Kettle Jack (boss), 2 thug | on: Haywane 16',
        'Encounter 2: 1 river troll (boss) | place: the weir',
    ].join('\n'), { calendar, now });
    assert.deepEqual(plan.errors, []);
    assert.deepEqual(plan.items.map(item => [item.kind, item.key, item.fields.encounter, item.fields.desc]), [
        ['beat', 'Wolves on the ridge', '2 x dire wolf rank D', undefined],
        ['beat', 'Kettle Jack\'s stand', 'Kettle Jack (boss), 2 thug', 'he will not go quietly'],
        ['beat', '1 river troll (boss)', '1 river troll (boss)', undefined],
    ]);
    assert.equal(plan.items[0].fields.on, 'Haywane 13, 07:00 pm');
});

test('the default prompt plans fights sparingly, and stays within 640 words', () => {
    const rule = DEFAULT_PLANNER_PROMPT.split('\n').find(line => line.includes('encounter:'));
    assert.ok(rule, 'a rule for fights');
    assert.match(rule, /BEAT/);
    assert.match(rule, /at most 1 or 2 per arc/);
    assert.match(rule, /named as the story names them/);
    const words = DEFAULT_PLANNER_PROMPT.split(/\s+/).length;
    assert.ok(words <= 640, `${words} words`);
    // The rule's example is itself readable as a fight beat.
    const example = rule.match(/"(\| encounter: [^"]+)"/)[1];
    assert.equal(parsePlan(`BEAT: Ambush ${example}`).items[0].fields.encounter, '3 bandit, bandit captain (boss)');
});

// --- reach (0.9.19) -------------------------------------------------------------------------

test('the default prompt asks every beat for its reach, and leaves the response to {{user}}', () => {
    const format = DEFAULT_PLANNER_PROMPT.split('\n').find(line => line.startsWith('BEAT:'));
    assert.match(format, /\| reach: how it touches \{\{user\}\} if they are elsewhere$/);
    const rule = DEFAULT_PLANNER_PROMPT.split('\n').find(line => line.startsWith('- Every beat reaches'));
    assert.ok(rule, 'a rule for reach');
    assert.match(rule, /\{\{user\}\} wherever they are/);
    assert.match(rule, /the response stays \{\{user\}\}'s/);
    // The format line's own example keeps its reach.
    const example = parsePlan(DEFAULT_PLANNER_PROMPT.slice(DEFAULT_PLANNER_PROMPT.indexOf('<plan>')));
    assert.equal(example.items.find(item => item.kind === 'beat').fields.reach, 'how it touches {{user}} if they are elsewhere');
});

test('parsePlan and planToOps carry a beat\'s reach into the + beat line and the tracker', () => {
    const plan = parsePlan([
        '<plan>',
        'ARC: Convoy season — the guards run the village',
        '**BEAT:** Guards sack the Stray Oar — drunken convoy guards wreck the taproom | on: tomorrow at dusk | place: Stray Oar, Bluewatch Village | reach: the inn shuts for repairs; Marrit is out of work and asks Wessel for a charter',
        'BEAT: Toll on the ford — the guards charge for the crossing | after: Guards sack the Stray Oar | reach: every crossing costs a silver',
        '</plan>',
    ].join('\n'), { calendar, now });
    assert.deepEqual(plan.errors, []);
    const [sack, toll] = plan.items;
    assert.deepEqual(sack.fields, {
        desc: 'drunken convoy guards wreck the taproom', on: 'Haywane 13, 07:00 pm', place: 'Stray Oar, Bluewatch Village',
        reach: 'the inn shuts for repairs; Marrit is out of work and asks Wessel for a charter',
    });
    assert.equal(toll.fields.reach, 'every crossing costs a silver');
    assert.deepEqual(toll.extra, { after: 'Guards sack the Stray Oar' });
    assert.deepEqual(validatePlan(plan, { calendar, now, userName: 'Wessel' }), []);

    const [, op, tollOp] = planToOps(plan, { arcId: 'arc-4' });
    assert.equal(op.raw, '+ beat Guards sack the Stray Oar — drunken convoy guards wreck the taproom | on: Haywane 13, 07:00 pm | place: Stray Oar, Bluewatch Village | reach: the inn shuts for repairs; Marrit is out of work and asks Wessel for a charter | arc: arc-4');
    assert.equal(tollOp.raw, '+ beat Toll on the ford — the guards charge for the crossing | reach: every crossing costs a silver | after: Guards sack the Stray Oar | arc: arc-4');
    const { ops: back } = parseChanges([op.raw, tollOp.raw].join('\n'));
    assert.equal(back[0].fields.reach, 'the inn shuts for repairs; Marrit is out of work and asks Wessel for a charter');
    const { tracker } = replay([{ message: 0, time: now, text: '', ops: back }]);
    assert.equal(tracker.records[0].fields.reach, 'the inn shuts for repairs; Marrit is out of work and asks Wessel for a charter');
    assert.equal(tracker.records[1].fields.reach, 'every crossing costs a silver');
    assert.equal(tracker.records[1].extra.reach, undefined, 'a field, not an extra');
});

test('summarizeTracker marks a planned fight', () => {
    const { tracker } = replay([{ message: 0, time: now, text: '', ops: parseChanges('+ beat Ambush at the weir — on: Haywane 14 | encounter: 3 bandit').ops }]);
    assert.match(summarizeTracker(tracker), /- Ambush at the weir \(Haywane 14\) · fight: 3 bandit/);
});

test('a planned offer of work keeps its difficulty as one of the four words', () => {
    const plan = parsePlan('<plan>\nARC: Wolf winter — the packs come down\nHOOK: Wolf pelts — the tanner pays for pelts | reward: 2 silver each | difficulty: Tough\n</plan>');
    assert.equal(plan.items[0].kind, 'hook');
    assert.equal(plan.items[0].fields.difficulty, 'hard');
    const [, hook] = planToOps(plan, { arcId: 'arc-1' });
    assert.equal(hook.raw, '+ hook Wolf pelts — the tanner pays for pelts | reward: 2 silver each | difficulty: hard | arc: arc-1');
});

test('the Director\'s note is spent once the arc it shaped is accepted', () => {
    assert.equal(noteAfterAccept('Bring the twins home.', 'Bring the twins home.'), '');
    assert.equal(noteAfterAccept('  Bring the twins home. ', 'Bring the twins home.'), '');
    // kept when asked, when edited after the plan was made, or when no note was used
    assert.equal(noteAfterAccept('Bring the twins home.', 'Bring the twins home.', { keep: true }), 'Bring the twins home.');
    assert.equal(noteAfterAccept('Slow down for a while.', 'Bring the twins home.'), 'Slow down for a while.');
    assert.equal(noteAfterAccept('Slow down for a while.', ''), 'Slow down for a while.');
    assert.equal(noteAfterAccept('', ''), '');
    assert.equal(noteAfterAccept(undefined, 'x'), '');
});

// (0.9.19) When Automatic planning plans: the three old reasons, and running low.
function story(...replies) {
    const { tracker } = replay(replies.map((text, message) => ({ message, time: now, text: '', ops: parseChanges(text).ops })));
    const arc = tracker.records.filter(record => record.kind === 'arc' && record.status === 'active').at(-1) ?? null;
    return { tracker, arc };
}

const ARC = '+ arc The Weir Bullion — who sold the weir route | arc: arc-1';
const SOON = '+ beat Council session opens — on: Haywane 14 | arc: arc-1';
const FAR = '+ beat The vote — on: Emberwane 20 | arc: arc-1';
const reasonOf = ({ tracker, arc }, options = {}) => autoPlanReason({ tracker, arc, now, calendar, ...options });

test('autoPlanReason: no arc yet plans once the story has records', () => {
    assert.equal(reasonOf(story()), null, 'nothing to plan from');
    assert.equal(reasonOf(story('+ hook River stranger — who pulled Ren from the sump')), 'no-arc');
    // Not held back by the running-low wait.
    assert.equal(reasonOf(story('+ hook River stranger — who pulled Ren from the sump'), { repliesSincePlan: 0 }), 'no-arc');
});

test('autoPlanReason: every beat played out ends the arc', () => {
    const played = story([ARC, SOON].join('\n'), '- Council session opens — it happened');
    assert.equal(arcBeats(played.tracker, played.arc).total, 1);
    assert.equal(reasonOf(played), 'arc-end');
    assert.equal(reasonOf(played, { lowThreads: 0, repliesSincePlan: 0 }), 'arc-end');
    // An arc with no beats at all is not over (it may still be running low).
    assert.equal(reasonOf(story(ARC), { lowThreads: 0 }), null);
});

test('autoPlanReason: stalled when no beat is due within the stall window', () => {
    const late = story([ARC, '+ beat The vote — on: Haywane 22 | arc: arc-1', '+ hook A', '+ hook B', '+ clock C — the dead rise | due: Haywane 28'].join('\n'));
    assert.equal(reasonOf(late), 'stalled', '10 days off, 7-day window');
    assert.equal(reasonOf(late, { stallDays: 14 }), null);
    assert.equal(reasonOf(late, { stallDays: 0 }), 'stalled', '0 is the 7-day default, as before');
    assert.equal(reasonOf(late, { repliesSincePlan: 0 }), 'stalled', 'not held back by the running-low wait');
    // A beat without a date counts as due; without a scene time there is no stall check.
    assert.equal(reasonOf(story([ARC, '+ beat Someday — it comes | arc: arc-1', '+ hook A', '+ hook B'].join('\n'))), null);
    assert.equal(autoPlanReason({ ...late, now: null, calendar }), null);
});

test('autoPlanReason: running low when fewer than lowThreads hooks, clocks and beats are open', () => {
    const thin = story([ARC, SOON, '+ hook River stranger — who pulled Ren from the sump'].join('\n'));
    assert.equal(openThreads(thin.tracker, thin.arc), 2);
    assert.equal(reasonOf(thin), 'running-low', '2 open, default 3');
    assert.equal(reasonOf(thin, { lowThreads: 2 }), null, 'fewer than, not at');
    assert.equal(reasonOf(thin, { lowThreads: 0 }), null, '0 is off');
    const enough = story([ARC, SOON, '+ hook River stranger — who pulled Ren', "+ clock Hollin's Reach graves — the dead rise | due: Haywane 28"].join('\n'));
    assert.equal(openThreads(enough.tracker, enough.arc), 3);
    assert.equal(reasonOf(enough), null);
    assert.equal(reasonOf(enough, { lowThreads: 4 }), 'running-low');
});

test('autoPlanReason: offers, quests, agendas, events, secrets and other arcs do not count as open threads', () => {
    const lines = [
        ARC, SOON, '+ hook River stranger — who pulled Ren',
        '+ hook Wolf pelts — the tanner pays for pelts | reward: 2 silver each',
        '+ hook Escort job — guard the barge | giver: Nelke',
        '+ quest Find the twins — they went north',
        '+ agenda Geva — now: Bailiff Court | then: files the warrant | on: Haywane 17',
        '+ event Canal Street fires — curfew in force',
        '+ secret Brant is the informer — he sold the route',
        '+ beat Old business — on: Haywane 13 | arc: arc-0',
        '+ hook Gone quiet — nobody asks any more',
    ];
    const busy = story(lines.join('\n'), '- Gone quiet — settled');
    assert.equal(openThreads(busy.tracker, busy.arc), 2, 'one beat, one hook that is not an offer');
    assert.equal(reasonOf(busy), 'running-low');
});

test('autoPlanReason: running low waits for the story to move on after a plan', () => {
    const thin = story([ARC, FAR].join('\n'));
    assert.equal(reasonOf(thin, { stallDays: 365 }), 'running-low', 'no plan yet');
    assert.equal(reasonOf(thin, { stallDays: 365, repliesSincePlan: 0 }), null);
    assert.equal(reasonOf(thin, { stallDays: 365, repliesSincePlan: LOW_THREADS_REPLIES - 1 }), null);
    assert.equal(reasonOf(thin, { stallDays: 365, repliesSincePlan: LOW_THREADS_REPLIES }), 'running-low');
    // Far beats with nothing else open: stalled comes first when the window is short.
    assert.equal(reasonOf(thin), 'stalled');
});
