// A fight the reader staged must never leave the "Fight tab, Discard fight" advice with no tab:
// the Fight tab is listed while a board fight is kept, and Discard fight clears the hold so a send goes through.
// Also: a send after two user messages in a row (no session, no record before the reader's message) does not throw.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrecall } from '../../../../modules/rpg/index.js';
import { LEAN_RPG_FEATURE } from '../../../../modules/rpg/names.js';
import { STANDARD_FORMULA } from '../../../../modules/rpg/rules.js';
import { STANDARD_TEMPLATES } from '../../../../modules/rpg/templates.js';
import { boardSession, openBoard, stageExchange } from '../../../core/helpers/board-port.js';
import { begin, makeBlocks, page, settle } from '../view/page.js';

const BOARD = 'story-block.fight-board';

test('two user messages in a row with no fight session: canGenerate and beforeGenerate answer instead of throwing', async () => {
    const messages = [{ is_user: false, mes: 'The rats close in.' }, { is_user: true, mes: 'I wait.' }, { is_user: true, mes: 'I hit the lead rat.' }];
    const precall = createPrecall({ chat: () => messages, metadata: () => ({}) });
    const view = { feature: id => id === LEAN_RPG_FEATURE || id === BOARD, query: () => null, state: { domains: {} }, settings: () => ({}) };
    for (const type of ['normal', 'regenerate']) {
        assert.doesNotThrow(() => precall.canGenerate(view, { commit: true, type }));
        await assert.doesNotReject(async () => precall.beforeGenerate(view, { commit: true, type }));
    }
});

test('a staged fight whose reply was deleted goes with it: no hold, no tab, and a send goes through', async t => {
    const { doc, host, ui } = await page(t, { formula: 'standard' });
    await begin(host);
    await makeBlocks(host, { character: { agi: 20 }, skills: { skill1: 'Cut', stat1: 'str', about1: 'cut one foe' } });
    const foes = structuredClone(STANDARD_TEMPLATES.find(item => item.definition.role === 'foes').definition);
    Object.assign(foes.state.foe1, { default: 'Rats' });
    Object.assign(foes.state.count1, { default: 2 });
    Object.assign(foes.state.level1, { default: 1 });
    Object.assign(foes.state.hurt1, { default: 5 });
    assert.equal((await host.sdk.command('dm.define', { definition: foes })).ok, true);
    host.features.set('story-block.fight-board', true);
    await settle();
    const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex());
    assert.equal(openBoard(meta, host.head(), { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } }).error, undefined);
    assert.equal(stageExchange(meta, host.head(), [{ who: 'Wessel', kind: 'attack', target: 11 }]).error, undefined);
    // The reply the fight hangs on is deleted, and with it the foes. On the port the staged fight hangs on that reply too: it goes with it, so no hold and no
    // "Discard fight" advice is left with no tab.
    await host.st.deleteMessage(2);
    await settle();
    assert.equal(boardSession(meta), null, 'the staged fight went with its reply');
    const fightScreen = () => ui.screens.list('tab').find(entry => entry.id === 'story-block/fight')?.screen;
    assert.equal(fightScreen().active(host.head(), {}).on, false, 'with nothing kept and no foe the tab is not listed');
    const sent = await host.send('I press on.', 'The story goes on.');
    assert.equal(sent.aborted, undefined, 'the send is not held');
    assert.equal(host.ctx.chat.at(-1).is_user, false);
});

test('a held reply\'s fight keeps the Fight tab even after Discard fight, until the reply is regenerated', async t => {
    const { host, ui } = await page(t, { formula: 'standard' });
    await begin(host);
    host.features.set('story-block.fight-board', true);
    const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex());
    const fightScreen = () => ui.screens.list('tab').find(entry => entry.id === 'story-block/fight')?.screen;
    assert.equal(fightScreen().active(host.head(), {}).on, false, 'no foe, nothing held: no tab');
    const payload = { kindId: 'story-block/fight', id: 'y:0:story-block/fight', key: 'i:y:0:story-block/fight:y:0', anchor: 'y', setup: { id: 'y:0', groups: [] }, steps: [] };
    meta.storySuiteInteraction = { held: { [sid]: { current: { type: 'normal', prechecks: [{ type: 'interaction.settle', payload }] }, staged: {} } } };
    assert.equal(fightScreen().active(host.head(), {}).on, true, 'a held fight lists the tab');
    meta.storySuiteInteraction.heldDiscarded = { [sid]: true };
    assert.equal(fightScreen().active(host.head(), {}).on, true, 'the held reply still says "Regenerate the held reply" there');
});
