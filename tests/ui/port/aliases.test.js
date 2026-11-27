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
  for (const name of ['npc.merge', 'party.invite', 'scene.correct', '', undefined]) assert.equal(port.can(name), false, String(name));
});

test('Plan the next arc, Accept and Discard go to the page planner; a refused plan comes back as a failure with its words', async () => {
  const { aliasCommand, ALIAS_NAMES } = await import('../../../ui/port/aliases.js');
  const calls = [];
  const arc = () => ({
    plan: async options => { calls.push(['plan', options]); return options.note === 'bad' ? { ok: false, message: 'Planning failed: no answer' } : { ok: true, draft: {} }; },
    accept: async () => { calls.push(['accept']); return { ok: true, receipt: {} }; },
    discard: () => { calls.push(['discard']); return { ok: true }; },
  });
  for (const name of ['arc.plan', 'arc.accept', 'arc.discard']) assert.ok(ALIAS_NAMES.includes(name), name);
  assert.deepEqual(await aliasCommand(null, 'arc.plan', { note: 'more Joris' }, arc), { ok: true });
  assert.deepEqual(await aliasCommand(null, 'arc.accept', {}, arc), { ok: true });
  assert.deepEqual(await aliasCommand(null, 'arc.discard', {}, arc), { ok: true });
  assert.deepEqual(await aliasCommand(null, 'arc.plan', { note: 'bad' }, arc), { ok: false, code: 'FAILED', message: 'Planning failed: no answer' });
  assert.deepEqual(calls[0], ['plan', { reason: 'manual', note: 'more Joris' }]);
});

test('Spend points sends the row\'s own spend command when the sheet names one, and the port can() it when a module registers it', async () => {
  const sent = [];
  const sdk = {
    query: name => (name === 'rpg.sheet' ? [{ id: 'm1', stats: { STR: 5 }, points: 2, commands: { spend: 'textRpg.spend' } }] : null),
    command: async (type, payload) => { sent.push([type, payload]); return { ok: true, note: 'mine' }; },
    modules: () => [{ commands: ['textRpg.spend'] }],
  };
  const port = createSbPort({ sdk, selectors: {} });
  assert.deepEqual(await port.command('rpg.stats.spend', { member: 'm1', stats: { STR: 6 } }), { ok: true, note: 'mine' });
  assert.deepEqual(sent, [['textRpg.spend', { member: 'm1', stats: { STR: 1 } }]]);
  assert.equal(port.can('textRpg.spend'), true);
  assert.equal(port.can('textRpg.other'), false);
});

test('Spend points on a row without commands.spend takes the old path (no block: refused, nothing sent)', async () => {
  const sent = [];
  const sdk = { query: () => [{ id: 'm1', stats: { STR: 5 }, points: 2, commands: { spend: 7 } }], command: async type => { sent.push(type); return { ok: true }; } };
  const answer = await createSbPort({ sdk, selectors: {} }).command('rpg.stats.spend', { member: 'm1', stats: { STR: 6 } });
  assert.equal(answer.ok, false);
  assert.deepEqual(sent, []);
});

test('a plug-in sheet\'s own spend command is called only when its name is a plain command name', async () => {
  const { aliasCommand } = await import('../../../ui/port/aliases.js');
  const sent = [];
  const sdkFor = spend => ({ query: () => [{ id: 'a', stats: { str: 5 }, commands: { spend } }], command: async (type, payload) => { sent.push([type, payload]); return { ok: true }; } });
  assert.deepEqual(await aliasCommand(sdkFor('textRpg.spend'), 'rpg.stats.spend', { member: 'a', stats: { str: 6 } }), { ok: true });
  assert.deepEqual(sent, [['textRpg.spend', { member: 'a', stats: { str: 1 } }]]);
  sent.length = 0;
  for (const bad of ['bad name', '1x', 'x/y', 'a'.repeat(81)]) assert.equal((await aliasCommand(sdkFor(bad), 'rpg.stats.spend', { member: 'a', stats: {} })).ok, false, bad);
  assert.deepEqual(sent, []);
});

test('a plug-in sheet gets the points bought, not the new totals; lowering, unknown stats and no change send nothing', async () => {
  const { aliasCommand } = await import('../../../ui/port/aliases.js');
  const sent = [];
  const sdk = { query: () => [{ id: 'rav', stats: { STR: 8, DEX: 12, WIS: 6 }, points: 3, commands: { spend: 'textRpg.spend' } }], command: async (type, payload) => { sent.push([type, payload]); return { ok: true }; } };
  assert.deepEqual(await aliasCommand(sdk, 'rpg.stats.spend', { member: 'rav', stats: { STR: 8, DEX: 14, WIS: 7 } }), { ok: true });
  assert.deepEqual(sent, [['textRpg.spend', { member: 'rav', stats: { DEX: 2, WIS: 1 } }]]);
  sent.length = 0;
  assert.equal((await aliasCommand(sdk, 'rpg.stats.spend', { member: 'rav', stats: { STR: 7, DEX: 13 } })).ok, false);
  assert.equal((await aliasCommand(sdk, 'rpg.stats.spend', { member: 'rav', stats: { LUK: 3 } })).ok, false);
  assert.deepEqual(await aliasCommand(sdk, 'rpg.stats.spend', { member: 'rav', stats: { STR: 8, DEX: 12, WIS: 6 } }), { ok: true });
  assert.deepEqual(sent, []);
});
