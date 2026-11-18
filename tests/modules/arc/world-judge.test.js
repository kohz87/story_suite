// The Director judge (switch story-director.world-events): one Quick call after the planner judges the plan's beats, clocks and agendas against the world and the lore
// (accept / reshape / refuse) and writes the arc's world note; code has the last word. The refusal for an Active event is the adopted note, the others a reason note;
// no answer in time leaves the code guard's result; with the switch off nothing here runs.
import test from 'node:test';
import assert from 'node:assert/strict';

import { refusalNote } from '../../../modules/arc/plan.js';
import { validateArc } from '../../../modules/arc/domain.js';
import { judgePlan } from '../../../modules/arc/judge/run.js';
import { readJudge } from '../../../modules/arc/judge/read.js';
import { readPlan } from '../../../modules/arc/plan.js';
import { NOTE, OPENING, PLAN, setUp } from './world-judge.helpers.js';

const keys = draft => draft.text.split('\n').map(line => line.replace(/^[A-Z]+: ([^—|]+).*$/, '$1').trim());

test('accept: every item stays, the tally and the world note are in the draft, the judge asked once and told the world', async () => {
    const t = await setUp(true);
    try {
        await t.host.send('Begin.', OPENING);
        const brief = t.host.sdk.query('chronicle.world.brief', {});
        assert.deepEqual([brief.protectedCast, brief.hidden], [['Aldric'], ['The Vault']], 'the brief names the protected cast and the hidden lore titles');
        const out = await t.arc.plan();
        assert.equal(out.ok, true);
        assert.deepEqual(keys(out.draft), ['Succession', 'Refugees', 'Settlement', 'Rumours', 'Letter']);
        assert.deepEqual(out.draft.judge, { calls: 1, accept: 3, reshape: 0, refuse: 0, fell: false });
        assert.equal(out.draft.world, NOTE.slice(6));
        assert.equal(t.judged.length, 1);
        const prompt = t.judged[0].prompt;
        assert.match(prompt, /^Arc: Succession — a crown in doubt\nActive world events \(the world settles them\):\n- The succession — The king is dead\./);
        assert.match(prompt, /Protected cast \(never killed, moved or changed by a plan\): Aldric/);
        assert.match(prompt, /Hidden lore, titles only \(never reveal or hint\): The Vault/);
        assert.match(prompt, /Lore titles: The Crown\nLore for here:\nThe Crown: The crown passes by the high lords' vote\./);
        assert.doesNotMatch(prompt, /SECRET-VAULT-TEXT/, 'hidden lore: the title only, never its text');
        assert.match(prompt, /Items:\n1: BEAT: Refugees — families leave Highmark\n2: BEAT: Settlement — the lords settle who rules\n3: CLOCK: Rumours — whispers grow \| due: June 5, 08:00 am$/, 'beats, clocks and agendas only, numbered');
    } finally { t.done(); }
});

test('refuse for an Active event: the item is left out with the adopted note on the card; refuse for another reason: a reason note', async () => {
    const t = await setUp(true, { judge: ['1: accept\n2: refuse: event "The succession"\n3: refuse: names Aldric, who is protected.\nNOTE: Quiet.'] });
    try {
        await t.host.send('Begin.', OPENING);
        const out = await t.arc.plan();
        assert.deepEqual(keys(out.draft), ['Succession', 'Refugees', 'Letter']);
        assert.deepEqual(out.draft.refused, [refusalNote('beat', 'The succession'), 'Refused: this clock was left out: names Aldric, who is protected.']);
        assert.equal(out.draft.refused[0], 'Refused: this beat decides how the world event "The succession" ends; the world resolves it by itself. Plan a reaction instead.');
        assert.deepEqual(out.draft.findings.slice(-2).map(entry => entry.severity), ['warn', 'warn']);
        assert.deepEqual(out.draft.judge, { calls: 1, accept: 1, reshape: 0, refuse: 2, fell: false });
        const accepted = await t.arc.accept();
        assert.match(accepted.receipt.summary, /^New arc: Succession \(1 beat, 1 hook\)\. Refused: this beat decides how the world event "The succession" ends.* Refused: this clock was left out: names Aldric/);
    } finally { t.done(); }
});

test('reshape: a corrected line the strict reader and the guard accept replaces the item; one that does not read, is another kind or decides the event is a refusal', async () => {
    const good = await setUp(true, { judge: ['1: accept\n2: reshape: BEAT: Lords Quarrel — the lords argue over who should rule\n3: accept\nNOTE: x'] });
    try {
        await good.host.send('Begin.', OPENING);
        const out = await good.arc.plan();
        assert.deepEqual(keys(out.draft), ['Succession', 'Refugees', 'Lords Quarrel', 'Rumours', 'Letter']);
        assert.deepEqual(out.draft.judge, { calls: 1, accept: 2, reshape: 1, refuse: 0, fell: false });
        assert.deepEqual(out.draft.refused, undefined);
    } finally { good.done(); }
    for (const [why, line] of [['unreadable', 'nonsense'], ['another kind', 'HOOK: Quarrel — the lords argue'], ['decides the event', 'BEAT: Crown — heir-crowned at dusk'], ['a name already in the plan', 'BEAT: Refugees — more of them']]) {
        const t = await setUp(true, { judge: [`1: accept\n2: reshape: ${line}\n3: accept\nNOTE: x`] });
        try {
            await t.host.send('Begin.', OPENING);
            const out = await t.arc.plan();
            assert.deepEqual(keys(out.draft), ['Succession', 'Refugees', 'Rumours', 'Letter'], why);
            assert.deepEqual(out.draft.refused, ['Refused: this beat was left out: the Director\'s corrected line could not be used.'], why);
            assert.deepEqual(out.draft.judge, { calls: 1, accept: 2, reshape: 0, refuse: 1, fell: false }, why);
        } finally { t.done(); }
    }
});

test('no usable answer (an error, no verdict lines, a refused call): the code guard\'s result stands, the plan is not blocked', async () => {
    for (const judge of [[new Error('rate limited')], ['Sure! Here is my opinion.']]) {
        const t = await setUp(true, { judge });
        try {
            await t.host.send('Begin.', OPENING);
            const out = await t.arc.plan();
            assert.equal(out.ok, true);
            assert.deepEqual(keys(out.draft), ['Succession', 'Refugees', 'Settlement', 'Rumours', 'Letter']);
            assert.deepEqual(out.draft.judge, { calls: 1, accept: 0, reshape: 0, refuse: 0, fell: true });
            assert.equal(out.draft.world, undefined);
        } finally { t.done(); }
    }
    const read = readPlan(PLAN);
    const base = { read, brief: { guard: [] }, ask: () => null };
    for (const answer of [{ ok: false, error: 'TIMEOUT' }, { ok: false, error: 'FAILED' }, { ok: true, text: '' }]) {
        const out = await judgePlan({ ...base, api: { callModel: async () => answer } });
        assert.equal(out.read, read, 'the same plan, untouched');
        assert.deepEqual(out.judge, { calls: 1, accept: 0, reshape: 0, refuse: 0, fell: true });
        assert.equal(out.world, '');
    }
    for (const error of ['BUSY', 'ABORTED', 'UNAVAILABLE', 'FEATURE_OFF']) assert.equal((await judgePlan({ ...base, api: { callModel: async () => ({ ok: false, error }) } })).judge, null, `${error}: not a call`);
    assert.equal((await judgePlan({ ...base, api: { callModel: async () => { throw new Error('boom'); } } })).judge.fell, true);
    assert.equal((await judgePlan({ ...base, brief: null, api: { callModel: async () => assert.fail('no brief, no call') } })).judge, null);
});

test('the judge\'s empty-plan outcome: every item refused is the guard\'s unusable plan', async () => {
    const t = await setUp(true, { plans: ['<plan>\nARC: A — b\nBEAT: Settlement — the lords settle who rules\n</plan>'], judge: ['1: refuse: event "The succession"\nNOTE: x'] });
    try {
        await t.host.send('Begin.', OPENING);
        const out = await t.arc.plan();
        assert.equal(out.ok, false);
        assert.match(out.message, /The plan has no beats, agendas, hooks, clocks or secrets\./);
    } finally { t.done(); }
});

test('readJudge: strict lines; the first line for an item counts; the note is cut; no verdict line is null', () => {
    assert.equal(readJudge('Looks fine to me.'), null);
    const out = readJudge('<think>hm</think>\n**1**: accept\n2) reshape - BEAT: X — y\n2: accept\n3: refuse: event "E"\nnote: ' + 'w '.repeat(400));
    assert.deepEqual(Object.fromEntries(Object.entries(out.items).map(([n, row]) => [n, row.verdict])), { 1: 'accept', 2: 'reshape', 3: 'refuse' });
    assert.equal(out.items[2].rest, 'BEAT: X — y');
    assert.ok(out.note.length <= 481);
});

test('the arc record validates: judge and world are optional, whole and short', () => {
    const base = { id: 'arc_abcd1234', key: 'A', desc: '', rev: 1, minutes: null, reason: 'manual', note: '' };
    const check = extra => validateArc({ arcs: { arc_abcd1234: { ...base, ...extra } }, ends: {} });
    assert.deepEqual(check({}), []);
    assert.deepEqual(check({ world: 'x', judge: { calls: 1, accept: 1, reshape: 0, refuse: 0, fell: false } }), []);
    assert.equal(check({ world: 5 }).length, 1);
    assert.equal(check({ world: 'x'.repeat(2000) }).length, 1);
    assert.equal(check({ judge: { calls: -1, accept: 0, reshape: 0, refuse: 0, fell: false } }).length, 1);
    assert.equal(check({ judge: { calls: 1, accept: 0, reshape: 0, refuse: 0 } }).length, 1);
});
