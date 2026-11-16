// USER 3 Nov: "+ coin 3 silver 6 copper | from: Marrit" was refused and the pay lost. A coin line whose numbers each name
// a known coin adds them up in the smallest unit, live and on Re-read/rebuild alike; bare or unknown parts stay refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount } from '../../../../modules/inventory/money.js';

const COPPER = { name: 'copper', plural: 'copper', coins: [{ name: 'copper', plural: 'copper', value: 1 }, { name: 'silver', plural: 'silver', value: 10 }, { name: 'gold', plural: 'gold', value: 100 }] };

test('mixed known coins add up; a thousands comma is still one number', () => {
    for (const [text, amount] of [['3 silver 6 copper', 36], ['3 silver, 6 copper', 36], ['3 silver and 6 copper', 36], ['1 gold 2 silver 3 copper', 123], ['1,200 copper 3 silver', 1230]]) {
        assert.deepEqual(parseAmount(text, COPPER), { amount }, text);
    }
});

test('anything not made only of known coins is refused, never guessed and never loops', () => {
    for (const text of ['30 5', '3 silver 6', '3 silver 6 copper 2 apples', '3 silver 0 copper', '3 silver 5 pennies']) {
        assert.match(parseAmount(text, COPPER).error, /more than one number/, text);
    }
});

test('a coin line may name several coins: "4 silver 5 copper" is 45, "1 gold 2 silver" is 120, "+ coin 35" is 35', () => {
    assert.deepEqual(parseAmount('4 silver 5 copper', COPPER), { amount: 45 });
    assert.deepEqual(parseAmount('1 gold 2 silver', COPPER), { amount: 120 });
    assert.deepEqual(parseAmount('35', COPPER), { amount: 35 });
});

test('a decimal is refused visibly, alone or among coins', () => {
    for (const text of ['2.5 silver', '4 silver 2.5 copper', '1.5']) assert.ok(parseAmount(text, COPPER).error, text);
});

test('custom coin names and ratios add up by their own worth', () => {
    const custom = { name: 'mark', plural: 'marks', coins: [{ name: 'mark', plural: 'marks', value: 1 }, { name: 'shilling', plural: 'shillings', value: 12 }, { name: 'crown', plural: 'crowns', value: 240 }] };
    assert.deepEqual(parseAmount('1 crown 2 shillings 5 marks', custom), { amount: 269 });
    assert.deepEqual(parseAmount('3 shillings and 6 marks', custom), { amount: 42 });
    assert.ok(parseAmount('3 silver 6 marks', custom).error, 'a coin this chat does not have is refused');
});
