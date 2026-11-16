// What the fight renderer stages must be accepted by the Story Block fight kind: the same inputs through toAction and exchangePlan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { sceneTab } from '../../../../ui/tabs/scene/host.js';
import { selectScene } from '../../../../ui/select/interaction.js';
import { selectFight } from '../../../../ui/select/fight.js';
import { createFakePort } from '../../../../ui/port/fake-port.js';
import { readSheet } from '../../../../packages/story-block/src/v2/lean-rpg/read.js';
import { splitFoes } from '../../../../packages/story-block/src/v2/lean-rpg/board/members.js';
import { exchangePlan } from '../../../../packages/story-block/src/v2/lean-rpg/board/plan.js';
import { toAction } from '../../../../packages/story-block/src/v2/lean-rpg/board/interaction.js';
import { character, levelFoeBlock, sheetDomain, skillBlock } from '../../../../packages/story-block/tests/v2/lean-rpg/helpers.js';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const tap = (tab, selector) => tab.querySelector(selector).click();

// A 2-member party against two foe groups (3 + 2 members), read as the board reads it.
const blocks = {
  hero: { role: 'character', fields: character('Astra', { str: 20, agi: 20, health: 8 }) },
  ally: { role: 'character', fields: character('Torka', { str: 12, agi: 8, health: 8 }) },
  skills: { role: 'skills', fields: skillBlock('Astra', [['Sweep', 3, 'str', 'stamina', 'sweep every foe']]) },
  foes: { role: 'foes', fields: levelFoeBlock([['Bristle-boar', 3, 1, 4], ['Spiders', 2, 1, 4]]) },
};
const base = readSheet({ domains: { dataModules: sheetDomain(blocks) } });
const sheet = { ...base, foes: splitFoes(base.foes) };
const members = sheet.foes.map(foe => ({ slot: foe.slot, group: foe.group, n: 1, name: foe.name, value: 4, size: 4, pack: false, count: 1, left: 1, attacks: 1, standing: true }));
const WHO = ['Astra', 'Torka'];
const party = WHO.map(who => ({ who })).map(person => ({ name: person.who, bars: { health: { value: 8, max: 8 }, mana: { value: 4, max: 4 }, stamina: { value: 8, max: 8 } } }));
const choicesOf = who => ({ actor: { who }, choices: [
  { action: { kind: 'attack', who }, view: { name: 'Attack', stat: 'str' } },
  { action: { kind: 'skill', who, skill: 'Sweep', area: true }, view: { name: 'Sweep', stat: 'str', cost: 2, area: true } },
  { action: { kind: 'item', who, stack: 'potion' }, view: { name: 'Use item' }, items: [{}] },
  { action: { kind: 'flee', who }, view: { name: 'Flee' } },
] });
const answerOf = () => {
  const snapshot = { session: { setup: {}, exchanges: [] }, played: { result: { members, rounds: [], order: [], stop: null } } };
  const views = WHO.map(who => selectFight({ snapshot, party, foes: sheet.foes, choices: choicesOf(who) }));
  const view = { ...views[0], state: 'choose', actors: views.map(v => v.actors[0]) };
  return selectScene({ id: 'rt:0:story-block/fight', kindId: 'story-block/fight', title: view.title, state: 'open', steps: [], canSend: false, canDiscard: true, view });
};
const plan = inputs => exchangePlan(sheet, inputs.map(toAction), {}, 1, { members: true });
const stagedBy = async picks => {
  installFakeDom();
  const port = createFakePort(), vm = { ...answerOf(), id: `rt-${picks.join('-')}`, steps: 0 };
  const tab = sceneTab(vm, { port });
  const act = { attack: 'attack:0', sweep: 'skill:1', flee: 'flee:3' };
  for (const [name, target] of picks) {
    tap(tab, `[data-act="${act[name]}"]`);
    if (target) tap(tab, target);
  }
  await flush();
  return port.recorded.filter(r => r.type === 'interaction.stage').map(r => r.payload.step.inputs);
};

test('single-target picks (a member slot) are accepted by the kind', async () => {
  const [inputs] = await stagedBy([['attack', `[data-target="${members[0].slot}"]`], ['attack', `[data-target="${members.at(-1).slot}"]`]]);
  assert.equal(inputs.length, 2);
  assert.equal(plan(inputs).error, undefined, plan(inputs).error);
});

test('an area skill that needs a group (a group id) is accepted by the kind', async () => {
  const [inputs] = await stagedBy([['sweep', `[data-target="${sheet.foes.at(-1).name.replace(/ \d+$/u, '')}"]`], ['attack', `[data-target="${members[0].slot}"]`]]);
  assert.equal(inputs[0].args.area, true);
  assert.ok(Number.isInteger(inputs[0].args.group));
  assert.equal(plan(inputs).error, undefined, plan(inputs).error);
});

test('Flee stages alone and the kind accepts it; flee with other picks is refused', async () => {
  const staged = await stagedBy([['attack', `[data-target="${members[0].slot}"]`], ['flee', null]]);
  assert.equal(staged.length, 1);
  assert.deepEqual(staged[0].map(i => [i.actor, i.choice]), [['torka', 'flee']]);
  assert.equal(plan(staged[0]).error, undefined, plan(staged[0]).error);
  assert.match(plan([{ actor: 'astra', choice: 'attack', args: { who: 'Astra', target: members[0].slot } }, staged[0][0]]).error, /Flee is the whole exchange/);
});
