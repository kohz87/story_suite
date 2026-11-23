// The port's party.export: the RPG's `rpg.characterFile` unless the row names its own export query (via), checked as a plain name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { exportCommand } from '../../../ui/port/party-export.js';

const sdkOf = asked => ({ query: (name, args) => { asked.push([name, args]); return { ok: true, name: 'A', fileName: 'a.character.json', text: '{}' }; } });

test('without via the RPG\'s query is asked; with a plain via, that query; a bad via falls back to the RPG\'s', () => {
  const asked = [];
  assert.equal(exportCommand(sdkOf(asked), { member: 'm1' }).ok, true);
  assert.equal(exportCommand(sdkOf(asked), { member: 'm1', via: 'textRpg.export', inventory: false, money: false }).ok, true);
  exportCommand(sdkOf(asked), { member: 'm1', via: 'bad name/../x' });
  assert.deepEqual(asked, [['rpg.characterFile', { id: 'm1' }], ['textRpg.export', { id: 'm1', inventory: false, money: false }], ['rpg.characterFile', { id: 'm1' }]]);
});

test('a query that answers nothing or a refusal gives the plain failure', () => {
  assert.deepEqual(exportCommand({ query: () => null }, { member: 'm', via: 'textRpg.export' }), { ok: false, code: 'FAILED', message: 'The character file could not be made.' });
  assert.equal(exportCommand({ query: () => ({ ok: false, message: 'Gone.' }) }, { member: 'm' }).message, 'Gone.');
});
