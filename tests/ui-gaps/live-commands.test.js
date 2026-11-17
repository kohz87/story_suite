// Contract: every command the new view can send (a source scan of ui/, so a new button cannot slip through) is answered by the live port or registered on a full host plus NPC State;
// a control whose command nobody answers is listed here, drawn only when `port.can` says yes, and stays off the screen otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHost } from '../../testkit/index.js';
import { BUILTIN_MODULES } from '../../core/modules-list.js';
import { COMMAND_NAMES } from '../../modules/people/storysuite-v2.js';
import { createSbPort } from '../../ui/port/sb-port.js';

// Not the new view's: old code, fixtures, the harness, contract text, the selectors' query names, the settings pages (keys sent through settings.set / settings.action), the port's answers to those keys and the old Fight tab (nothing mounts it).
const SKIP = /^ui\/(legacy|fixtures|dev|contract|select|settings)(\/|$)|^ui\/port\/(people-settings|rpg|world-keys|world-settings|settings-director|money|extras)\.js$|^ui\/tabs\/fight\//;
// Strings of the right shape that are not commands: fold keys, a settings row key, view-model ids and the like.
const NOT_COMMANDS = new Set(['bag.assets', 'journal.calendar', 'journal.closed', 'story.agendas.all', 'story.trackers', 'rpg.difficulty', 'now.turn.all', 'now.you', 'fight.party', 'svg.mp', 'rpg.sheet', 'models.test', 'tools.rebuild', 'tools.report', 'calls.fallback', 'calls.kinds', 'calls.queue', 'trackers.open', 'packs.import', 'packs.lorebook', 'packs.remove']);
// Sent after the work is done locally, or only as a fallback the live mount never takes (See on map has the host's hook; the spoiler pref has port.prefs): nothing waits for the answer.
const LOCAL = new Set(['suite.go', 'suite.settings', 'prefs.spoiler.set', 'people.focus']);
// Nobody registers these yet: the control is drawn only while `port.can` says yes.
const UNWIRED = ['npc.edit', 'npc.portrait', 'npc.inspect', 'npc.merge', 'npc.delete', 'npc.memory.add', 'npc.markAlive', 'npc.add', 'party.invite', 'party.bench', 'party.export', 'party.leave', 'rpg.skill.edit', 'item.use', 'quest.edit', 'quest.giveup', 'quest.delete', 'quest.focus', 'arc.plan', 'scene.correct'];

const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const path = join(dir, entry.name);
  if (SKIP.test(path)) return [];
  return entry.isDirectory() ? walk(path) : path.endsWith('.js') ? [path] : [];
});

function sentNames() {
  const found = new Map();
  for (const file of walk('ui')) {
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    for (const match of source.matchAll(/['"`]([a-z]+(?:\.[a-z][A-Za-z]*|\.\$\{[a-z]+\})+)['"`]/g)) {
      const names = match[1] === 'npc.${id}' ? [...(source.match(/MENU = Object\.freeze\(\[[\s\S]*?\]\);/)?.[0] ?? '').matchAll(/\['([a-z]+)', '[A-Z]/g)].map(m => `npc.${m[1]}`) : [match[1]];
      for (const name of names) found.set(name, [...(found.get(name) ?? []), file]);
    }
  }
  return found;
}

async function livePort(options) {
  const host = await createHost({ core: true, modules: BUILTIN_MODULES, ...options });
  const sdk = { ...host.sdk, modules: () => [...host.sdk.modules(), { id: 'npc-state', commands: COMMAND_NAMES }] };
  return { host, port: createSbPort({ sdk }) };
}

for (const lazyRpg of [false, true]) {
  test(`every command the new view sends is answered, or its control is gated by port.can (lazyRpg ${lazyRpg})`, async t => {
    const { host, port } = await livePort({ lazyRpg });
    t.after(() => host.close());
    const sent = [...sentNames()].filter(([name]) => !NOT_COMMANDS.has(name) && !LOCAL.has(name) && !name.startsWith('interaction.'));
    assert.ok(sent.length > 30, 'the scan found the commands');
    const dead = sent.filter(([name]) => !port.can(name)).map(([name]) => name);
    assert.deepEqual(dead.sort(), UNWIRED.filter(name => sent.some(([n]) => n === name)).sort());
    for (const name of UNWIRED) assert.equal(port.can(name), false, `${name} is unwired, so can says no`);
    for (const [name, files] of sent.filter(([name]) => UNWIRED.includes(name))) {
      assert.ok(files.some(file => /\bcan\(/.test(readFileSync(file, 'utf8'))), `${name}: a file that sends it asks can()`);
    }
  });
}

test('the three wired names reach the engine: can says yes and the Director names are registered', async t => {
  const { host, port } = await livePort({});
  t.after(() => host.close());
  for (const name of ['pulse.quiet', 'arc.end', 'rpg.stats.spend', 'tracker.pin', 'dm.set', 'people.follow', 'settings.set', 'packs.offer']) assert.equal(port.can(name), true, name);
  assert.equal(port.can('nothing.here'), false);
});
