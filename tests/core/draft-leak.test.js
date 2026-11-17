// A model that thinks aloud in the reply (no <think> tag): its first paragraphs, a review, "Ready to output.", the whole story again, the block.
// The draft is cut; the reply is kept once, live and on Re-read, through swipes, a delete and a reload (live run LAB-3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { dropDoubledDraft } from '../../core/capture.js';
import { createHost } from '../../testkit/index.js';

const P1 = 'You stepped off the barge planks onto the wet quay cobbles, leaning your weight onto your ash stick, and nodded to the nearest pair of watchmen.';
const P2 = 'Tovin, the river inspector, stepped sideways to block the narrow ramp. His wet quill spotted the tally board.';
const LEAK = 'Wait—let\'s replace "slick stones" immediately!\n\nLet\'s count words:\nP1: 44\nTotal: 595 words!\n- Exact `<Changes>` block at the very end! Ready to output.';
const doubled = block => `${P1}\n\n${P2}\n\n${LEAK}${P1}\n\n${P2}\n\n${block}`;
const clean = block => `${P1}\n\n${P2}\n\n${block}`;
const BLOCK = '<Changes>\n+ coin 5 | from: a chest\n</Changes>';
const HIDDEN = /<!--\s*STORY_SUITE_V2[\s\S]*?-->/g;
const shown = mes => String(mes).replace(HIDDEN, '').trim();
const coin = host => host.head().domains.inventory.wallets.party?.coin ?? 0;

test('the draft in front of a second copy of the first paragraph is dropped; other text is left alone', () => {
    assert.equal(dropDoubledDraft(doubled(BLOCK)), clean(BLOCK));
    assert.equal(dropDoubledDraft(dropDoubledDraft(doubled(BLOCK))), clean(BLOCK), 'again: no change');
    const plain = clean(BLOCK);
    assert.equal(dropDoubledDraft(plain), plain);
    const short = `"Name. Where from."\n\nHe waits.\n\n"Name. Where from."`;
    assert.equal(dropDoubledDraft(short), short, 'a short repeated line is no draft');
});

test('live: the shown reply has no draft and no second copy; swipe, swipe back, reread, delete and reload agree', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    await host.send('Arrive.', doubled(BLOCK));
    const last = host.ctx.chat.length - 1;
    const message = host.ctx.chat[last];
    assert.equal(shown(message.mes), `${P1}\n\n${P2}`);
    assert.equal(coin(host), 5);
    assert.ok(host.turn.problems().some(item => item.code === 'DRAFT_DROPPED'));
    const stored = message.mes;
    await host.swipe(clean('<Changes>\n+ coin 7 | from: Kael\n</Changes>'));
    assert.equal(coin(host), 7);
    await host.st.swipeTo(last, 0);
    assert.equal(host.ctx.chat[last].mes, stored, 'swipe back: the kept reply is as it was');
    assert.equal(coin(host), 5);
    assert.equal((await host.turn.reread(last)).ok, true);
    assert.equal(shown(host.ctx.chat[last].mes), `${P1}\n\n${P2}`);
    assert.equal(coin(host), 5);
    await host.st.loadChat(host.ctx.chat);
    assert.equal(shown(host.ctx.chat[last].mes), `${P1}\n\n${P2}`);
    assert.equal(coin(host), 5);
    await host.st.deleteMessage(last);
    assert.equal(coin(host), 0);
});
