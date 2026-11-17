import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSettings } from './sections/mount.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
const fresh = packs => ({ packs });
const PACK = (name, on = true) => ({ id: name, name, desc: '1 item', on });

test('an import says what happened and the list is read again from the host', async () => {
  const live = { packs: [PACK('old')], modules: [], trackers: { cap: 28, items: [] } };
  const sent = [];
  const { page, ov } = mountSettings({}, {
    onAction: async (key, value) => { sent.push([key, value]); live.packs = [PACK('old'), PACK('new')]; return { ok: true, text: 'Installed new.', errors: ['Ignored: a field'] }; },
    onView: name => (name === 'settings' ? fresh(live) : null),
  });
  const input = page('packs').querySelectorAll('input').find(i => i.getAttribute('type') === 'file');
  input.files = ['f'];
  input.dispatch('change');
  await tick();
  assert.deepEqual(sent, [['packs.import', ['f']]]);
  const el = ov.el.querySelector('.spage');
  assert.ok(el.textContent.includes('Installed new.') && el.textContent.includes('Ignored: a field'));
  assert.equal(el.querySelectorAll('.srow').filter(r => r.textContent.startsWith('new')).length, 1, 'the new pack is in the list');
});
