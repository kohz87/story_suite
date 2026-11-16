// rpg.board.hurts and rpg.board.clearFoes on the REAL handlers through the REAL bus: no screen may call them, a settle (cause system) may,
// and a damaged payload is refused whole (INTERACTION-PLAN §1.3 step 6: a kind must not rely on a cap this file does not show).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readSheet } from '../../../../src/v2/lean-rpg/read.js';
import { fxHost } from './interaction.helpers.js';

const run = (host, type, payload, cause = 'system') => host.bus.run(type, payload, { cause });
const foe = host => readSheet(host.head()).foes[0];

test('both commands are internal: a screen (cause ui) is refused, the settle (cause system) is let in', async () => {
    const host = await fxHost();
    try {
        const slot = foe(host), hurts = [{ module: slot.module, field: 'hurt1', to: 3 }];
        for (const [type, payload] of [['rpg.board.hurts', { hurts }], ['rpg.board.clearFoes', { groups: [1], foes: [{ slot: 1, module: slot.module, local: 1, filled: true }] }]]) {
            const refused = run(host, type, payload, 'ui');
            assert.equal(refused.ok, false, type);
            assert.equal(refused.code, 'REFUSED', type);
        }
        const done = run(host, 'rpg.board.hurts', { hurts });
        assert.equal(done.ok, true, done.message);
        assert.equal(readSheet(done.state).foes[0].hurt, 3, 'the foe\'s new bar is written');
        assert.equal(foe(host).hurt, slot.hurt, 'and only on the state the run returns');
    } finally { host.close(); }
});

test('a damaged payload is refused whole and writes nothing', async () => {
    const host = await fxHost();
    try {
        const slot = foe(host), good = { module: slot.module, field: 'hurt1', to: 3 }, before = JSON.stringify(host.head().domains.dataModules);
        for (const bad of [null, {}, { hurts: 'x' }, { hurts: [{ ...good, to: -1 }] }, { hurts: [{ ...good, to: 'a' }] }, { hurts: [{ ...good, module: '' }] }, { hurts: Array(100).fill(good) }]) {
            const out = run(host, 'rpg.board.hurts', bad);
            assert.equal(out.ok, false, JSON.stringify(bad)?.slice(0, 60));
            assert.equal(out.code, 'INVALID');
        }
        for (const bad of [{}, { groups: [], foes: [] }, { groups: [0], foes: [] }, { groups: [1], foes: [{ slot: 1, module: slot.module, filled: false }] }, { groups: [1], foes: [{ slot: 'a', module: slot.module, filled: true }] }, { groups: Array(65).fill(1), foes: [] }]) {
            const out = run(host, 'rpg.board.clearFoes', bad);
            assert.equal(out.ok, false, JSON.stringify(bad)?.slice(0, 60));
            assert.equal(out.code, 'INVALID');
        }
        assert.equal(JSON.stringify(host.head().domains.dataModules), before, 'nothing was written');
    } finally { host.close(); }
});

test('clearFoes empties the named groups only, by the block\'s own clear kind', async () => {
    const host = await fxHost();
    try {
        const slot = foe(host), out = run(host, 'rpg.board.clearFoes', { groups: [1], foes: [{ slot: 1, module: slot.module, local: 1, filled: true }] });
        assert.equal(out.ok, true, out.message);
        assert.equal(readSheet(out.state).foes.filter(item => item.filled).length, 0, 'the group left the block');
        assert.equal(out.receipt.data.cleared.length, 1);
        assert.equal(foe(host).filled, true, 'the live head is untouched');
    } finally { host.close(); }
});
