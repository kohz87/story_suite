// Journal data (G9): a day's places, quests, fights and money, and a planned trip, reach the Journal; the Journal reads them from the day digest, so a swipe, rewind, reload and Re-read agree with live; without the digest or a trip the rows are as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { createModule } from '../../modules/director/module.js';
import { withD1 } from '../helpers/director/d1.js';
import { createSbPort } from '../../ui/port/sb-port.js';
import { buildSelectors } from '../../ui/select/build.js';
import { selectJournal } from '../../ui/select/journal.js';
import { JOURNAL_SHAPE } from '../../ui/contract/journal.js';
import { checkShape } from '../../ui/contract/shapes.js';

const said = (text, lines) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const TOLD = [
  ['~ time June 3, 1200, 08:00 am', '+ coin 50'],
  ['~ time June 4, 1200, 08:00 am', '- coin 20', '~ place Harrow'],
  ['~ time June 5, 1200, 08:00 am'],
];
const settings = { features: { 'story-director.digest': true } };

async function told(t, lists = TOLD) {
  t.mock.method(console, 'warn', () => {});
  let host = null;
  const director = withD1(createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } }));
  host = await createHost({ modules: [director], settings });
  t.after(() => host.close());
  for (const [i, lines] of lists.entries()) await host.send(`Go ${i}.`, said(`Reply ${i}.`, lines));
  return host;
}
const journalOf = host => createSbPort({ sdk: host.sdk, selectors: buildSelectors(() => host.ctx, host.sdk) }).view('journal');
const daysOf = host => journalOf(host).days.map(d => ({ date: d.date, places: d.places, money: d.money, fights: d.fights, quests: d.quests }));

test('a day\'s places and money reach the Journal in the currency\'s words, and the shape holds', async t => {
  const host = await told(t);
  const vm = journalOf(host);
  assert.deepEqual(checkShape(vm, JOURNAL_SHAPE).filter(e => /^days/.test(e)), []);
  const [june4, june3] = vm.days;
  assert.deepEqual([june4.places, june4.money], [['Harrow'], { in: null, out: '20 gold' }]);
  assert.deepEqual([june3.places, june3.money], [[], { in: '50 gold', out: null }]);
  assert.equal(june4.fights, 0);
  assert.deepEqual(june4.quests, { taken: [], done: [], failed: [], dropped: [] });
});

test('replay is live: reload, rebuild, swipe, a middle delete, a Re-read (edited too) and a rewind', async t => {
  const host = await told(t);
  const live = daysOf(host);
  host.store.rebuild();
  assert.deepEqual(daysOf(host), live, 'rebuild');
  await host.store.flush();
  const loaded = await createHost({ modules: [withD1(createModule({ host: { settings: () => null, substitute: x => x } }))], settings, st: { chat: structuredClone(host.ctx.chat), extensionSettings: structuredClone(host.ctx.extensionSettings) } });
  t.after(() => loaded.close());
  assert.deepEqual(daysOf(loaded), live, 'reload');
  await host.swipe(said('Reply 2 again.', ['~ time June 5, 1200, 08:00 am', '+ coin 9']));
  assert.deepEqual(daysOf(host), [{ date: 'June 5, 1200', places: [], money: { in: '9 gold', out: null }, fights: 0, quests: live[0].quests }, ...live], 'swipe: today so far shows the swiped reply');
  await host.swipe(said('Reply 2.', ['~ time June 5, 1200, 08:00 am']));
  assert.deepEqual(daysOf(host), live, 'swipe back');
  // An edited Re-read (grown, then shrunk): the written days keep the digest they were written with (as their own line does), and shrinking it back gives the live rows.
  const head = host.ctx.chat.length - 1;
  const text = host.ctx.chat[head].mes;
  await host.st.editMessage(head, text.replace('</Changes>', '+ coin 9\n</Changes>'));
  assert.equal((await host.sdk.reread(head)).ok, true);
  assert.deepEqual(daysOf(host).filter(d => d.date !== 'June 5, 1200'), live, 'grown: the written days keep their digest');
  await host.st.editMessage(head, text);
  assert.equal((await host.sdk.reread(head)).ok, true);
  assert.deepEqual(daysOf(host), live, 'shrunk back');
  await host.st.deleteMessage(host.ctx.chat.length - 1);
  assert.ok(daysOf(host).every(d => d.date), 'rewind keeps the days');
});

test('a middle delete gives the days of a story told without that reply', async t => {
  const host = await told(t);
  await host.st.deleteMessage(3);
  await host.st.deleteMessage(3);
  const fresh = await told(t, [TOLD[0], TOLD[2]]);
  assert.deepEqual(daysOf(host), daysOf(fresh));
});

test('the selector: day facts with quests and fights, none = as before; a planned trip becomes a Planned row, a road trip does not', () => {
  const read = (answers) => (name) => answers[name];
  const day = { date: 'June 4, 1200', short: 'x', happened: [], places: ['Harrow'], quests: { taken: ['Wolf pelts'], done: ['Lost ring'], failed: [], dropped: ['Boat'] }, fightCount: 2, money: { in: 150, out: 0 } };
  const vm = selectJournal(read({ 'director.journal': { on: true, days: [day] }, 'inventory.currency': { name: 'mark', plural: 'marks' } }));
  assert.deepEqual([vm.days[0].places, vm.days[0].quests, vm.days[0].fights, vm.days[0].money], [['Harrow'], day.quests, 2, { in: '150 marks', out: null }]);
  const bare = selectJournal(read({ 'director.journal': { on: true, days: [{ date: 'June 4, 1200', short: 'y' }] } }));
  assert.deepEqual([bare.days[0].places, bare.days[0].fights, bare.days[0].money], [[], 0, { in: null, out: null }]);
  const trip = { on: true, phase: 'planned', to: 'Auvoth', row: 'on foot, 12 km', departs: 'Goldwane 14, 10:00 am' };
  assert.deepEqual(selectJournal(read({ 'atlas.trip': trip })).planned, [{ glyph: '➜', title: 'Trip to Auvoth · planned', detail: 'on foot, 12 km · leaves Goldwane 14, 10:00 am' }]);
  assert.deepEqual(selectJournal(read({ 'atlas.trip': { ...trip, phase: 'road' } })).planned, []);
  assert.deepEqual(selectJournal(read({})).planned, []);
});
