// A reply with no `hitWear` rule mark wears nothing from a roll: a bad failure with a hit asks the inventory for nothing, and the receipt and the card carry no wear.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { applyTry } from '../src/module-parts/kinds/try.js';
import { rollsOf } from '../src/module-parts/rolls.js';
import { SID, astra, fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';

test('a bad failure with a hit with a weapon and armour worn calls no gear.wear and records no wear', () => {
    const calls = [];
    const query = name => (name === 'gear.view' ? { slots: { weapon: { name: 'Sword', rarity: 'common', broken: false }, body: { name: 'Mail', rarity: 'common', broken: false } } } : null);
    const slice = sliceOf([astra()], { list: [1, 1, 1], floor: 0 });
    const done = run(applyTry, fakeCtx(slice, { query, call: (...args) => { calls.push(args); return { data: {} }; } }), line('try', 'Astra', 'str; ordinary', { hit: 'a spear' }));
    assert.equal(done.result.data.band, 'bad');
    assert.equal(done.result.data.paid, 'wound');
    assert.deepEqual(calls, []);
    assert.equal('worn' in done.result.data, false);
    assert.equal(rollsOf([{ index: 2, receipt: { type: 'capture.try', data: { member: 'ac_astra001', target: 'str', die: 1, band: 'bad', worn: [{ slot: 'weapon' }] } } }], 2).rolls[0].worn, undefined);
    assert.ok(SID);
});

test('the wear helper and its README section are gone', () => {
    assert.equal(existsSync(new URL('../src/module-parts/kinds/wear.js', import.meta.url)), false);
    assert.doesNotMatch(readFileSync(new URL('../README.md', import.meta.url), 'utf8'), /gear\.wear|data\.worn|wears the member/);
});
