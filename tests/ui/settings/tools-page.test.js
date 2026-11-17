import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from './sections/mount.js';

const press = (el, label) => el.querySelectorAll('.btn2').find(b => b.textContent === label).click();
const tick = () => new Promise(r => setTimeout(r, 0));

function views(state) {
  const asked = [];
  const onView = (name, args) => { asked.push([name, args]); return state[name]?.(args) ?? null; };
  return { onView, asked };
}
const sentOf = used => ({ used, cap: 1500, total: used + 10, budget: [{ name: 'Notes this reply', used, cap: 1500, color: '#f0b84a' }], text: `sent ${used}`, tools: [{ label: 'Inspector', hint: 'h', button: 'Open' }, { label: 'Problems', hint: 'p', button: 'Show' }] });

test('the sent card is read live on every draw, not from the snapshot taken when Settings opened', () => {
  let used = 100;
  const { onView } = views({ sent: () => sentOf(used), problems: () => ({ items: [], rebuild: null }) });
  const { page } = mountSettings({}, { onView });
  assert.ok(page('tools').querySelector('pre.sent').textContent.includes('sent 100'));
  used = 250;
  assert.ok(page('tools').querySelector('pre.sent').textContent.includes('sent 250'));
  assert.equal(page('tools').querySelectorAll('.brow2').length, 1);
});

test('the budget rows come from the snapshot into the sent card once', () => {
  const { onView } = views({ sent: () => sentOf(5), problems: () => ({ items: [], rebuild: null }) });
  const { page, settings } = mountSettings({}, { onView });
  const rows = page('tools').querySelectorAll('.srow').filter(r => r.dataset?.key && settings.sent.limits.some(l => l.key === r.dataset.key));
  assert.equal(rows.length, settings.sent.limits.length);
});

test('a blocked branch is a Problems entry: Start asks first, a choice goes to the host, a refusal is shown', async () => {
  const rebuild = { module: 'npc', name: 'NPC State', title: 'Dossiers can’t be restored here', body: 'paused', choices: [{ read: 'last-40', label: 'Last 40' }, { read: 'all', label: 'Whole chat' }] };
  const sent = [];
  const { onView } = views({ sent: () => sentOf(1), problems: () => ({ items: [{ module: 'm', code: 'C', message: 'oops', reply: 3 }], rebuild }) });
  const { page } = mountSettings({}, { onView, onAction: (k, v) => { sent.push([k, v]); return k === 'tools.rebuild' ? { ok: false, message: 'busy' } : undefined; } });
  const el = page('tools');
  assert.equal(el.querySelectorAll('[data-problem]').length, 2);
  assert.equal(el.querySelectorAll('.cfm').length, 0);
  press(el, 'Start from the chat');
  assert.equal(sent.length, 0, 'nothing starts before the choice');
  const ask = page('tools');
  assert.equal(ask.querySelectorAll('.cfm').length, 1);
  press(ask.querySelector('.cfm'), 'Whole chat');
  assert.deepEqual(sent, [['tools.rebuild', { module: 'npc', read: 'all' }]]);
  await tick(); await tick();
  assert.ok(page('tools').textContent.includes('busy'));
});

test('Show draws an empty Problems card, and with nothing wrong and no Show there is no card', () => {
  const { onView } = views({ sent: () => sentOf(1), problems: () => ({ items: [], rebuild: null }) });
  const { page } = mountSettings({}, { onView });
  assert.equal(page('tools').querySelectorAll('[data-card="problems"]').length, 0);
  press(page('tools'), 'Show');
  assert.ok(page('tools').querySelector('[data-card="problems"]').textContent.includes('Nothing to report'));
});

test('Copy report asks the host and says when copying was not allowed', async () => {
  const sent = [];
  const { onView } = views({ sent: () => sentOf(1), problems: () => ({ items: [], rebuild: null }) });
  const { page } = mountSettings({}, { onView, onAction: (k) => { sent.push(k); return { ok: true, text: 'REPORT' }; } });
  press(page('tools'), 'Copy report');
  await tick(); await tick();
  assert.deepEqual(sent, ['tools.report']);
  assert.match(page('tools').querySelector('[data-card="diagnostics"]').textContent, /Copied|did not allow/);
});

test('the Inspector opens as a sheet and reads again on each move to an older or newer reply', () => {
  const state = { replies: [{ index: 5, name: 'A', snippet: 'new', rev: 2, head: true }, { index: 2, name: 'A', snippet: 'old', rev: 1, head: false }] };
  const reply = i => ({ ok: true, name: 'A', rev: 1, head: i === 5, lines: [{ kind: 'change', path: `/at${i}`, before: '1', after: '2' }], more: 0, ops: 1, receipts: [], problems: [], state: '{}' });
  const asked = [];
  const { onView } = views({ sent: () => sentOf(1), problems: () => ({ items: [], rebuild: null }),
    inspector: args => { asked.push(args?.index ?? null); const index = state.replies.some(r => r.index === args?.index) ? args.index : state.replies[0].index; return { replies: state.replies, index, reply: reply(index) }; } });
  const { page, ov } = mountSettings({}, { onView });
  press(page('tools'), 'Open');
  const sheet = ov.el.ownerDocument.querySelector('[data-sheet="inspector"]') ?? ov.el.ownerDocument.body.querySelector('.sh-ov');
  assert.ok(sheet.textContent.includes('/at5'));
  sheet.querySelector('[aria-label="Older reply"]').click();
  assert.ok(sheet.textContent.includes('/at2'));
  state.replies = [state.replies[0]];   // the older reply was swiped away or deleted
  sheet.querySelector('[aria-label="Newer reply"]').click();
  assert.ok(sheet.textContent.includes('/at5'));
  assert.deepEqual(asked, [null, 2, 5]);
});
