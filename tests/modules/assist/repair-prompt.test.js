// CHGFIX3: the approved repair-prompt tweaks (coin name, a generic time example, the Wallet line naming the coins), the persona reaching the prompt on a real host,
// the Models row on by default with its hint, the wall's time hint, and a repair coin line that carries a heal or XP label.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTING, repairPrompt, whereWhy, refusedWhy, REPAIR_FOOT } from '../../../modules/assist/index.js';
import { createModule } from '../../../ui/legacy/director/module.js';
import { selectCalls } from '../../../ui/select/calls.js';
import { createHost } from '../../../testkit/index.js';
import { skip, wait } from './safety-net.helpers.js';

test('the coin line asks for the coin name; the time example is generic, not worked out from one story time', () => {
    const prompt = repairPrompt('You pay.', ['+ coin 30 | from: who'], [], null, 'Astra');
    assert.match(prompt, /- \+ coin 30 gold \| from: who \(- coin 8 copper \| to: who\): write the coin name the reply uses; only coin that changes hands/);
    assert.match(REPAIR_FOOT, /morning to dusk is about ! time \+10h/);
    assert.equal(/07:15|\+11h/.test(REPAIR_FOOT), false);
});

test('on a real host the persona\'s name reaches the repair prompt, the Wallet line names the coins and the time line carries no date', { skip }, async () => {
    let host = null;
    const prompts = [];
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } });
    host = await createHost({ realDefaults: true, modules: [module], callModel: async prompt => { prompts.push(prompt); return '<Changes></Changes>'; } });
    host.ctx.name1 = 'Astra';
    await host.send('Hello.', 'Dawn.\n<Changes>\n~ time June 3, 1200, 07:15 am\n</Changes>');
    await host.send('I go on.', 'You walk on with no block.');
    await wait(60);
    assert.equal(prompts.length, 1, 'repair is on with nothing stored');
    assert.match(prompts[0], /a job Astra accepted/);
    assert.equal(/\{\{user\}\}/.test(prompts[0]), false);
    assert.match(prompts[0], /Wallet \(before this reply\): [^\n]*\(coins: [a-z, ]+\)/);
    assert.match(prompts[0], /Story time now: 07:15 am, day June 3\n/);
    host.close();
});

test('the wall\'s time hint shows the two forms the prompt teaches', () => {
    const why = whereWhy({ op: '~', kind: 'time', name: 'Goldwane 12, 9:30 am' });
    const text = whereWhy({ op: '!', kind: 'time', name: 'next morning' });
    assert.match(text, /write a time like "~ time 9:30 am" or "! time \+2h"/);
    assert.equal(typeof why, 'string');
});

test('the Models row is ON when nothing is stored (the default), off only when stored off, and its hint says repaired lines can be discarded per reply', () => {
    const row = calls => selectCalls(calls, []).find(item => item.key === 'calls.repair');
    assert.equal(row({}).value, true, 'nothing stored: on');
    assert.equal(row({ repair: true }).value, true);
    assert.equal(row({ repair: false }).value, false);
    assert.match(row({}).hint, /Repaired lines can be discarded per reply/);
    assert.equal(/undo/i.test(row({}).hint), false);
    assert.equal(SETTING.repair, 'assistRepair');
});

test('a repair coin line may carry from/to labels, never a heal, XP or reward label', () => {
    const coin = labels => ({ op: '-', kind: 'coin', name: '8 copper', labels });
    assert.equal(refusedWhy(coin({ to: 'Gerrit' }), null, { repair: true }), '');
    for (const label of ['heal', 'xp', 'reward']) assert.notEqual(refusedWhy(coin({ [label]: '5' }), null, { repair: true }), '', label);
});
