// B1.6: "+ quest Name" on an accepted hook keeps the hook's summary and labels; a new label adds only itself.
// R0-R5 are the replay checks (audit 7.1 rule 3). No rule mark: the code is unchanged, so an old long line and the new short one agree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/host.js';
import { createModule } from '../../../../ui/legacy/director/module.js';
import { part } from '../../../../modules/time/tracker/index.js';

const HOOK = '+ hook Missing boatman — Person A says he vanished | giver: Person A | goal: ask at the docks';
const changes = (...lines) => `<Changes>\n${lines.join('\n')}\n</Changes>`;
const quest = h => h.sdk.query('director.threads', {}).find(thread => thread.key === 'Missing boatman');
const state = h => JSON.stringify(h.head());

async function accepted(t, questLine) {
    const h = await createHost({ modules: [createModule()] });
    t.after(() => h.close());
    await h.send('Hello.', 'A greeting.');
    await h.send('What needs doing?', changes(HOOK));
    await h.send('I will help.', changes('~ hook Missing boatman | progress: listening'));
    await h.send('Deal.', changes(questLine));
    return h;
}

test('+ quest Name alone keeps the hook summary, giver and goal', async t => {
    const h = await accepted(t, '+ quest Missing boatman');
    const q = quest(h);
    assert.equal(q.kind, 'quest');
    assert.equal(q.summary, 'Person A says he vanished');
    assert.deepEqual(q.fields, { giver: 'Person A', goal: 'ask at the docks', progress: 'listening' });
    assert.deepEqual(h.store.problems(), []);
});

test('a new label adds only itself', async t => {
    const h = await accepted(t, '+ quest Missing boatman | reward: 20 copper');
    assert.deepEqual(quest(h).fields, { giver: 'Person A', goal: 'ask at the docks', progress: 'listening', reward: '20 copper' });
    assert.equal(quest(h).summary, 'Person A says he vanished');
});

test('R0: the old long line and the new short line give the same quest', async t => {
    const old = await accepted(t, '+ quest Missing boatman — Person A says he vanished | giver: Person A | goal: ask at the docks | reward: 20 copper');
    const now = await accepted(t, '+ quest Missing boatman | reward: 20 copper');
    const strip = ({ id, acceptance, rev, taken, ...rest }) => rest;
    assert.deepEqual(strip(quest(old)), strip(quest(now)));
});

test('R1-R5: Re-read, swipe, edit, Continue and rebuild keep the quest once', async t => {
    const h = await accepted(t, '+ quest Missing boatman | reward: 20 copper');
    const at = h.ctx.chat.length - 1;
    const live = state(h);
    // R1
    assert.equal((await h.turn.reread(at)).ok, true);
    assert.equal(state(h), live);
    // R4: a Continue with prose only applies nothing twice
    await h.cont('The boatman is found soon.');
    assert.equal(JSON.stringify(quest(h).fields), JSON.stringify({ giver: 'Person A', goal: 'ask at the docks', progress: 'listening', reward: '20 copper' }));
    const afterContinue = state(h);
    // R3: a prose edit changes nothing; a line edit is computed once from the new line
    const text = h.ctx.chat[at].mes;
    await h.st.editMessage(at, `Rewritten prose.\n${text.slice(text.indexOf('<Changes>'))}`);
    assert.equal(state(h), afterContinue);
    await h.st.editMessage(at, changes('+ quest Missing boatman | reward: 30 copper'));
    assert.equal((await h.turn.reread(at)).ok, true);
    assert.equal(quest(h).fields.reward, '30 copper');
    assert.equal(quest(h).fields.giver, 'Person A');
    // R2: a swipe builds its own state; going back restores the first
    const first = state(h);
    await h.swipe(changes('+ quest Missing boatman | reward: 5 copper'));
    assert.equal(quest(h).fields.reward, '5 copper');
    await h.st.swipeTo(at, 0);
    assert.equal(state(h), first);
    // R5: a delete of an earlier exchange and a rebuild give the live state
    await h.st.deleteMessage(1);
    await h.st.deleteMessage(0);
    const liveAfter = state(h);
    h.store.rebuild();
    assert.equal(state(h), liveAfter);
    assert.deepEqual(h.store.problems(), []);
});

test('the hook grammar teaches the bare quest line', () => {
    const grammar = part.kinds.hook.grammar;
    assert.ok(grammar.includes('once {{user}} accepts it, + quest with the hook\'s name alone: code keeps its summary and labels, add only new ones'));
    assert.ok(grammar.includes('once {{user}} agrees: + quest Missing boatman | reward: 20 copper'));
});
