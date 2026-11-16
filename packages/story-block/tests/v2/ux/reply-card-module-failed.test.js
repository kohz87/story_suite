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

const ON = { 'suite.isolatedApply': true };
const rowsAt = (doc, index) => [...doc.querySelectorAll(`.mes[mesid="${index}"] [data-ss-card="${THIS_REPLY_ID}"] .module-failed`)].map(row => row.textContent);
async function flagged() {
    const made = await page({ reread: (index, host) => host.turn.reread(index) });
    made.host.ctx.extensionSettings.storySuite = { ...made.host.ctx.extensionSettings.storySuite, flags: ON };
    return made;
}
const showCard = ({ ui }, index) => { ui.mounts.card.refresh(index, { force: true }); ui.mounts.card.toggle(index, true); };

test('a failure belongs to the swipe that had it: not on another swipe, back on its own', async () => {
    const made = await flagged();
    const { doc, host, draw } = made;
    let boom = true;
    host.sdk.on('turn', () => { if (boom) throw new Error('boom A'); }, { module: 'story-block' });
    await host.send('hi', WITH_LINES);
    draw();
    const index = host.store.headIndex();
    showCard(made, index);
    assert.deepEqual(rowsAt(doc, index).length, 1);
    boom = false;
    await host.swipe('A cleaner reply.\n<Changes>\n+ item Rope | qty: 1\n</Changes>');
    draw();
    showCard(made, index);
    assert.deepEqual(rowsAt(doc, index), [], 'swipe B did not fail');
    await host.st.swipeTo(index, 0);
    draw();
    showCard(made, index);
    const back = rowsAt(doc, index);
    assert.equal(back.length, 1);
    assert.match(back[0], /turn failed: boom A/);
});

test('a Re-read that now succeeds: the row is gone', async () => {
    const made = await flagged();
    const { doc, host, draw } = made;
    let boom = true;
    host.sdk.on('turn', () => { if (boom) throw new Error('boom'); }, { module: 'story-block' });
    await host.send('hi', WITH_LINES);
    draw();
    const index = host.store.headIndex();
    showCard(made, index);
    assert.equal(rowsAt(doc, index).length, 1);
    boom = false;
    await host.turn.reread(index);
    showCard(made, index);
    assert.deepEqual(rowsAt(doc, index), []);
});

test('a chat change clears the failures', async () => {
    const made = await flagged();
    const { doc, host, draw } = made;
    host.sdk.on('turn', () => { throw new Error('boom'); }, { module: 'story-block' });
    await host.send('hi', WITH_LINES);
    draw();
    const index = host.store.headIndex();
    showCard(made, index);
    assert.equal(rowsAt(doc, index).length, 1);
    await host.ctx.eventSource.emit(host.ctx.eventTypes.CHAT_CHANGED);
    showCard(made, index);
    assert.deepEqual(rowsAt(doc, index), []);
});

test('a listener that rejects after the card is drawn shows the row with no refresh by hand', async () => {
    const made = await flagged();
    const { doc, host, draw } = made;
    let reject = null;
    host.sdk.on('turn', () => new Promise((_, no) => { reject = no; }), { module: 'story-block' });
    await host.send('hi', WITH_LINES);
    draw();
    const index = host.store.headIndex();
    showCard(made, index);
    assert.deepEqual(rowsAt(doc, index), []);
    reject(new Error('late boom'));
    for (let n = 0; n < 10; n += 1) await new Promise(resolve => setImmediate(resolve));
    const rows = rowsAt(doc, index);
    assert.equal(rows.length, 1);
    assert.match(rows[0], /late boom/);
});
