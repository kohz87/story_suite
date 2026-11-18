// The People list rows' writes: what the port stores under customMeters, stages, ladder and presets (NPC State's keys), cut the way the
// engine and the host schema read them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleCommand } from '../../../ui/port/people-settings.js';
import { createSettings } from '../../../core/sdk/settings.js';
import { SETTINGS_SCHEMA, SETTINGS_DEFAULTS } from '../../../modules/people/meters/npc-meters-schema.js';
import { normalizeMeterSettings } from '../../../modules/people/meters/npc-meters-config.js';

const ID = 'npc-state-delta';
function store(initial = {}, packs = []) {
  const tree = { storySuite: { modules: { [ID]: structuredClone(initial) } } };
  const settings = createSettings({ root: () => tree, registry: { module: id => (id === ID ? { settings: { defaults: SETTINGS_DEFAULTS, schema: SETTINGS_SCHEMA } } : null) } });
  const set = (key, value) => peopleCommand('settings.set', { key: `people.${key}`, value }, { settings: { set: settings.set } }, () => settings(ID), () => packs);
  return { set, read: () => settings(ID) };
}
const meter = name => ({ name, min: 0, max: 100, start: 10, show: 'bar', tone: 'good', describe: 'a rule', bands: 'low 30, high', drift: 2, driftTo: 40 });

test('custom meters keep every field the host schema has, at most six, and the engine reads them', () => {
  const s = store();
  assert.equal(s.set('customMeters', ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(meter)).ok, true);
  assert.equal(s.read().customMeters.length, 6);
  assert.deepEqual(s.read().customMeters[0], meter('A'));
  assert.deepEqual(normalizeMeterSettings(s.read()).custom.map(m => [m.id, m.tone, m.drift?.perDay]).slice(0, 2), [['a', 'good', 2], ['b', 'good', 2]]);
  assert.equal(s.set('customMeters', 'Fear').ok, false, 'not a list: refused');
});

test('a rename moves the stages that name the meter; a removal or a rename onto a built-in name does not', () => {
  const s = store({ customMeters: [meter('Fear'), meter('Debt')], stages: [{ meter: 'fear', at: 30, name: 'Uneasy' }, { meter: 'Debt', at: 50, name: 'Owing' }] });
  s.set('customMeters', [meter('Dread'), meter('Debt')]);
  assert.deepEqual(s.read().stages.map(x => x.meter), ['Dread', 'Debt']);
  s.set('customMeters', [meter('Debt')]);
  assert.deepEqual(s.read().stages.map(x => x.meter), ['Dread', 'Debt'], 'removing Dread leaves its stage (marked not used on the page)');
  s.set('customMeters', [meter('Trust')]);
  assert.deepEqual(s.read().stages.map(x => x.meter), ['Dread', 'Debt']);
});

test('meter presets store ids in the order they were picked; a name the catalog lacks is refused; a pack preset off now stays stored', () => {
  const pack = { id: 'pack.ersveil/guild', title: 'Guild', meters: [{ name: 'Standing', min: 0, max: 100 }] };
  const s = store({ presets: ['pack.old/gone', 'mentor'] }, [pack]);
  assert.equal(s.set('presets', ['Mentor', 'Guild', 'Rival']).ok, true);
  assert.deepEqual(s.read().presets, ['pack.old/gone', 'mentor', 'pack.ersveil/guild', 'rival']);
  assert.equal(s.set('presets', ['Nobody']).ok, false);
  assert.deepEqual(s.read().presets, ['pack.old/gone', 'mentor', 'pack.ersveil/guild', 'rival']);
  s.set('presets', ['Rival']);
  assert.deepEqual(s.read().presets, ['pack.old/gone', 'rival']);
});

test('stages and ladder rungs are stored in the host schema\'s fields; the engine reads them', () => {
  const s = store({ customMeters: [meter('Fear')] });
  assert.equal(s.set('perMeterStages', [{ meter: 'Fear', at: '40', name: ' Scared ', extra: 1 }, { meter: 'Trust', at: -20, name: 'Wary' }]).ok, true);
  assert.deepEqual(s.read().stages, [{ meter: 'Fear', at: 40, name: 'Scared' }, { meter: 'Trust', at: -20, name: 'Wary' }]);
  assert.equal(s.set('stageLadder', [{ name: 'Friend', needs: 'trust 20, fear 10', milestone: '', track: '' }, { name: 'Ally', needs: 'trust 50', milestone: 'fought together', track: 'rival' }]).ok, true);
  const n = normalizeMeterSettings(s.read());
  assert.deepEqual(n.stages.fear, [{ at: 40, name: 'Scared' }]);
  assert.deepEqual([n.ladder[''][0].name, n.ladder[''][0].needs.map(x => x.meter), n.ladder.rival[0].milestone.name], ['Friend', ['trust', 'fear'], 'fought together']);
  assert.equal(s.set('stageLadder', null).ok, false);
});
