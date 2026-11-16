// Contract: a real Story Block host with Story Director (a quest told over three replies, a lead, a story clock) read through createSbPort + the Journal selector fits JOURNAL_SHAPE.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../packages/story-block/testkit/index.js';
import { createModule } from '../../packages/story-director/src/v2/module.js';
import { withD1 } from '../../packages/story-director/tests/v2/helpers/d1.js';
import { checkPort } from '../../ui/port/contract.js';
import { createSbPort } from '../../ui/port/sb-port.js';
import { buildSelectors } from '../../ui/select/build.js';
import { JOURNAL_SHAPE } from '../../ui/contract/journal.js';
import { checkShape } from '../../ui/contract/shapes.js';
import { buildJournal } from '../../ui/fixtures/journal.js';

const said = (text, lines) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;

async function story() {
  let host = null;
  const director = withD1(createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } }));
  host = await createHost({ modules: [director] });
  await host.send('Hello.', said('The guild.', ['~ time June 3, 1200, 08:00 am', '+ quest Wolf pelts — thin the pack | giver: Warden Ash | reward: 20 copper | step: ask at the lodge | difficulty: hard']));
  await host.send('On.', said('The ridge.', ['~ quest Wolf pelts | step: track the pack along the ridge']));
  await host.send('On.', said('The den.', ['~ quest Wolf pelts | step: clear the den', '+ hook Toll Audit — customs dispute the seal | reward: 2 silver']));
  return host;
}

test('a quest told over three replies keeps its steps; difficulty, reward, the weekday and a lead lapse date reach the Journal; the shape holds', async t => {
  t.mock.method(console, 'warn', () => {});
  const host = await story();
  t.after(() => host.close());
  const errors = [];
  const port = createSbPort({ sdk: host.sdk, selectors: buildSelectors(() => null, host.sdk), onError: (tab, e) => errors.push(e.stack) });
  assert.equal(checkPort(port).ok, true);
  const vm = port.view('journal');
  assert.deepEqual(errors, []);
  assert.deepEqual(checkShape(vm, JOURNAL_SHAPE), []);
  const [quest] = vm.quests;
  assert.deepEqual(quest.steps, ['ask at the lodge', 'track the pack along the ridge', 'clear the den']);
  assert.deepEqual([quest.stepIndex, quest.stepCount, quest.step], [2, 3, 'clear the den']);
  assert.deepEqual([quest.difficulty, quest.reward, quest.xp], ['hard', '20 copper', null]);
  const time = host.sdk.query('director.time');
  assert.equal(typeof time.weekday, 'string');
  assert.ok(time.weekday.length > 0);
  assert.equal(vm.calendar.months.length, time.firstWeekdays.length);
  assert.deepEqual(vm.calendar.months.map(m => m.firstWeekday), time.firstWeekdays);
  assert.equal(port.view('card').scene.weekday, time.weekday);
  const lead = host.sdk.query('director.world.leads').rows.find(row => row.name === 'Toll Audit');
  assert.match(lead.lapses, /June/);
  assert.equal(typeof lead.lapsesAt, 'number');
  assert.equal(vm.leads.find(row => row.title === 'Toll Audit').lapses, lead.lapses);
});

const TOLD = [
  ['~ time June 3, 1200, 08:00 am', '+ quest Wolf pelts — thin the pack | giver: Warden Ash | step: ask at the lodge'],
  ['~ quest Wolf pelts | step: track the pack along the ridge'],
  ['~ quest Wolf pelts | step: clear the den'],
];

async function told(lines) {
  let host = null;
  const director = withD1(createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } }));
  host = await createHost({ modules: [director] });
  for (const l of lines) await host.send('On.', said('The road.', l));
  return host;
}
const stepsOf = host => host.sdk.query('quest.board').active[0]?.steps;

test('replay is live: the step trail is the same after a reload and a swipe', async t => {
  t.mock.method(console, 'warn', () => {});
  const host = await told(TOLD);
  t.after(() => host.close());
  assert.deepEqual(stepsOf(host), ['ask at the lodge', 'track the pack along the ridge', 'clear the den']);
  await host.turn.onChatChanged();
  assert.deepEqual(stepsOf(host), ['ask at the lodge', 'track the pack along the ridge', 'clear the den'], 'reload');
  await host.swipe(said('The den, again.', ['~ quest Wolf pelts | step: sneak past the den']));
  assert.deepEqual(stepsOf(host), ['ask at the lodge', 'track the pack along the ridge', 'sneak past the den'], 'swipe');
  const fresh = await told([TOLD[0], TOLD[1], ['~ quest Wolf pelts | step: sneak past the den']]);
  t.after(() => fresh.close());
  const view = h => h.sdk.query('director.threads', {}).map(({ fields, steps, status }) => ({ fields, steps, status }));
  assert.deepEqual(view(host), view(fresh), 'a swipe equals a story told that way');
});

test('a middle delete gives the trail of a story told without that reply', async t => {
  t.mock.method(console, 'warn', () => {});
  const host = await told(TOLD);
  t.after(() => host.close());
  const at = host.st.ctx.chat.findIndex(m => String(m.mes).includes('The road.') && host.st.ctx.chat.indexOf(m) > 2);
  await host.st.deleteMessage(at);
  const fresh = await told([TOLD[0], TOLD[2]]);
  t.after(() => fresh.close());
  assert.deepEqual(stepsOf(host), stepsOf(fresh));
  assert.deepEqual(stepsOf(host), ['ask at the lodge', 'clear the den']);
});

test('without a story clock or quests the Journal still fits the shape; the fixture fits it too', async t => {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost();
  t.after(() => host.close());
  const port = createSbPort({ sdk: host.sdk, selectors: buildSelectors(() => null, host.sdk) });
  const vm = port.view('journal');
  // Nothing from the Director: no quests, no calendar (the contract's calendar is the Director's to fill).
  assert.deepEqual([vm.quests, vm.leads, vm.calendar], [[], [], null]);
  assert.deepEqual(checkShape(buildJournal(), JOURNAL_SHAPE), []);
});
