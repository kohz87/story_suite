// A horde through the fight kind on the real Foes block: the narrator's horde line (captured, then forgotten by a clear), the pre-check's words, the reserve built once
// at open, a horde carried over two replies that plays exactly the whole one, and a fled horde that never resumes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/index.js';
import { fightKind } from '../../../../modules/rpg/board/interaction.js';
import { dice } from '../../../../core/interaction/dice.js';
import { COMBAT_V1_TEMPLATES } from '../../../../modules/rpg/templates-combat.js';
import { resumeFoesV1 } from '../../../../modules/rpg/board/resume-v1.js';
import { reply } from '../../inventory/gear-inventory.helpers.js';

const set = (host, slug, fields) => host.sdk.command('dm.set', { module: `pack.chat/${slug}`, fields });
const FOES = 'pack.chat/foes';
const fields = host => host.head().domains.dataModules.instances[FOES].chat.fields;
async function world(t, { level = 8, lines = [] } = {}) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings: { features: { 'story-block.rpg': true } } });
    t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    for (const { definition } of COMBAT_V1_TEMPLATES) assert.equal((await host.sdk.command('dm.define', { definition: structuredClone(definition) })).ok, true);
    await set(host, 'character', { who: 'Ren' });
    await set(host, 'character', { level, str: 12, vit: 12, agi: 11 });
    await set(host, 'skills', { who: 'Ren' });
    if (lines.length) await host.send('They come.', reply('They pour through the breach.', lines));
    return host;
}
const RATS = '+ dm foes — rats pour in | kind: set-slot-1 | name: Rats | count: 2 | level: 1 | tier: mob';
const open = (host, args = {}) => fightKind.open(host.head(), { anchor: 'a', seed: 77, args: { rules: {}, ...args } }).setup;
const auto = host => ({ inputs: [{ actor: fightKind.actors(host.head())[0].id, choice: 'auto', args: {} }] });

test('the narrator\'s horde line is captured on the Foes block, and the fight opened on it builds its reserve from the front once', async t => {
    const host = await world(t, { lines: [RATS, '+ dm foes — more behind them | kind: horde | waves: 3 | hold: 6 | leader: Rat King'] });
    assert.deepEqual([fields(host).waves, fields(host).hold, fields(host).leader], [3, 6, 'Rat King']);
    const setup = open(host);
    assert.deepEqual(setup.horde, { v: 1, hold: 6, reserve: [
        { name: 'Rats', count: 2, level: 1, tier: 'mob' }, { name: 'Rats', count: 2, level: 1, tier: 'mob' },
        { name: 'Rat King', count: 1, level: 3, tier: 'boss', leader: true }] });
    assert.deepEqual(setup.groups, [1], 'the reserve never touches the Foes block');
});

test('any clear forgets the horde words, so the next fight on that block is an ordinary one; "none" names no leader', async t => {
    const host = await world(t, { lines: [RATS, '+ dm foes — more behind | kind: horde | waves: 2 | hold: 0 | leader: none'] });
    assert.deepEqual(open(host).horde, { v: 1, reserve: [{ name: 'Rats', count: 2, level: 1, tier: 'mob' }] });
    await host.send('They flee.', reply('They run.', ['- dm foes — they flee | kind: clear-1 | why: fled']));
    assert.deepEqual([fields(host).waves, fields(host).hold, fields(host).leader], [0, 0, '']);
    await host.send('Wolves.', reply('Wolves come.', ['+ dm foes — wolves | kind: set-slot-1 | name: Wolves | count: 2 | level: 2 | tier: standard']));
    assert.equal(Object.hasOwn(open(host), 'horde'), false);
});

test('the pre-check\'s words open a horde (a leader on the front is that group); bad words, no words and a resumed fight open none', async t => {
    const host = await world(t, { lines: [RATS] });
    assert.equal(Object.hasOwn(open(host), 'horde'), false, 'no words: an ordinary fight');
    assert.deepEqual(open(host, { horde: { waves: 2, until: 'leader', leader: 'rats' } }).horde, { v: 1, reserve: [], leaderSlot: 1 }, 'the leader standing on the front is not copied');
    assert.deepEqual(open(host, { horde: { waves: 40, until: 'hold', hold: 2 } }).horde.hold, 4, 'a hold under 4 is held to 4');
    assert.equal(open(host, { horde: { waves: 40 } }).horde.reserve.length, 7, 'waves past 8 are cut to 8, never refused');
    assert.equal(Object.hasOwn(open(host, { horde: { waves: 'many' } }), 'horde'), false);
    assert.equal(Object.hasOwn(open(host, { horde: { waves: 3 }, resumed: { foes: [{ id: '1.1', hp: 1 }] } }), 'horde'), false);
});

