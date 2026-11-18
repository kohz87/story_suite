// Pack format 4, job S1: the Start page's own rows reach the store through the port's packs commands; a refused value says so.
import test from 'node:test';
import assert from 'node:assert/strict';
import { packsCommand } from '../../../ui/port/packs.js';
import { createInstalled } from '../../../packs/installed.js';
import { fakeSettings } from '../../packs/helpers/fake-settings.js';

const set = (key, value) => ({ key, value });
const make = () => { const settings = fakeSettings(); const packs = createInstalled({ settings }); return { settings, packs, handle: { packs } }; };

test('rank label, starting money and the items list are written to the store and saved', async () => {
    const { handle, packs, settings } = make();
    assert.deepEqual(await packsCommand(handle, null, 'settings.set', set('packs.you.rankLabel', ' Standing ')), { ok: true });
    assert.deepEqual(await packsCommand(handle, null, 'settings.set', set('packs.start.money', '12')), { ok: true });
    assert.deepEqual(await packsCommand(handle, null, 'settings.set', set('packs.start.items', 'Rope x2')), { ok: true });
    assert.deepEqual(packs.own.read(), { rankLabel: 'Standing', money: 12, items: [{ name: 'Rope', qty: 2 }] });
    assert.equal(settings.saves, 3);
});

test('a money that is not a whole number is refused and nothing is saved', async () => {
    const { handle, packs, settings } = make();
    const answer = await packsCommand(handle, null, 'settings.set', set('packs.start.money', 'lots'));
    assert.deepEqual([answer.ok, answer.message], [false, 'That value cannot be used.']);
    assert.equal(packs.own.read().money, null);
    assert.equal(settings.saves, 0);
});

test('a blank clears the reader\'s value (the game pack\'s comes back)', async () => {
    const { handle, packs } = make();
    await packsCommand(handle, null, 'settings.set', set('packs.start.money', 5));
    await packsCommand(handle, null, 'settings.set', set('packs.start.money', ''));
    assert.equal(packs.own.read().money, null);
});

test('only a setting is taken: an action with an own key is not this page\'s', async () => {
    const { handle } = make();
    assert.equal(await packsCommand(handle, null, 'settings.action', set('packs.start.money', 5)), null);
});
