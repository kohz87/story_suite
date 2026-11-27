// A namesake's shown form, Name "Nickname", listed in the scene is that stored person, never someone NPC State has no dossier for.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gather } from '../../../ui/select/gather.js';
import { selectPeople } from '../../../ui/select/people.js';

const row = (id, alias, extra = {}) => ({ id, name: 'Tomas', aliases: [alias], present: true, meters: {}, ...extra });
const living = [row('npc_f', 'the ferryman'), row('npc_w', 'the watchman')];
const dead = [row('npc_f', 'the ferryman', { present: false, lifeState: 'deceased', lifeStateCertainty: 'explicit' }), living[1]];
const SCENE = ['Tomas "the ferryman"', 'Tomas “the watchman”', 'Tomas "the baker"', 'Old Wenna'];

describe('shown forms of namesakes in the scene', () => {
  for (const [what, list] of [['both living', living], ['one dead', dead]]) {
    it(`are not unrecorded people (${what})`, () => {
      const answers = gather(name => (name === 'people.list' ? list : name === 'scene.present' ? SCENE : null), []);
      assert.deepEqual(answers['scene.unrecorded'], ['Tomas "the baker"', 'Old Wenna']);
      assert.deepEqual(selectPeople({ list, present: SCENE }).unrecorded, ['Tomas "the baker"', 'Old Wenna']);
    });
  }
});
