// The changes card's "could not finish" row on the real host (ui-host/replies.js moduleFailedAt): only with suite.isolatedApply on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { THIS_REPLY_ID } from '../../../src/v2/reply-cards.js';
import { WITH_LINES, page } from './ux.helpers.js';

async function rowsFor(flagOn) {
    const { doc, host, ui, draw } = await page();
    if (flagOn) host.ctx.extensionSettings.storySuite = { ...host.ctx.extensionSettings.storySuite, flags: { 'suite.isolatedApply': true } };
    await host.send('hi', WITH_LINES);
    draw();
    const index = host.store.headIndex();
    const failed = [{ module: 'story-block', index, code: 'FAILED', message: 'turn failed: torn' }];
    host.turn.problems = () => failed;
    ui.mounts.card.refresh(index, { force: true });
    ui.mounts.card.toggle(index, true);
    const card = doc.querySelector(`.mes[mesid="${index}"] [data-ss-card="${THIS_REPLY_ID}"]`);
    assert.ok(card, 'the changes card is drawn');
    return card.querySelectorAll('.module-failed');
}

test('a FAILED Problem for the reply: no row with the flag off, the row with it on', async () => {
    assert.equal((await rowsFor(false)).length, 0);
    const on = await rowsFor(true);
    assert.equal(on.length, 1);
    assert.match(on[0].textContent, /could not finish this reply: turn failed: torn/);
});
