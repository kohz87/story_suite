// Contract: `reply.changes` of a real host, read through createSbPort and the chat selector, gives one reply's applied lines and fits CHAT_SHAPE;
// a swipe, swipe back, middle delete, rewind, reload and a Re-read (unedited, grown, shrunk) give the same lines as live; a reply with no receipts answers null.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { createSbPort } from '../../ui/port/sb-port.js';
import { buildSelectors } from '../../ui/select/build.js';
import { checkShape } from '../../ui/contract/shapes.js';
import { CHAT_SHAPE } from '../../ui/contract/chat.js';

const BLOCK = '\n<Changes>\n+ item Rope | qty: 2\n- item Lantern | qty: 1\n+ coin 5\n~ place Auvoth\n+ present Fenna\n</Changes>';
const LINES = ['+2 Rope', '+5', 'To Auvoth', 'Fenna arrived'];

const portOf = host => createSbPort({ sdk: host.sdk, selectors: buildSelectors(() => host.ctx, host.sdk) });
const linesOf = (host, index) => host.sdk.query('reply.changes', index === undefined ? {} : { index, asOf: index })?.lines.map(row => row.line);
const menuOf = host => portOf(host).view('chat')?.replyMenu;

async function story(t) {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ core: true });
  t.after(() => host.close());
  await host.send('Begin.', `You find things.${BLOCK}`);
  return host;
}

test('the reply menu and the inline row read one reply\'s applied lines, and fit CHAT_SHAPE', async t => {
  const host = await story(t);
  const view = portOf(host).view('chat');
  assert.deepEqual(checkShape(view.replyMenu, CHAT_SHAPE.replyMenu), []);
  assert.deepEqual(view.replyMenu.lines.map(row => row.line), LINES);
  assert.deepEqual(view.replyMenu.counts, { changes: 4, heldBack: 0, notApplied: 0 });
  assert.equal(view.replyMenu.stateThen.place, 'Auvoth');
  assert.equal(view.inlineRow.changes, 4);
  assert.equal(view.inlineRow.notApplied, 0);
  assert.deepEqual(view.replyMenu.lines.map(row => row.glyph), ['item', 'coin', 'road', 'people']);
});

test('a later reply with a payment, a loss and a departure reads as signed lines; an earlier reply is asked by index', async t => {
  const host = await story(t);
  await host.send('Then.', 'On.\n<Changes>\n- item Rope | qty: 1\n- coin 2\n- present Fenna\n</Changes>');
  assert.deepEqual(linesOf(host), ['−1 Rope', '−2', 'Fenna left']);
  assert.deepEqual(linesOf(host, 2), LINES);
  assert.equal(portOf(host).view('chat', { index: 2 }).replyMenu.stateThen.place, 'Auvoth');
});

test('a reply with no receipts answers null, so the card hides', async t => {
  const host = await story(t);
  await host.send('Quiet.', 'Nothing happens.');
  assert.equal(host.sdk.query('reply.changes', {}), null);
  assert.equal(menuOf(host), null);
  assert.equal(portOf(host).view('chat').inlineRow.changes, 0);
});

test('swipe, swipe back, a middle delete, a rewind and a reload give the same lines as live', async t => {
  const host = await story(t);
  await host.send('Then.', 'On.\n<Changes>\n+ coin 9\n</Changes>');
  assert.deepEqual(linesOf(host, 2), LINES);
  await host.swipe('A different telling.\n<Changes>\n+ coin 1\n</Changes>');
  assert.deepEqual(linesOf(host), ['+1']);
  await host.st.swipeTo(4, 0);
  assert.deepEqual(linesOf(host), ['+9'], 'swipe back');
  assert.deepEqual(linesOf(host, 2), LINES);
  await host.store.flush();
  const saved = structuredClone(host.ctx.chat);
  await host.st.loadChat(structuredClone(saved));
  assert.deepEqual(linesOf(host), ['+9'], 'reload');
  assert.deepEqual(linesOf(host, 2), LINES, 'reload, the earlier reply');
  // Rewind: the later exchange goes; the earlier reply is the head again with its own lines.
  await host.st.deleteMessage(4);
  await host.st.deleteMessage(3);
  assert.deepEqual(linesOf(host), LINES, 'rewind');
  assert.deepEqual(menuOf(host).lines.map(row => row.line), LINES);
  // Middle delete: the reader's message before a reply goes; the reply's lines stay on its reply.
  const again = await createHost({ core: true });
  t.after(() => again.close());
  await again.send('One.', 'A.\n<Changes>\n+ coin 3\n</Changes>');
  await again.send('Two.', 'B.\n<Changes>\n+ coin 4\n</Changes>');
  await again.send('Three.', 'C.\n<Changes>\n+ coin 6\n</Changes>');
  await again.st.deleteMessage(4);
  await again.st.deleteMessage(3);
  assert.deepEqual(linesOf(again), ['+6'], 'the reply that moved down keeps its own line');
  assert.deepEqual(linesOf(again, 2), ['+3']);
});

test('a Re-read (unedited, grown, shrunk) gives the lines its text has', async t => {
  const host = await story(t);
  const index = host.ctx.chat.length - 1;
  const text = host.ctx.chat[index].mes;
  assert.equal((await host.sdk.reread(index)).ok, true);
  assert.deepEqual(linesOf(host), LINES, 'unedited');
  await host.st.editMessage(index, `${text.replace('</Changes>', '+ coin 7\n</Changes>')}`);
  assert.equal((await host.sdk.reread(index)).ok, true);
  assert.deepEqual(linesOf(host), ['+2 Rope', '+12', 'To Auvoth', 'Fenna arrived'], 'grown');
  await host.st.editMessage(index, `Shorter.\n<Changes>\n+ coin 2\n</Changes>`);
  assert.equal((await host.sdk.reread(index)).ok, true);
  assert.deepEqual(linesOf(host), ['+2'], 'shrunk');
  await host.store.flush();
  await host.st.loadChat(structuredClone(host.ctx.chat));
  assert.deepEqual(linesOf(host), ['+2'], 'reload after the Re-read');
});

test('with the query gone the selectors give no lines and no menu (the fix is what fills them)', async t => {
  const host = await story(t);
  const sdk = { ...host.sdk, query: (name, args) => (name === 'reply.changes' ? undefined : host.sdk.query(name, args)) };
  const view = createSbPort({ sdk, selectors: buildSelectors(() => host.ctx, sdk) }).view('chat');
  assert.equal(view.replyMenu, null);
  assert.equal(view.inlineRow.changes, 0);
});
