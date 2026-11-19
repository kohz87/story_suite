// Bag › Transport: + Add (mounts.add, even with no mount yet while the mounts switch is on), the kind picked from the engine's list with
// the pace following it, and a mount's sheet with Edit (mounts.edit, changed fields only) and Remove (mounts.remove); refusals stay in view.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { bagFixture } from '../../../../ui/fixtures/bag.js';
import { assetsCard, assetSheet } from '../../../../ui/tabs/bag/assets.js';
import { mountPayload, MOUNT_KINDS } from '../../../../ui/tabs/bag/mount-form.js';
import { KIND_PACE } from '../../../../modules/scene/mounts.js';
import { KIND_CARRY } from '../../../../modules/inventory/gear/carry.js';
import { makeCtx } from './helpers.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
const answering = (ctx, answer) => { ctx.port.command = (type, payload) => { ctx.sent.push([type, payload]); return Promise.resolve(answer(type, payload)); }; return ctx; };
const MARE = { id: 'grey-mare', name: 'Grey Mare', glyph: 'mount', kindLabel: 'horse', riders: [], seats: null, where: '', withParty: true, condition: null, note: '', meta: ['horse', '35 km/day'], tag: '', count: 1, pace: 35, carry: null };
const empty = () => ({ ...bagFixture(), pace: null, assets: { transport: [], property: [], canAdd: true } });
const addButton = card => card.querySelector('[data-add="mount"]');

test('the kinds are the engine\'s (every kind with a pace or a load), horse first', () => {
  assert.equal(MOUNT_KINDS[0], 'horse');
  for (const kind of [...Object.keys(KIND_PACE), ...Object.keys(KIND_CARRY)]) assert.ok(MOUNT_KINDS.includes(kind), kind);
  assert.equal(new Set(MOUNT_KINDS).size, MOUNT_KINDS.length);
});

test('mountPayload: an add sends the typed fields; an edit only what changed; bad numbers say why', () => {
  assert.deepEqual(mountPayload({ name: ' Grey Mare ', kind: 'horse', count: '1', pace: '35', where: '' }),
    { add: { name: 'Grey Mare', kind: 'horse', count: 1, pace: 35, where: '' } });
  assert.deepEqual(mountPayload({ name: 'Grey Mare', kind: 'horse', count: '1', pace: '40', where: 'ridden by Mara', condition: '', carry: '' }, MARE),
    { edit: { mount: 'Grey Mare', pace: 40, where: 'ridden by Mara' } });
  assert.deepEqual(mountPayload({ name: 'Grey Mare', kind: 'horse', count: '1', pace: '35', where: '', condition: '', carry: '' }, MARE), { edit: null });
  assert.deepEqual(mountPayload({ name: 'Grey', kind: 'mule', count: '2', pace: '25', where: '', condition: 'tired', carry: '45' }, MARE),
    { edit: { mount: 'Grey Mare', name: 'Grey', kind: 'mule', count: 2, pace: 25, condition: 'tired', carry: 45 } });
  assert.match(mountPayload({ name: '' }).error, /name/);
  assert.match(mountPayload({ name: 'A', count: '0', pace: '30' }).error, /How many/);
  assert.match(mountPayload({ name: 'A', count: '1', pace: 'fast' }).error, /Pace/);
});

test('+ Add shows under Transport with no mount yet; the form sends mounts.add and closes; the pace follows the kind until typed', async () => {
  installFakeDom();
  const ctx = makeCtx();
  const card = assetsCard(empty(), ctx);
  assert.ok(card, 'the card shows so + Add can');
  assert.match(card.querySelector('.abody').textContent, /TransportNo mounts yet\./);
  addButton(card).click();
  const [form, label] = ctx.sheets[0];
  assert.equal(label, 'Add a mount');
  assert.equal(form.dataset.form, 'mount-add');
  const kind = form.querySelector('[data-field="kind"]');
  const pace = form.querySelector('[data-field="pace"]');
  assert.deepEqual([kind.value, pace.value], ['horse', '35']);
  kind.value = 'mule';
  kind.dispatchEvent({ type: 'change' });
  assert.equal(pace.value, '25', 'the usual pace follows the kind');
  pace.value = '28';
  kind.value = 'cart';
  kind.dispatchEvent({ type: 'change' });
  assert.equal(pace.value, '28', 'a typed pace stays');
  form.querySelector('input').value = 'Supply Cart';
  form.querySelector('[data-field="count"]').value = '2';
  form.querySelector('[data-field="where"]').value = 'led by Tam';
  form.querySelector('.save').click();
  await flush();
  assert.deepEqual(ctx.sent, [['mounts.add', { name: 'Supply Cart', kind: 'cart', count: 2, pace: 28, where: 'led by Tam' }], ['close']]);
});

test('+ Add: the engine\'s refusal stays in the form; no switch (or no port) shows no + Add', async () => {
  installFakeDom();
  const ctx = answering(makeCtx(), () => ({ ok: false, message: '"Burr" is already the name of another mount.' }));
  addButton(assetsCard(empty(), ctx)).click();
  const form = ctx.sheets[0][0];
  form.querySelector('input').value = 'Burr';
  form.querySelector('.save').click();
  await flush();
  assert.match(form.querySelector('.err').textContent, /already the name/);
  assert.equal(ctx.sent.some(([type]) => type === 'close'), false);
  assert.equal(assetsCard({ ...empty(), assets: { transport: [], property: [], canAdd: false } }, makeCtx()), null);
  assert.equal(addButton(assetsCard(bagFixture(), { ...makeCtx(), port: null })), null);
});

test('a mount\'s sheet: Edit opens the form on its values and sends mounts.edit; Remove sends mounts.remove; a refusal stays', async () => {
  installFakeDom();
  const ctx = makeCtx();
  const sheet = assetSheet(MARE, 'transport', ctx);
  assert.deepEqual(sheet.querySelectorAll('.brow .btn2').map(b => b.textContent), ['Edit', 'Remove']);
  sheet.querySelector('.btn2.edit').click();
  const form = sheet.querySelector('[data-form="mount-edit"]');
  assert.deepEqual(['kind', 'count', 'pace'].map(f => form.querySelector(`[data-field="${f}"]`).value), ['horse', '1', '35']);
  form.querySelector('[data-field="condition"]').value = 'lame';
  form.querySelector('[data-field="carry"]').value = '50';
  form.querySelector('.save').click();
  await flush();
  assert.deepEqual(ctx.sent, [['mounts.edit', { mount: 'Grey Mare', condition: 'lame', carry: 50 }], ['close']]);
  const no = answering(makeCtx(), () => ({ ok: false, message: 'The party has no mount called Grey Mare.' }));
  const gone = assetSheet(MARE, 'transport', no);
  gone.querySelectorAll('.brow .btn2').find(b => b.textContent === 'Remove').click();
  await flush();
  assert.deepEqual(no.sent, [['mounts.remove', { mount: 'Grey Mare' }]]);
  assert.equal(gone.querySelector('.err').textContent, 'The party has no mount called Grey Mare.');
  assert.equal(gone.querySelector('.err').hasAttribute('hidden'), false);
  // property rows have no mount actions
  assert.equal(assetSheet(bagFixture().assets.property[0], 'property', makeCtx()).querySelector('.brow'), null);
});
