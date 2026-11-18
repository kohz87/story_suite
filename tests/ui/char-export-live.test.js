// The Party tab's Export on the live mount: the RPG answers `rpg.characterFile` for a member, the port's `party.export` gives it back, and the file reads back with the wizard's parser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { livePage } from './helpers/live-page.js';
import { createSbPort } from '../../ui/port/sb-port.js';
import { actorIdOf } from '../../modules/rpg/roster.js';
import { parseCharacterFile } from '../../modules/rpg/charfile.js';

test('party.export gives a member\'s saved character file (the reader\'s own and a missing member)', async t => {
  const { host } = await livePage(t, { seed: 5105 });
  await host.send('The road bends.', 'On.\n<Changes>\n+ item Rope | qty: 2\n</Changes>');
  const port = createSbPort({ sdk: host.sdk });
  assert.equal(port.can('party.export'), true, 'the port answers it');
  const me = { id: actorIdOf('pack.chat/character') };
  const answer = await port.command('party.export', { member: me.id });
  assert.equal(answer.ok, true, answer.message);
  assert.equal(answer.own, true);
  assert.match(answer.fileName, /\.character\.json$/);
  assert.equal(parseCharacterFile(answer.text).ok, true, 'the wizard reads the file back');
  const file = JSON.parse(answer.text);
  assert.equal(file.level, 5);
  assert.equal(file.skills[0].name, 'Cut', 'the skill with its text');
  assert.equal(file.skills[0].about, 'A hard cut');
  const bare = await port.command('party.export', { member: me.id, inventory: false, money: false });
  assert.equal(JSON.parse(bare.text).items, undefined, 'Inventory off leaves the things out');
  assert.equal(JSON.parse(bare.text).money, undefined, 'Money off leaves the purse out');
  const gone = await port.command('party.export', { member: 'ac_nobody00' });
  assert.equal(gone.ok, false);
});
