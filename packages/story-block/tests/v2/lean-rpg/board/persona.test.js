// The reader chooses for the party on the port, and the reader is found the way the party roster finds them: the Character named like the persona, else the only Character.
// A persona that is not any Character's name must not lock the board (the pre-port board never asked who the reader was).
import test from 'node:test';
import assert from 'node:assert/strict';
import { STANDARD_FORMULA } from '../../../../src/v2/lean-rpg/rules.js';
import { toStep } from '../../../../src/v2/lean-rpg/board/steps.js';
import { seedCrypto } from '../../qa/helpers/seeded.js';
import { character, foeBlock, setup } from '../helpers.js';

const RULES = { ...STANDARD_FORMULA, levelDivisor: 5 };

test('a persona that is no Character\'s name still plays the fight of the only Character', async () => {
    const restore = seedCrypto(5);
    const { host } = await setup({ blocks: { hero: { role: 'character', fields: character('Astra', { str: 5 }) }, foes: { role: 'foes', fields: foeBlock([['Rats', 2, 1, 5]]) } }, board: true });
    try {
        host.ctx.name1 = 'Somebody Else';
        const api = host.sdk.interaction;
        assert.ok(api, 'the live sdk has the interaction api');
        const opened = api.open('story-block/fight', { rules: RULES });
        assert.equal(opened.ok, true, opened.message);
        const staged = api.stage(opened.id, toStep(host.head(), [{ who: 'Astra', kind: 'attack', target: 11 }]));
        assert.equal(staged.ok, true, staged.message);
        assert.equal(api.current().steps.length, 1);
    } finally { host.close(); restore(); }
});

test('with several Characters and a persona that names none of them, the first Character plays (as the rolls do); a persona that names one keeps that one', async () => {
    const restore = seedCrypto(6);
    const { host } = await setup({ blocks: { a: { role: 'character', fields: character('Astra', { str: 5 }) }, b: { role: 'character', fields: character('Bram', { str: 5 }) }, foes: { role: 'foes', fields: foeBlock([['Rats', 2, 1, 5]]) } }, board: true });
    try {
        const api = host.sdk.interaction;
        for (const [persona, who] of [['Somebody Else', 'Astra'], ['Bram', 'Bram']]) {
            host.ctx.name1 = persona;
            const opened = api.open('story-block/fight', { rules: RULES });
            assert.equal(opened.ok, true, `${persona}: ${opened.message}`);
            const staged = api.stage(opened.id, toStep(host.head(), [{ who: 'Astra', kind: 'attack', target: 11 }, { who: 'Bram', kind: 'attack', target: 11 }]));
            assert.equal(staged.ok, true, `${persona}: ${staged.message}`);
            assert.equal(api.discard(opened.id).ok, true, who);
        }
    } finally { host.close(); restore(); }
});
