// F2: a line that moved no meter but stored a tie, a taste or a place says what it stored, not just "nothing moved".
import test from 'node:test';
import assert from 'node:assert/strict';
import { suite } from './helpers/pacing-suite.js';
import { ON } from './npc-notes-kinds.helpers.js';

test('a tie, a taste and a where line name what was stored in their receipt', async () => {
    const s = await suite({ allowance: null, features: ON });
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +1']);
    const summaries = async line => { await s.say([line]); return s.host.store.receipts().map(item => item.receipt).filter(item => /^capture\./.test(item.type)).at(-1).summary; };
    assert.match(await summaries('~ tie Oren | with: Mira | tag: +ally'), /Oren: nothing moved; tie stored/);
    assert.match(await summaries('~ taste Oren | likes: honey cakes'), /Oren: nothing moved; taste stored/);
    assert.match(await summaries('~ npc Oren | where: the ferry'), /Oren: nothing moved; place stored/);
    assert.match(await summaries('~ npc Oren | goal: find the ledger'), /Oren: nothing moved; goal stored/);
    assert.doesNotMatch(await summaries('~ npc Oren | trust: +1'), /stored/);
});
