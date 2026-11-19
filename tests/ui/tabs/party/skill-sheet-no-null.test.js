import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { skillSheet } from '../../../../ui/tabs/party/skills.js';

test('a skill sheet without Edit skill prints no "null" where the button would be', () => {
  installFakeDom();
  let body = null;
  const ctx = { openSheet: () => null, port: { can: () => false } };
  const member = { id: 'astra', name: 'Astra' };
  const skill = { name: 'Iaijutsu', kind: 'attack', stat: 'AGI', resource: 'stamina', cost: 1, rank: 'Novice', mastery: 1, about: 'Draws and cuts in one motion.' };
  const sheet = skillSheet(member, skill, { ...ctx, doc: globalThis.document });
  body = sheet?.body ?? sheet;
  assert.ok(body, 'the sheet opened');
  assert.doesNotMatch(body.textContent, /null|undefined/);
  assert.match(body.textContent, /Draws and cuts/);
});
