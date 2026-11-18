// CHGFIX2: a failed repair is asked again by Re-read, one warning row per reply, the repair's own grammar and time lines, the time wall.
import test from 'node:test';
import assert from 'node:assert/strict';
import { assistSections } from '../../../core/capture.js';
import { SETTING, repairPrompt, whereWhy, REPAIR_KINDS, allowedKinds } from '../../../modules/assist/index.js';
import { createModule } from '../../../modules/director/module.js';
import { createHost } from '../../../testkit/index.js';
import { skip, wait } from './safety-net.helpers.js';

const BLOCKLESS = 'You pay Bob five coins and take a rope.';
const noChanges = host => host.turn.problems().filter(item => item.code === 'NO_CHANGES');

test('a failed repair is asked again by Re-read and the second answer is stored; one warning row, its text the latest outcome', { skip }, async () => {
    let n = 0;
    const host = await createHost({ callModel: async () => { n += 1; if (n < 3) throw new Error('no connection'); return '<Changes>\n+ item Rope | qty: 1\n</Changes>'; },
        settings: { modules: { 'story-block': { [SETTING.repair]: true } } } });
    const turn = await host.send('I pay.', BLOCKLESS);
    await wait(30);
    assert.equal(n, 1);
    assert.equal(noChanges(host).length, 1);
    assert.match(noChanges(host)[0].message, /the repair call failed/);
    await host.sdk.reread(turn.index);
    await wait(50);
    assert.equal(n, 2, 'Re-read asked again');
    assert.equal(noChanges(host).length, 1, 'still one row');
    assert.match(noChanges(host)[0].message, /the repair call failed/);
    await host.sdk.reread(turn.index);
    await wait(50);
    assert.equal(n, 3);
    assert.deepEqual(assistSections(host.ctx.chat[turn.index].mes).now, ['+ item Rope | qty: 1']);
    await host.sdk.reread(turn.index);
    await wait(50);
    assert.equal(n, 3, 'stored lines: no more calls');
    assert.deepEqual(noChanges(host), [], 'the repair stored lines: the warning row of the earlier miss is gone');
    host.close();
});

test('an empty answer is not retried by Re-read, and its row is replaced, not doubled', { skip }, async () => {
    const host = await createHost({ callModel: async () => '<Changes></Changes>', settings: { modules: { 'story-block': { [SETTING.repair]: true } } } });
    const turn = await host.send('I look.', 'Nothing happens.');
    await wait(30);
    await host.sdk.reread(turn.index);
    await wait(50);
    assert.equal(noChanges(host).length, 1);
    assert.match(noChanges(host)[0].message, /found nothing/);
    host.close();
});

const GRAMMAR = ['+ item Name | qty: 1 | note: x', '+ coin 30 | from: who. Pay each find once. Do not repeat loot already paid in an earlier reply.', '~ weather fog', '~ time 9:30 am ... ! time next morning',
    '+ hook|quest Name — long text for {{user}}', '~ place Name'];

test('the repair prompt: its own coin, item, hook and time lines, no weather, the persona for {{user}}, the story time clock first', () => {
    assert.equal(REPAIR_KINDS.includes('weather'), false);
    const prompt = repairPrompt('You pay.', GRAMMAR.filter(line => !/weather/.test(line)), ['Carried: Rope'], { time: 'June 3, 1200, 08:00 am' }, 'Astra');
    assert.match(prompt, /Story time now: 08:00 am, day June 3\n/);
    assert.equal(/earlier reply|\{\{user\}\}|Story date and time|weather/.test(prompt), false);
    assert.match(prompt, /never \+ item for something already under Carried/);
    assert.match(prompt, /never a price that is only talked about/);
    assert.match(prompt, /a job Astra accepted/);
    assert.match(prompt, /by dusk/);
});

test('the wall accepts what the foot teaches', () => {
    for (const raw of ['~ time 9:30 am', '! time +11h', '! time +2d']) {
        const [, op, name] = /^(\S) time (.*)$/.exec(raw) ? [0, raw[0], raw.slice(7)] : [];
        assert.equal(whereWhy({ op, kind: 'time', name }), '', raw);
    }
    assert.notEqual(whereWhy({ op: '!', kind: 'time', name: 'next morning' }), '');
    assert.equal(allowedKinds(REPAIR_KINDS).has('! time'), true);
});

for (const [what, said, line, plus] of [['by dusk', 'You work the ditch till dusk.', '! time +11h', 11 * 60], ['the next morning', 'You sleep and wake the next morning.', '! time +1d', 24 * 60]]) {
    test(`a reply with "${what}" and the repair's stretch line moves the clock by the stretch`, { skip }, async () => {
        let host = null;
        const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } });
        host = await createHost({ modules: [module], callModel: async () => `<Changes>\n${line}\n</Changes>`, settings: { modules: { 'story-block': { [SETTING.repair]: true } } } });
        await host.send('Hello.', 'Dawn.\n<Changes>\n~ time June 3, 1200, 07:15 am\n</Changes>');
        const before = host.sdk.query('director.time').minutes;
        const turn = await host.send('I go on.', said);
        await wait(60);
        assert.deepEqual(assistSections(host.ctx.chat[turn.index].mes).now, [line]);
        assert.equal(host.sdk.query('director.time').minutes - before, plus);
        assert.deepEqual(noChanges(host), []);
        host.close();
    });
}
