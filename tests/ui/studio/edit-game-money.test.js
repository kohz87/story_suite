// The game pack's Money editor (ST-GMONEY, mock MK-7): the currency fields, the coins table (kept in order of worth, each row saying what the
// checker would refuse), the prices card, the "Not set" cards for a section the pack leaves out, the checker's problems, and the fallbacks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { editSection } from '../../../studio/edit/game-money.js';

const GAME = JSON.parse(readFileSync(new URL('../../packs/studio/fixtures/game4-mini.json', import.meta.url), 'utf8'));

function setup(key = 'currency', change = content => content, opts = {}) {
    installFakeDom();
    const pack = structuredClone(GAME);
    change(pack.content);
    const calls = [];
    const ctx = { doc: pack, kind: 'game', legacy: false, other: null, problems: opts.problems ?? [], focus: null,
        commit: patches => { calls.push(patches); return { ok: true }; }, go: () => {}, keep: () => ({}), ...opts.ctx };
    const root = document.createElement('div');
    root.append(...editSection({ key, where: 'content', value: pack.content[key], count: 1 }, ctx));
    return { root, calls, pack };
}
const field = (root, key) => root.querySelector(`[data-key="${key}"]`);
const set = (node, value, event = 'change') => { node.value = value; node.dispatch(event); };
const cell = (root, row, col) => root.querySelector(`.st-trow[data-row="${row}"] [data-col="${col}"] input`);

test('the currency fields: each edit is one patch, trimmed; a blank plural or short is removed, a blank name is refused', () => {
    const { root, calls } = setup();
    assert.deepEqual(['name', 'plural', 'short'].map(key => field(root, key).querySelector('input').value), ['penny', 'pennies', 'p']);
    set(field(root, 'name').querySelector('input'), ' mark ');
    set(field(root, 'plural').querySelector('input'), '');
    set(field(root, 'short').querySelector('input'), 'toolongshort');
    set(field(root, 'name').querySelector('input'), '');
    assert.deepEqual(calls, [
        [{ op: 'set', path: ['content', 'currency', 'name'], value: 'mark' }],
        [{ op: 'remove', path: ['content', 'currency', 'plural'] }],
    ]);
    assert.match(field(root, 'short').querySelector('.st-problem').textContent, /at most 8 characters/);
    assert.match(field(root, 'name').querySelector('.st-problem').textContent, /Name is needed/);
});

test('the coins table: no move buttons, worth in the coin worth 1, the foot counts and chains the coins', () => {
    const { root } = setup('currency', content => { content.currency.coins.splice(1, 0, { name: 'shilling', value: 10 }); });
    const table = root.querySelector('.st-table[data-key="coins"]');
    assert.match(table.querySelector('.gt').textContent, /Coins · 3/);
    assert.match(table.querySelector('.st-tnote').textContent, /counted in the coin worth 1, here penny/);
    assert.equal(table.querySelector('.st-up'), null);
    assert.deepEqual(table.querySelectorAll('.st-trow').map(row => row.querySelector('[data-col="name"] input').value), ['penny', 'shilling', 'crown']);
    assert.equal(cell(table, 0, 'plural').value, 'pennies');
    assert.equal(cell(table, 1, 'plural').getAttribute('placeholder'), 'Blank: the name');
    assert.equal(table.querySelector('.st-tcount').textContent, '3 of 8 coins · 1 crown = 10 shilling = 100 pennies');
});

test('coin edits: a name or plural is one list patch; a new worth puts the list back in order of worth; Add and remove', () => {
    const { root, calls } = setup();
    set(cell(root, 1, 'name'), 'crown ');
    assert.equal(calls.length, 0, 'the same name makes no edit');
    set(cell(root, 1, 'name'), 'sovereign');
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: ['content', 'currency', 'coins'], value: [{ name: 'penny', plural: 'pennies', value: 1 }, { name: 'sovereign', plural: 'crowns', value: 100 }] }]);
    set(cell(root, 0, 'plural'), '');
    assert.deepEqual(calls.at(-1)[0].value[0], { name: 'penny', value: 1 });
    set(cell(root, 1, 'value'), '0.5');
    set(cell(root, 0, 'value'), '500');
    assert.deepEqual(calls.at(-1)[0].value.map(coin => [coin.name, coin.value]), [['crown', 100], ['penny', 500]]);
    root.querySelector('.st-table .st-tadd').click();
    assert.deepEqual(calls.at(-1)[0].value.at(-1), { name: 'new coin', value: 1000 });
    root.querySelector('.st-trow[data-row="0"] .st-remove').click();
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: ['content', 'currency', 'coins'], value: [{ name: 'crown', plural: 'crowns', value: 100 }] }]);
    const last = setup('currency', content => { content.currency.coins = [{ name: 'penny', value: 1 }]; });
    last.root.querySelector('.st-remove').click();
    assert.deepEqual(last.calls.at(-1), [{ op: 'remove', path: ['content', 'currency', 'coins'] }], 'the last coin takes the list out');
});

