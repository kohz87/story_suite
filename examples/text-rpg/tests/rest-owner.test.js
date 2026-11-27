// A chat's pattern: one reply with three groups of foes and two `+ xp` lines, then `~ rest` lines with no story clock, one of them written with a plain hyphen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readRecord } from '../../../core/persist.js';
import { parseLine } from '../../../core/capture/lines.js';
import { rollCards } from '../src/module-parts/roll-cards.js';
import { astraOf, reply, slice, withAstra } from './helpers/host.js';

const BATTLE = [
    '+ foes Lime-Shed Lookouts | count: 2 | kind: common',
    "+ foes Drent's Wharf-Guards | count: 4 | kind: common",
    '+ foes Scow Crossbowmen | count: 2 | kind: common',
    '? try Astra | Obscure | ordinary | against: Lime-Shed Lookouts',
    '+ xp Party — two lookouts down | foes: 2 | group: Lime-Shed Lookouts',
    "+ xp Party — four wharf-guards down | foes: 4 | group: Drent's Wharf-Guards",
    '- foes Scow Crossbowmen',
];
const full = member => member.pools.sp.now === member.pools.sp.max;
const sound = host => { const live = JSON.stringify(slice(host)); host.store.rebuild(); assert.equal(JSON.stringify(slice(host)), live, 'rebuild == live'); assert.deepEqual(host.store.problems(), []); };
const xps = host => host.store.receipts().map(entry => entry.receipt).filter(receipt => receipt.type === 'capture.xp');
const group = (host, id) => slice(host).foes.groups[id];

async function battle(t, lines = BATTLE) {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Fight.', reply('The landing.', lines));
    return host;
}
// Spends stamina in one reply, then rests with `line` in the next.
async function restAfterSpend(host, line) {
    await host.send('Spend.', reply('Spent.', ['~ spend Astra — Obscure']));
    assert.equal(full(astraOf(host)), false);
    await host.send('Rest.', reply('Rest.', [line]));
    assert.equal(full(astraOf(host)), true, line);
}

test('a second `+ xp` naming another group counts it down for no XP, and the rest in the very next reply refills', async t => {
    const host = await battle(t);
    const [first, second] = xps(host);
    assert.ok(first.data.amount > 0);
    assert.equal(second.summary, "Drent's Wharf-Guards: 4 counted down; one xp line pays a reply.");
    assert.deepEqual(second.data, { amount: 0, foes: 4, levels: 0, touched: ['drent-s-wharf-guards'] });
    assert.deepEqual([group(host, 'drent-s-wharf-guards').left, group(host, 'drent-s-wharf-guards').fell], [0, 4]);
    assert.equal(astraOf(host).xp, first.data.amount);
    const card = rollCards()['text-rpg-rolls'].for(host.head(), null, { index: host.ctx.chat.length - 1, query: (...args) => host.sdk.query(...args) });
    assert.match(card.rows.at(-1).text, /^Earned: .* · Drent's Wharf-Guards: 4 counted down; one xp line pays a reply\.$/);
    assert.equal(full(astraOf(host)), false, 'the try cost stamina');
    await host.send('Camp.', reply('Camp.', ['~ rest Party — night']));
    assert.equal(full(astraOf(host)), true);
    await restAfterSpend(host, '~ rest Party — night');
    await restAfterSpend(host, '~ rest Party - short');
    sound(host);
});

test('a spaced hyphen splits the name from the text; a hyphen inside a name does not', () => {
    const read = line => { const { name, text } = parseLine(line); return [name, text]; };
    assert.deepEqual(read('~ rest Party - short'), ['Party', 'short']);
    assert.deepEqual(read('+ foes Shale-Horn Cows | count: 7 | kind: common'), ['Shale-Horn Cows', '']);
    assert.deepEqual(read('~ rest Lime-Shed Lookouts - short'), ['Lime-Shed Lookouts', 'short']);
});

test('the same group again, a line with no group, or a name that is not standing stays refused; a group is counted once a reply', async t => {
    const host = await battle(t, [...BATTLE.slice(0, 4),
        '+ xp Party — one lookout down | foes: 1 | group: Lime-Shed Lookouts',
        '+ xp Party — the other | foes: 1 | group: Lime-Shed Lookouts',
        '+ xp Party — someone | foes: 1',
        '+ xp Party — rats | foes: 1 | group: Rats',
        "+ xp Party — a guard | foes: 1 | group: Drent's Wharf-Guards",
        "+ xp Party — another guard | foes: 1 | group: Drent's Wharf-Guards"]);
    assert.equal(xps(host).length, 2);
    assert.deepEqual([group(host, 'lime-shed-lookouts').left, group(host, 'drent-s-wharf-guards').left], [1, 3]);
    assert.equal(host.turn.problems('text-rpg').filter(item => /Only one xp line/.test(item.message)).length, 4);
    sound(host);
});

test('a group the first line spread over is not counted again by a later line', async t => {
    const host = await battle(t, ['+ foes Hogs | count: 3 | kind: common', '+ xp Party — a hog | foes: 1', '+ xp Party — the same hog | foes: 1 | group: Hogs']);
    assert.equal(group(host, 'hogs').left, 2);
    sound(host);
});

test('a reply captured before the rule keeps the second line refused on Re-read', async t => {
    const host = await battle(t);
    const index = host.ctx.chat.length - 1;
    const record = readRecord(host.ctx.chat[index]);
    record.rules.splice(record.rules.indexOf('xpCountsDown'), 1);
    assert.equal((await host.sdk.reread(index)).ok, true);
    assert.equal(group(host, 'drent-s-wharf-guards').left, 4);
    assert.equal(xps(host).length, 1);
    assert.deepEqual(Object.keys(host.head().meta.claims).filter(key => key.startsWith('xp-group:')), []);
    sound(host);
});

test('swiping away the reply and deleting it take the counted-down foes with it', async t => {
    const host = await battle(t);
    await host.swipe(reply('Again.', BATTLE));
    assert.equal(group(host, 'drent-s-wharf-guards').left, 0);
    sound(host);
    await host.st.deleteMessage(host.ctx.chat.length - 1);
    assert.equal(slice(host).foes?.groups?.['drent-s-wharf-guards'], undefined);
    sound(host);
});
