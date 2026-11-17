// The port maps Spend points, Quiet scene and End this arc to what the engine registers: Spend is one dm.set built as the old Spend points sheet builds it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { createHost } from '../../../testkit/index.js';
import { CORE_FEATURE } from '../../../core/features.js';
import { buildDefinitions, newDraft, readDraft } from '../../../modules/rpg/view/wizard-data.js';

const portOf = host => createSbPort({ sdk: host.sdk, selectors: buildSelectors(() => host.ctx, host.sdk) });
// A real host with the RPG on and Wessel (a Combat Rules v1 Character) holding ten points to spend.
async function world(t) {
  const host = await createHost();
  host.features.set(CORE_FEATURE.leanRpg, true);
  await host.send('Begin.', 'Opening.');
  const { character, skills } = buildDefinitions(readDraft({ ...newDraft({ persona: 'Wessel' }), name: 'Wessel' }), { used: [] });
  assert.equal((await host.sdk.command('dm.define', { definition: character })).ok, true);
  assert.equal((await host.sdk.command('dm.define', { definition: skills, after: `pack.chat/${character.slug}` })).ok, true);
  t.after(() => host.close());
  return { host, port: portOf(host) };
}
const sheetOf = host => host.sdk.query('rpg.sheet', {})[0];

test('Spend points writes the raised stats and the points left in one action, and the sheet then reads them', async t => {
  const { host, port } = await world(t);
  const hero = sheetOf(host);
  const calls = [];
  const command = host.sdk.command.bind(host.sdk);
  const spy = createSbPort({ sdk: { ...host.sdk, command: (type, payload, options) => { calls.push(type); return command(type, payload, options); } }, selectors: {} });
  const answer = await spy.command('rpg.stats.spend', { member: hero.id, stats: { ...hero.stats, STR: hero.stats.STR + 1, DEX: hero.stats.DEX + 1 } });
  assert.equal(answer.ok, true, JSON.stringify(answer));
  assert.deepEqual(calls, ['dm.set']);
  const after = sheetOf(host);
  assert.deepEqual([after.stats.STR, after.stats.DEX, after.points], [hero.stats.STR + 1, hero.stats.DEX + 1, 8]);
  const live = JSON.stringify(host.head());
  host.store.rebuild();
  assert.equal(JSON.stringify(host.head()), live, 'a rebuild gives the live story');
});

test('Spend points refuses more than the points left, taking points back and an unknown member, and changes nothing', async t => {
  const { host, port } = await world(t);
  const hero = sheetOf(host);
  const spend = stats => port.command('rpg.stats.spend', { member: hero.id, stats: { ...hero.stats, ...stats } });
  assert.equal((await spend({ STR: hero.stats.STR + 11 })).ok, false);
  assert.equal((await spend({ STR: hero.stats.STR - 1 })).ok, false);
  assert.equal((await port.command('rpg.stats.spend', { member: 'ac_nobody', stats: hero.stats })).ok, false);
  assert.equal((await spend({})).ok, true);
  assert.deepEqual([sheetOf(host).stats, sheetOf(host).points], [hero.stats, 10]);
});

test('Quiet scene and End this arc reach the Director under their registered names', async t => {
  const { host } = await world(t);
  const seen = [];
  const sdk = { ...host.sdk, command: async (type, payload) => { seen.push([type, payload]); return { ok: true }; } };
  const port = createSbPort({ sdk, selectors: {} });
  await port.command('pulse.quiet', { on: true });
  await port.command('arc.end', {});
  assert.deepEqual(seen, [['director.pulse.quiet', { on: true }], ['director.arc.end', {}]]);
});

test('can: the port answers its own names and every registered command, and nothing else', async t => {
  const { port } = await world(t);
  for (const name of ['rpg.stats.spend', 'pulse.quiet', 'arc.end', 'settings.set', 'tracker.pin', 'interaction.stage', 'dm.set']) assert.equal(port.can(name), true, name);
  for (const name of ['npc.edit', 'party.invite', 'scene.correct', '', undefined]) assert.equal(port.can(name), false, String(name));
});