test('a horde carried over two replies plays exactly the whole horde: dice, arrivals, order and foe bars, through the real next()', async t => {
    const host = await world(t, { level: 30, lines: [RATS, '+ dm foes — more | kind: horde | waves: 5 | hold: 0 | leader: none'] });
    const setup = open(host), all = Array.from({ length: 12 }, () => auto(host));
    const whole = fightKind.play(host.head(), setup, all, dice(77, 0));
    assert.equal(whole.result.stop, 'won');
    assert.equal(whole.result.end, 'cleared');
    assert.equal(whole.result.foes.length, 10, 'the front and four waves');
    const cut = whole.result.rounds.findIndex(lines => lines.some(line => line[0] === 'arrive')) + 1;
    assert.ok(cut > 0 && cut < whole.result.exchanges, 'an arrival before the cut');
    const first = fightKind.settle(host.head(), setup, all.slice(0, cut), dice(77, 0));
    assert.equal(first.result.stop, 'open');
    assert.ok(first.result.foes.some(foe => String(foe.id).split('.').length === 3), 'the first reply carries arrivals');
    const state = structuredClone(host.head());
    for (const hurt of first.result.hurts) state.domains.dataModules.instances[hurt.module].chat.fields[hurt.field] = hurt.to;
    const next = fightKind.next(structuredClone(setup), structuredClone(first.result), state);
    assert.deepEqual(next.start.horde, first.result.horde);
    assert.deepEqual(next.horde, setup.horde, 'the reserve is the setup\'s, unchanged');
    const second = fightKind.play(state, next, all.slice(cut, whole.result.exchanges), dice(77, next.offset));
    assert.deepEqual([...first.result.lines, ...second.result.lines], whole.result.lines, 'the same lines, die for die');
    assert.deepEqual(second.result.foes, whole.result.foes);
    assert.deepEqual(second.result.horde, whole.result.horde);
    assert.equal(second.result.end, 'cleared');
});

test('a fled horde leaves nothing to resume', () => {
    const result = { board: { v1: 1, groups: [1] }, stop: 'fled', foes: [{ id: '1.1', label: 'Rats 1', hp: 1, maxHp: 1, level: 1, tier: 'mob' }, { id: '1.2', label: 'Rats 2', hp: 0, maxHp: 1, level: 1, tier: 'mob' }] };
    const receipt = value => ({ type: 'interaction.settle', data: { v2: { result: value } }, replan: { payload: { kindId: 'story-block/fight' } } });
    const slot = { slot: 1, name: 'Rats', count: 2, level: 1, tier: 'mob' };
    const plain = resumeFoesV1([receipt(result)], [slot]);
    const horde = resumeFoesV1([receipt({ ...result, horde: { next: 1, wave: 1, leader: null } })], [slot]);
    assert.equal(horde, null);
    assert.ok(plain === null || Array.isArray(plain.foes), 'an ordinary fled fight resumes as before');
});

test('the board shows each slot\'s latest wave and the "still coming" strip; an ended horde shows every foe and no strip', async t => {
    const host = await world(t, { level: 30, lines: [RATS, '+ dm foes — more | kind: horde | waves: 5 | hold: 9 | leader: Rat King'] });
    const setup = open(host), all = Array.from({ length: 12 }, () => auto(host));
    const first = fightKind.play(host.head(), setup, [], dice(77, 0));
    const before = fightKind.view(host.head(), setup, [], first);
    assert.deepEqual(before.horde, { wave: 'Wave 1 · 9 still coming', until: 'Hold 9 more exchanges · or until Rat King falls', down: 0 });
    const whole = fightKind.play(host.head(), setup, all, dice(77, 0));
    const cut = whole.result.rounds.findIndex(lines => lines.some(line => line[0] === 'arrive')) + 1, steps = all.slice(0, cut);
    const view = fightKind.view(host.head(), setup, steps, fightKind.play(host.head(), setup, steps, dice(77, 0)));
    assert.match(view.horde.wave, /^Wave 2 · \d+ still coming$/u);
    assert.equal(view.horde.until, `Hold ${9 - cut} more exchange${9 - cut === 1 ? '' : 's'} · or until Rat King falls`);
    assert.equal(view.horde.down, 2, 'the front fell');
    assert.deepEqual(view.foeGroups.map(group => [group.id, group.name, group.members.length]), [['1.1', 'Rats', 2]], 'the fallen front is not drawn, only the wave on its slot');
    assert.ok(view.log.some(round => round.rows.some(row => row.what === 'Reinforcements')));
    const ended = fightKind.view(host.head(), setup, all.slice(0, whole.result.exchanges), whole);
    assert.equal(Object.hasOwn(ended, 'horde'), false);
    assert.equal(ended.foeGroups.flatMap(group => group.members).length, whole.result.foes.length);
});

test('the horde line needs a slot set: alone, or before the slot lines, it is refused, so no stale words reach a later fight', async t => {
    const host = await world(t, { lines: ['+ dm foes — more may come | kind: horde | waves: 3 | hold: 0 | leader: none'] });
    assert.equal(fields(host).waves, 0, 'a lone horde line changes nothing');
    await host.send('Later.', reply('Wolves.', ['+ dm foes — more | kind: horde | waves: 2 | hold: 0 | leader: none', '+ dm foes — wolves | kind: set-slot-1 | name: Wolves | count: 2 | level: 2 | tier: standard']));
    assert.equal(fields(host).waves, 0, 'written before the slot line, it is refused too');
    assert.equal(Object.hasOwn(open(host), 'horde'), false, 'the wolves are an ordinary fight');
});
