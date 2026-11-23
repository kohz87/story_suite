// A plug-in sheet's seams on the Party tab: its Create character screen and its skill edit command; without them, today's names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { partyTab } from '../../../../ui/tabs/party/party.js';
import { skillsCard, skillSheet } from '../../../../ui/tabs/party/skills.js';
import { makeCtx, flush, commands } from './helpers.js';

const opens = port => port.recorded.filter(r => r.kind === 'open').map(r => r.id);
const empty = extra => ({ members: [], pcId: null, max: 4, canInvite: false, newCharacter: true, ...extra });

test('Create your character opens the screen the view-model names, else the Story Block window', async () => {
  const own = makeCtx();
  partyTab(empty({ newCharacterScreen: 'text-rpg/create' }), own).querySelector('[data-act="new-character"]').click();
  await flush();
  assert.deepEqual(opens(own.port), ['text-rpg/create']);
  const old = makeCtx();
  partyTab(empty(), old).querySelector('[data-act="new-character"]').click();
  await flush();
  assert.deepEqual(opens(old.port), ['story-block/new-character']);
});

test('Edit sends the member\'s skillEdit command (list and skill sheet), and rpg.skill.edit without one', async () => {
  const ctx = makeCtx();
  const own = { ...ctx.party.members[1], commands: { skillEdit: 'textRpg.skillEdit' } };
  skillsCard(own, ctx).querySelector('.edit').click();
  await flush();
  skillSheet(own, own.skills[0], ctx).body.querySelector('.ps-b').click();
  await flush();
  skillsCard(ctx.party.members[1], ctx).querySelector('.edit').click();
  await flush();
  assert.deepEqual(commands(ctx.port).map(([type]) => type), ['textRpg.skillEdit', 'textRpg.skillEdit', 'rpg.skill.edit']);
});

test('the Edit buttons check the named command with can()', () => {
  const ctx = makeCtx();
  ctx.port.can = type => type !== 'textRpg.skillEdit';
  const member = { ...ctx.party.members[1], commands: { skillEdit: 'textRpg.skillEdit' } };
  assert.equal(skillsCard(member, ctx).querySelector('.edit'), null);
  assert.ok(skillsCard(ctx.party.members[1], ctx).querySelector('.edit'));
});
