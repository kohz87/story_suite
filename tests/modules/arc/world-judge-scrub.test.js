// Final review H1: the judge is told the unlearned secrets, so code keeps them out of its free text. A NOTE that quotes one is dropped (no
// "Arc and the world" line reaches the narrator), a refusal reason that quotes one (or the judge's own `refuse: secret`) becomes the fixed reason on
// the arc card and the accept receipt, and a reshaped line that quotes one is not used. The owner's name alone, or common words, is not a match.
import test from 'node:test';
import assert from 'node:assert/strict';

import { SECRET_REASON, scrubJudge, sharesSecret } from '../../../modules/arc/judge/scrub.js';
import { JUDGE_SYSTEM } from '../../../modules/arc/judge/prompt.js';
import { judgePlan } from '../../../modules/arc/judge/run.js';
import { readPlan } from '../../../modules/arc/plan.js';
import { OPENING, PLAN, TAIL_KEY, sent, said, setUp } from './world-judge.helpers.js';

const SECRET = 'She forged the Pontiff\'s seal on the writ.';
const SECRETS = [{ name: 'Temiwa', text: SECRET }];

test('sharesSecret: a quoted or re-punctuated clause matches; the name alone, common words or no secrets do not', () => {
    const texts = [SECRET];
    assert.equal(sharesSecret('The story must not contradict that Temiwa forged the Pontiff\'s seal.', texts), true);
    assert.equal(sharesSecret('it reveals that she FORGED -- the pontiffs seal', texts), false, 'a changed word breaks the run');
    assert.equal(sharesSecret('it reveals that she forged, the Pontiff\'s seal', texts), true, 'punctuation is not a word');
    assert.equal(sharesSecret('Temiwa watches the writ on the altar.', texts), false);
    assert.equal(sharesSecret('the seal on the gate', texts), false, 'one long word in the run is not enough');
    assert.equal(sharesSecret('forged the Pontiff\'s seal', []), false);
});

test('scrubJudge: NOTE dropped, reasons fixed, reshapes emptied; clean answers and the event refusal stay as they are', () => {
    const answer = { items: { 1: { verdict: 'refuse', rest: 'it reveals that she forged the Pontiff\'s seal' }, 2: { verdict: 'refuse', rest: 'secret' }, 3: { verdict: 'reshape', rest: 'BEAT: Writ — she forged the Pontiff\'s seal' }, 4: { verdict: 'refuse', rest: 'event "The succession"' }, 5: { verdict: 'reshape', rest: 'BEAT: Writ — a writ goes missing' }, 6: { verdict: 'accept', rest: '' } }, note: 'Temiwa forged the Pontiff\'s seal.' };
    const out = scrubJudge(answer, SECRETS);
    assert.deepEqual(out, { items: { 1: { verdict: 'refuse', rest: SECRET_REASON }, 2: { verdict: 'refuse', rest: SECRET_REASON }, 3: { verdict: 'reshape', rest: '' }, 4: answer.items[4], 5: answer.items[5], 6: answer.items[6] }, note: '' });
    assert.equal(scrubJudge({ items: {}, note: 'The March is uneasy.' }, SECRETS).note, 'The March is uneasy.');
    assert.equal(scrubJudge(null, SECRETS), null);
    assert.match(JUDGE_SYSTEM, /<n>: refuse: secret {3}\(the item reveals or hints at hidden lore or a secret not yet learned; never say which\)/);
    assert.match(JUDGE_SYSTEM, /The NOTE, the reasons and the corrected lines never name, quote or hint at hidden lore or a secret not yet learned\./);
});

test('judgePlan: the stored result carries no secret text (world note, refusal notes, reshaped beat)', async () => {
    const read = readPlan(PLAN);
    const text = `1: refuse: it reveals that she forged the Pontiff's seal\n2: reshape: BEAT: Settlement — she forged the Pontiff's seal\n3: accept\nNOTE: Temiwa forged the Pontiff's seal on the writ.`;
    const out = await judgePlan({ read, brief: { guard: [], secrets: SECRETS }, ask: () => null, api: { callModel: async () => ({ ok: true, text }) } });
    assert.equal(out.world, '');
    assert.deepEqual(out.refused, [`Refused: this beat was left out: ${SECRET_REASON}.`, 'Refused: this beat was left out: the Director\'s corrected line could not be used.']);
    assert.equal(JSON.stringify(out).toLowerCase().includes('forged'), false);
});

test('host: a NOTE and a reason quoting a secret never reach the narrator or the accept receipt; the fixed reason does', async () => {
    const judge = `1: refuse: it reveals that she forged the Pontiff's seal\n2: accept\n3: accept\nNOTE: The story must not contradict that Temiwa forged the Pontiff's seal.`;
    const t = await setUp(true, { judge: [judge], brief: { secrets: SECRETS } });
    try {
        await t.host.send('Begin.', OPENING);
        const planned = await t.arc.plan();
        assert.equal(planned.ok, true, planned.message);
        assert.match(t.judged[0].prompt, /Secrets not yet learned \(never reveal or hint at them in any item\):\n- Temiwa: She forged the Pontiff's seal on the writ\./, 'the judge is told the secret');
        assert.equal(planned.draft.world, undefined);
        const accepted = await t.arc.accept();
        assert.equal(accepted.ok, true);
        assert.match(accepted.receipt.summary, new RegExp(`Refused: this beat was left out: ${SECRET_REASON}\\.`));
        assert.equal(/forged/i.test(accepted.receipt.summary), false);
        await t.host.send('Next.', said('The square.', ['+ hook Square Talk — crowds']));
        const tail = sent(t.host, TAIL_KEY).at(-1);
        assert.match(tail, /^Arc: Succession/m);
        assert.equal(/Arc and the world:|forged/i.test(tail), false);
    } finally { t.done(); }
});