test('each coin row says what the checker would refuse: a digit, a name twice, a worth out of range; at most 8 coins', () => {
    const coins = [{ name: 'silver2', value: 10 }, { name: 'Crown', value: 1 }, { name: 'crown', value: 5 }, { name: 'gold', value: 2000000 }];
    const { root } = setup('currency', content => { content.currency.coins = coins; });
    const problems = root.querySelectorAll('.st-trow').map(row => row.querySelector('.st-tprob')?.textContent ?? '');
    assert.match(problems[0], /can't hold digits or \| : # < > \//);
    assert.equal(problems[1], '');
    assert.match(problems[2], /Another coin is called crown/);
    assert.match(problems[3], /Worth is a whole number from 1 to 1,000,000/);
    assert.ok(root.querySelector('.st-trow[data-row="0"] [data-col="name"]').classList.contains('bad'));
    const full = setup('currency', content => { content.currency.coins = Array.from({ length: 8 }, (_, n) => ({ name: `coin ${'abcdefgh'[n]}`, value: 10 ** Math.min(n, 6) })); });
    assert.ok(full.root.querySelector('.st-tadd').hasAttribute('disabled'));
});

test('no coins: the empty line, and Add makes the money\'s own name the coin worth 1', () => {
    const { root, calls } = setup('currency', content => { delete content.currency.coins; });
    assert.match(root.querySelector('.st-tempty').textContent, /No coins: amounts are written as a number of pennies/);
    root.querySelector('.st-tadd').click();
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: ['content', 'currency', 'coins'], value: [{ name: 'penny', value: 1 }] }]);
});

test('the prices card: the scale (blank is 1, out of range refused), the note, and a field it does not take', () => {
    const { root, calls } = setup('economy', content => { content.economy = { scale: 2, note: 'Coin is dear.', odd: true }; });
    assert.equal(field(root, 'scale').querySelector('input').value, '2');
    set(field(root, 'scale').querySelector('input'), '0.01');
    set(field(root, 'scale').querySelector('input'), '5000');
    set(field(root, 'scale').querySelector('input'), '');
    set(field(root, 'note').querySelector('textarea'), '  ');
    field(root, 'odd').querySelector('.st-dropkey').click();
    assert.deepEqual(calls, [
        [{ op: 'set', path: ['content', 'economy', 'scale'], value: 0.01 }],
        [{ op: 'remove', path: ['content', 'economy', 'scale'] }],
        [{ op: 'remove', path: ['content', 'economy', 'note'] }],
        [{ op: 'remove', path: ['content', 'economy', 'odd'] }],
    ]);
    assert.match(field(root, 'scale').querySelector('.st-problem').textContent, /runs from 0\.001 to 1000/);
});

test('a section the pack leaves out is a Not set card with Set it here', () => {
    const { root, calls } = setup();
    const prices = root.querySelector('.st-notset[data-key="economy"]');
    assert.match(prices.textContent, /Prices.*Not set: the Built-in game's/);
    prices.querySelector('.st-setit').click();
    assert.deepEqual(calls.at(-1), [{ op: 'set', path: ['content', 'economy'], value: { scale: 1 } }]);
    const only = setup('economy', content => { delete content.currency; content.economy = { scale: 1 }; });
    only.root.querySelector('.st-notset[data-key="currency"] .st-setit').click();
    assert.deepEqual(only.calls.at(-1), [{ op: 'set', path: ['content', 'currency'], value: { name: 'coin' } }]);
    assert.equal(setup('currency', content => { content.economy = { scale: 1 }; }).root.querySelector('.st-notset'), null);
});

test('the checker\'s problems show under the fields; its whole-list coins problem shows when no row explains it', () => {
    const problems = [
        { path: 'content.currency', message: 'currency must be { "name": "mark" }.' },
        { path: 'content.currency.coins', message: 'currency.coins must be 1 to 8 coins.' },
    ];
    const { root } = setup('currency', c => c, { problems });
    assert.match(field(root, 'name').querySelector('.st-problem').textContent, /currency must be/);
    assert.match(root.querySelector('.st-table > .st-problem').textContent, /must be 1 to 8 coins/);
    const explained = setup('currency', content => { content.currency.coins[0].name = 'p3nny'; }, { problems });
    assert.equal(explained.root.querySelector('.st-table > .st-problem'), null);
    const economy = setup('economy', content => { content.economy = { scale: 0 }; }, { problems: [{ path: 'content.economy.scale', message: 'economy.scale must be a number from 0.001 to 1000.' }] });
    assert.match(field(economy.root, 'scale').querySelector('.st-problem').textContent, /must be a number/);
});

test('a format 3 pack, a world pack, or a section that is not an object falls back to the read-only cards', () => {
    assert.equal(setup('currency', c => c, { ctx: { legacy: true } }).root.querySelector('.st-currency'), null);
    assert.equal(setup('currency', c => c, { ctx: { kind: 'world' } }).root.querySelector('.st-currency'), null);
    assert.equal(setup('currency', content => { content.currency = 'penny'; }).root.querySelector('.st-currency'), null);
    assert.ok(setup().root.querySelector('.st-currency'));
});
