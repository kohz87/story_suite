// Settings › People (owner, drop 2): a number the People page holds to its range answers with what is stored and the range, so the row redraws
// it and says "Dormant after is 10-999; kept 10." (it answered { ok: true } alone, and the box kept the number typed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSettings } from '../../../core/sdk/settings.js';
import { SETTINGS_SCHEMA, SETTINGS_DEFAULTS } from '../../../modules/people/meters/npc-meters-schema.js';
import { peopleCommand } from '../../../ui/port/people-settings.js';
import { peopleRows, peopleSpec } from '../../../ui/select/people-settings/index.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { renderRow } from '../../../ui/settings/fields.js';

const ID = 'npc-state-delta';
function live() {
  const tree = { storySuite: { modules: { [ID]: {} } } };
  const settings = createSettings({ root: () => tree, registry: { module: id => (id === ID ? { settings: { defaults: SETTINGS_DEFAULTS, schema: SETTINGS_SCHEMA } } : null) } });
  const bucket = () => settings(ID);
  return { bucket, set: (key, value) => peopleCommand('settings.set', { key, value }, { settings: { set: settings.set } }, bucket) };
}

test('a held People number answers with the stored number and its range; one in range answers as typed', () => {
  const s = live();
  assert.deepEqual(s.set('people.dormant', 5), { ok: true, value: 10, range: { min: 10, max: 999 } });
  assert.equal(s.bucket().staleArchiveAfter, 10);
  assert.deepEqual(s.set('people.dormant', 40), { ok: true, value: 40, range: { min: 10, max: 999 } });
  assert.deepEqual(s.set('people.npcsRefreshedPerReply', 9), { ok: true, value: 3, range: { min: 1, max: 3 } });
});

test('the People row redraws the held number and says it was held', async () => {
  installFakeDom();
  const s = live();
  const spec = peopleRows(s.bucket()).find(r => r.key === 'people.dormant');
  assert.equal('range' in spec, false, 'the range stays in the port, not the view row');
  const el = renderRow(spec, { onChange: (key, value) => s.set(key, value) });
  const box = el.querySelector('input');
  box.value = '5';
  box.dispatchEvent(new globalThis.Event('change'));
  await new Promise(r => setTimeout(r, 0));
  assert.equal(box.value, '10');
  assert.equal(el.querySelector('.snote').textContent, 'Dormant after is 10-999; kept 10.');
  box.value = '';
  box.dispatchEvent(new globalThis.Event('change'));
  await new Promise(r => setTimeout(r, 0));
  assert.equal(box.value, '30');
  assert.equal(el.querySelector('.snote').textContent, 'Dormant after cannot be empty; kept 30.');
});

test('every People number row answers what the row then shows: in range as typed, out of range held, a typed 0 where 0 is allowed kept', () => {
  const s = live();
  const nums = peopleRows(s.bucket()).filter(r => r.type === 'num');
  assert.ok(nums.length >= 6);
  for (const row of nums) {
    const range = peopleSpec(row.key).range;
    const tries = range ? [range.min, range.max, Math.floor((range.min + range.max) / 2), range.max + 1000, range.min - 1000] : [7, 99999, -99999];
    for (const typed of tries) {
      const answer = s.set(row.key, typed);
      assert.equal(answer.ok, true, `${row.key} ${typed}`);
      const shown = peopleRows(s.bucket()).find(r => r.key === row.key).value;
      assert.equal(answer.value, shown, `${row.key} ${typed}: the answer is what the row shows`);
      if (range && typed >= range.min && typed <= range.max) assert.equal(answer.value, typed, `${row.key} ${typed} in range comes back as typed`);
    }
  }
});
