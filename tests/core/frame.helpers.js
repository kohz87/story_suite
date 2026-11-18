// Helpers of the chat frame tests: a host with a format 4 world and game installed, the packs to swap in, and the reads the tests compare.
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';

const REQ = { suite: '^0.1' };
const place = { id: 'dock', name: 'The Dock', x: 1, y: 1 };
export const world = (version = '1.0.0') => ({ id: 'w1', format: 4, kind: 'world', version, name: 'Ersveil', requires: REQ, content: { places: [place], items: [], start: { place: 'dock' } } });
export const game = (id, months, coin, version = '1.0.0') => ({ id, format: 4, kind: 'game', version, name: id, requires: REQ, content: { calendar: { months }, currency: { name: coin, coins: [{ name: coin, value: 1 }] } } });
export const FROST = [{ name: 'Frost', days: 30 }, { name: 'Bloom', days: 20 }];
export const SUN = [{ name: 'Sun', days: 10 }];

export const said = (text, line = '+ coin 5 | from: Bob') => `${text}\n\n<Changes>\n${line}\n</Changes>`;
export const frameOf = host => host.head().domains.frame ?? null;
export const problems = host => host.store.problems().map(({ code, why }) => `${code}: ${why}`);

/** A host with world `w1` and game `g1` (months Frost and Bloom, coin mark) installed and selected. */
export async function frameHost(t, { selected = true } = {}) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost();
    t.after(() => host.close());
    const packs = host.packs.packs;
    for (const pack of selected ? [world(), game('g1', FROST, 'mark')] : []) assert.equal((await packs.install(pack)).ok, true);
    return host;
}

/** Installs the game `id` and selects it. */
export async function swapGame(host, id, months, coin, version) {
    const packs = host.packs.packs;
    assert.equal((await packs.install(game(id, months, coin, version))).ok, true);
    assert.equal(await packs.select('game', id), true);
}
