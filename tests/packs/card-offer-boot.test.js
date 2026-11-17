// The card offer without the old view: boot's host parts build the one controller, the new view's port reaches it, and a chat change reads the card again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeContext } from '../../testkit/fake-st.js';
import { createRuntime } from '../../core/runtime.js';
import { createPacksPart } from '../../packs/index.js';
import { startHostParts } from '../../core/boot/host-parts.js';
import { mountUi } from '../../ui/legacy/ui-host.js';
import { liveOffer, setLiveOffer } from '../../ui/port/live-offer.js';
import { createSbPort } from '../../ui/port/sb-port.js';
import { setupDom } from '../ui/view/mounts/helpers.js';
import { cardPack, packEntry, settle } from './helpers/card.js';

async function world(t, { withOldView = false } = {}) {
    t.mock.method(console, 'warn', () => {});
    const st = createFakeContext({ extensionSettings: { storySuite: {} } });
    const part = createPacksPart({ settings: { read: () => st.ctx.extensionSettings.storySuite, save: () => {} }, capabilities: () => ['data-modules-v1'] });
    const runtime = createRuntime({ ctx: st.ctx, packs: part });
    const reads = { count: 0 };
    const readLorebook = async () => { reads.count += 1; return { character: 'Ilsa', card: 'ilsa.png', entries: [packEntry(cardPack())], problem: '' }; };
    setLiveOffer(null);
    const parts = startHostParts({ runtime, ctx: st.ctx, readLorebook });
    t.after(() => { parts.stop(); setLiveOffer(null); });
    const ui = withOldView ? mountUi({ runtime, ctx: st.ctx, doc: setupDom(), parts }) : null;
    runtime.markReady();
    await runtime.turn.onChatChanged();
    return { st, runtime, parts, reads, ui };
}

test('without the old view the offer is built, registered for the new view, read on a chat change, and answered through the port', async t => {
    const w = await world(t);
    assert.ok(w.parts.cardOffer, 'a controller');
    assert.equal(liveOffer(), w.parts.cardOffer, 'the new view reads this one');
    w.parts.refreshOffer();
    await settle();
    assert.equal(w.parts.cardOffer.offers().length, 1, 'the card brings one offer');
    const before = w.reads.count;
    await w.st.ctx.eventSource.emit(w.st.ctx.eventTypes.CHAT_CHANGED, 'chat-2');
    await settle();
    assert.equal(w.reads.count, before + 1, 'the new chat\'s card is read again, once');
    const port = createSbPort({ sdk: w.runtime.sdk, offer: liveOffer });
    assert.deepEqual(await port.command('packs.offer', { op: 'notNow', id: w.parts.cardOffer.offers()[0].id }), { ok: true });
    assert.equal(w.parts.cardOffer.offers().length, 0, 'Not now clears the offer through the same controller');
});

test('with the old view mounted on top it takes boot\'s controller and does not read the card a second time', async t => {
    const w = await world(t, { withOldView: true });
    assert.equal(w.ui.cardOffer, w.parts.cardOffer, 'one controller');
    assert.equal(w.ui.savePoints, w.parts.savePoints, 'one save points instance');
    w.parts.refreshOffer();
    await settle();
    const before = w.reads.count;
    await w.st.ctx.eventSource.emit(w.st.ctx.eventTypes.CHAT_CHANGED, 'chat-2');
    await settle();
    assert.equal(w.reads.count, before + 1, 'boot\'s read only');
    w.ui.destroy();
});
