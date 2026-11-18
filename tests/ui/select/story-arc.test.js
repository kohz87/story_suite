// Story › Director and Journal on a real host: the arc card's accepted date and waiting plan, an overdue clock, and a hook the narrator told (a lead in the Journal, not a hidden planned hook).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { createModule } from '../../../modules/director/module.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { selectStory } from '../../../ui/select/story.js';

const said = (text, lines = []) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const ARC = { current: { id: 'ar_1', key: 'The Grey Toll', desc: 'x', active: true, minutes: 100, beats: { done: 0, total: 1 } } };
const CAL = { months: [{ name: 'Goldwane', days: 30 }], week: ['Mon'], preset: 'custom' };

async function story(lines) {
  const host = await createHost({ modules: [createModule()] });
  await host.send('Hello.', said('The harbour.', ['~ time December 7, 1200, 08:00 am', ...lines]));
  const port = createSbPort({ sdk: host.sdk, selectors: buildSelectors(() => host.ctx, host.sdk) });
  return { host, port };
}

test('arc card: the accepted date comes from the arc, none accepted without a running arc, and a waiting plan shows with its text only when the plan is shown', () => {
  const read = (name) => (name === 'director.arc' ? ARC : name === 'director.calendar' ? CAL : null);
  const draft = { text: '+ arc Next', reason: 'no-arc' };
  assert.equal(typeof selectStory(read, { planShown: true }).arc.accepted, 'string');
  assert.equal(selectStory(() => null, {}).arc.accepted, null);
  const shown = selectStory(read, { planShown: true, arcStatus: { draft, busy: true, error: 'late' } }).arc;
  assert.deepEqual([shown.draft, shown.busy, shown.error], [{ reason: 'no-arc', text: '+ arc Next' }, true, 'late']);
  assert.deepEqual(selectStory(read, { arcStatus: { draft } }).arc.draft, { reason: 'no-arc', text: '' });
});

test('a clock past its due day is overdue; one still to come is not', async () => {
  const { host, port } = await story(['+ clock Thaw — the ice goes | due: December 5', '+ clock Feast — the table is laid | due: December 20']);
  const items = port.view('story', { planShown: true }).clocks;
  assert.equal(items.count, 2);
  const plan = host.sdk.query('director.plan', {});
  assert.deepEqual(plan.clocks.map(c => [c.key, c.overdue]), [['Thaw', true], ['Feast', false]]);
  host.close();
});

test('a hook the narrator told is a Journal lead (the world leads) and no longer a hidden planned hook on the Director tab', async () => {
  const { host, port } = await story(['+ hook Lamps in the drowned fields — lights seen at night']);
  assert.equal(host.sdk.query('director.plan', {}).hooks[0].planned, false);
  assert.deepEqual(port.view('journal').leads.map(l => l.title), ['Lamps in the drowned fields']);
  assert.equal(port.view('story').hooks.count, 0);
  host.close();
});

test('B16: an ended arc is no running arc, and a waiting plan is not also "no plan yet"', () => {
  const ended = { current: { ...ARC.current, active: false, ended: { reason: 'the arc ended' } } };
  const arc = selectStory(name => (name === 'director.arc' ? ended : name === 'director.calendar' ? CAL : null), { planShown: true }).arc;
  assert.deepEqual([arc.plan, arc.open, arc.accepted], [null, false, null]);
  const waiting = selectStory(() => null, { planShown: true, arcStatus: { draft: { text: 'x', reason: 'no-arc' } } });
  assert.equal(waiting.plan.note, '');
});
