// The reply card lists what a settle changed (ui-host/reply-interaction.js, the card's `ul.interaction` row): the kind, its summary and each change;
// a receipt trimmed after 200 carriers shows the summary alone. The row follows the shown swipe's record, so swipe, delete, rewind, reload and Re-read agree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { THIS_REPLY_ID } from '../../../ui/legacy/reply-cards.js';
import { trimReceipts } from '../../../core/persist/receipts.js';
import { interactionAt } from '../../../ui/legacy/ui-host/reply-interaction.js';
import { page } from '../../ui/ux/ux.helpers.js';
import { iaApi, iaChain, iaModule, setText, withLines } from '../../suite/qa/helpers/probe-interaction.js';

const rowsAt = (doc, index) => [...doc.querySelectorAll(`.mes[mesid="${index}"] [data-ss-card="${THIS_REPLY_ID}"] .interaction`)].map(row => row.textContent.replace(/\s+/g, ' ').trim());
function show(made, index) {
    made.draw();
    made.ui.mounts.card.refresh(index, { force: true });
    made.ui.mounts.card.toggle(index, true);
    return rowsAt(made.doc, index);
}
async function played() {
    const made = await page({ modules: [iaModule()], reread: (index, host) => host.turn.reread(index) });
    const api = iaApi(made.host);
    const { a, s } = await iaChain(made.host, api, { segments: 1 });
    return { ...made, a, index: s[0] };
}
test('the card names the kind and lists each change; a reply with no settle has no row', async () => {
    const made = await played();
    try {
        const rows = show(made, made.index);
        assert.equal(rows.length, 1);
        assert.match(rows[0], /^probe settled: Probe round 0: go, total \d+\. Bag \+\d+\.$/);
        assert.deepEqual(show(made, made.a), [], 'the earlier reply ran no interaction');
    } finally { made.host.close(); }
});

test('a swipe, a swipe back, an edited Re-read (grown, shrunk), reload and a chat change keep the same row', async () => {
    const made = await played();
    try {
        const { host, index } = made;
        const first = show(made, index)[0];
        await host.swipe('S1, another way.');
        assert.equal(show(made, index)[0], first, 'the new swipe replays the same settle');
        await host.st.swipeTo(index, 0);
        assert.equal(show(made, index)[0], first, 'back on the first swipe');
        setText(host, index, withLines('S1, with more words.', ['! ia luck1']));
        await host.turn.reread(index);
        assert.equal(show(made, index)[0], first, 'grown');
        setText(host, index, 'S1.');
        await host.turn.reread(index);
        assert.equal(show(made, index)[0], first, 'shrunk');
        await host.st.loadChat(host.st.saved() ?? host.ctx.chat);
        assert.equal(show(made, index)[0], first, 'reload');
        await host.ctx.eventSource.emit(host.ctx.eventTypes.CHAT_CHANGED);
        assert.equal(show(made, index)[0], first, 'chat change');
    } finally { made.host.close(); }
});

test('a rewind to before the settle and a delete of the reply take its row away', async () => {
    const made = await played();
    try {
        const { host, index } = made;
        assert.equal(show(made, index).length, 1);
        const entry = host.store.receipts().find(item => item.receipt.type === 'interaction.settle');
        const done = await host.sdk.rewind({ index: entry.index, beforeRev: entry.receipt.rev });
        assert.equal(done.ok, true, done.message);
        for (let at = 0; at < host.ctx.chat.length; at += 1) assert.deepEqual(show(made, at), [], `reply ${at}`);
    } finally { made.host.close(); }
    const again = await played();
    try {
        await again.host.st.deleteMessage(again.index);
        for (let at = 0; at < again.host.ctx.chat.length; at += 1) assert.deepEqual(show(again, at), [], `after delete, reply ${at}`);
    } finally { again.host.close(); }
});

test('a receipt trimmed after 200 carriers shows the summary line only, on the card', async () => {
    const made = await played();
    try {
        const { host, index } = made;
        assert.equal(trimReceipts(host.ctx.chat[index]), true);
        const [row] = show(made, index);
        assert.match(row, /^Probe round 0: go, total \d+\.$/, 'no kind name, no change list');
    } finally { made.host.close(); }
});

test('interactionAt: change list from data.interaction; a trimmed receipt has the summary line only', () => {
    const settle = data => ({ type: 'interaction.settle', summary: 'Probe round 0: go.', ...(data ? { data } : {}) });
    const full = settle({ v2: {}, interaction: { module: 'm', kind: 'probe', changes: [{ type: 'ia.grant', summary: 'Bag +2.' }, { type: 'ia.grant', summary: '' }] } });
    assert.deepEqual(interactionAt({ receipts: [full, { type: 'other', summary: 'x' }] }), [{ kind: 'probe', summary: 'Probe round 0: go.', changes: [{ type: 'ia.grant', summary: 'Bag +2.' }] }]);
    assert.deepEqual(interactionAt({ receipts: [settle({ v2: {} })] }), [{ kind: '', summary: 'Probe round 0: go.', changes: [] }]);
    assert.deepEqual(interactionAt(null), []);
});
