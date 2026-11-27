// What the narrator is sent about namesakes: Name "Nickname" in the people lists, and one line a shared name in the dynamic text. With unique names, or
// namesakes without nicknames, nothing differs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLinesContext } from '../../modules/people/core/core-prompts-lines-parts/context.js';
import { buildInjection } from '../../modules/people/core/core-injection.js';
import { ownerTargets } from '../../modules/people/npc-api/dossier-target.js';
import { host, fakeDelta, plain } from './storysuite-v2-meters.helpers.js';

const LINE = 'Several people are called Guard: write the nickname to say which (Old Tom, the gate guard).';
const guard = (id, aliases, extra = {}) => ({ id, name: 'Guard', aliases, present: true, role: 'sentry', personality: 'Dour.', ...extra });
const pair = () => [guard('npc_g1', ['Old Tom']), guard('npc_g2', ['the gate guard'])];
const times = (text, part) => text.split(part).length - 1;

test('the one-pass list shows Name "Nickname" and says the line once; the event list names them the same way', () => {
    const text = buildLinesContext({ existingNpcs: pair(), present: ['Guard "Old Tom"'], eventWatch: [{ key: 's1', id: 'npc_g2', name: 'Guard', note: 'sec_1', event: 'the oar is found' }] });
    const listed = JSON.parse(text.split('\n')[1]);
    assert.deepEqual(listed.map(item => item.name), ['Guard "Old Tom"', 'Guard "the gate guard"']);
    assert.equal(times(text, LINE), 1);
    assert.equal(text.split('\n')[2], LINE);
    assert.match(text, /sec_1 = Guard "the gate guard": the oar is found/);
});

test('without namesakes, or without a nickname for each, the list is the stored names and no line', () => {
    for (const people of [[guard('npc_g1', []), guard('npc_g2', [])], [guard('npc_g1', ['Old Tom']), guard('npc_g2', [])], [guard('npc_g1', ['Old Tom']), { ...guard('npc_g2', ['Red']), name: 'Sentry' }],
        [guard('npc_g1', ['Old Tom']), guard('npc_g2', ['the gate guard'], { lifeState: 'deceased', lifeStateCertainty: 'explicit' })]]) {
        const text = buildLinesContext({ existingNpcs: people });
        assert.doesNotMatch(text, /Several people|\\"/);
        assert.doesNotMatch(buildInjection(people, 'The Guard waits.'), /Several people|Guard "/);
    }
});

test('the dossier text shows them the same way; it says the line only when the list is not sent beside it', () => {
    const alone = buildInjection(pair(), 'The Guard waits.');
    assert.match(alone, /^- Guard "Old Tom": IDENTITY/m);
    assert.match(alone, /^- Guard "the gate guard": IDENTITY/m);
    assert.equal(times(alone, LINE), 1);
    assert.equal(times(buildInjection(pair(), 'The Guard waits.', 0, 3, undefined, undefined, null, { sayNamesakes: false }), LINE), 0);
    const called = buildInjection(pair().map(npc => ({ ...npc, present: false })), 'x', 0, 3, undefined, undefined, null, { namedNpcIds: ['npc_g2'] });
    assert.match(called, /^- Guard "the gate guard" \(named by player\): IDENTITY/m);
});

test('a mentioned namesake is listed with the nickname and the line', () => {
    const text = buildInjection(pair().map(npc => ({ ...npc, present: false })), 'Where is Old Tom? And the gate guard?');
    assert.match(text, /^- Guard "Old Tom" \(mentioned, not present/m);
    assert.equal(times(text, LINE), 1);
});

test('the shown form finds its person for presence', () => {
    assert.equal(ownerTargets(pair())('Guard "the gate guard"'), 'npc_g2');
    assert.equal(ownerTargets(pair())('Guard'), '');
});

test('the meter lines of the tail name each namesake by nickname', async () => {
    const records = Object.fromEntries(pair().map(npc => [npc.id, { ...npc, relationship: { trust: 1, affection: 0, desire: 0, tension: 0 } }]));
    const h = await host({ delta: Object.assign(fakeDelta(), { records }), linesMode: true, answers: {} });
    h.reply('Later.', '~ npc Old Tom | trust: +5');
    h.reply('Later.', '~ npc the gate guard | trust: +2');
    const sent = plain(h.def.context.tail(h.view()).lines).join('\n');
    assert.match(sent, /Guard "Old Tom" trust/);
    assert.match(sent, /Guard "the gate guard" trust/);
});
