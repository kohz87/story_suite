import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { SCENE_SHAPE, GENERIC_VIEW_SHAPE } from '../../../ui/contract/interaction.js';
import { SCENE_FIXTURE_STATES, sceneAnswer, sceneFixture } from '../../../ui/fixtures/interaction.js';
import { selectScene } from '../../../ui/select/interaction.js';
import { createFakePort } from '../../../ui/port/fake-port.js';
import { checkPort } from '../../../ui/port/contract.js';
import { createSbPort } from '../../../ui/port/sb-port.js';

describe('SCENE_SHAPE', () => {
  it('accepts every fixture state, long or not, and its generic view', () => {
    for (const state of SCENE_FIXTURE_STATES) for (const long of [false, true]) {
      const vm = sceneFixture(state, { long });
      assert.deepEqual(checkShape(vm, SCENE_SHAPE), [], state);
      assert.deepEqual(checkShape(vm.view, GENERIC_VIEW_SHAPE), [], state);
    }
  });

  it('rejects a bad state, a text step count and a choice without a label', () => {
    const vm = sceneFixture('open');
    vm.state = 'idle';
    vm.steps = [];
    vm.view = { choices: [{ id: 'a' }] };
    assert.deepEqual([...checkShape(vm, SCENE_SHAPE), ...checkShape(vm.view, GENERIC_VIEW_SHAPE)], [
      'state: expected one of [open, staged, sent, invalidated], got "idle"',
      'steps: expected number, got array',
      'choices[0].label: expected string, got undefined',
      'choices[0].actor: expected string, got undefined',
    ]);
  });
});

describe('selectScene', () => {
  it('turns the interaction.view answer into the Scene view-model', () => {
    const vm = selectScene(sceneAnswer('staged'));
    assert.equal(vm.steps, 1);
    assert.equal(vm.canSend, true);
    assert.equal(vm.title, 'The ferry crossing');
  });

  it('answers null for no interaction and a damaged answer; the fight board is a scene like any other', () => {
    assert.equal(selectScene(null), null);
    assert.equal(selectScene({ kindId: 'probe/ferry' }), null);
    assert.equal(selectScene({ ...sceneAnswer('open'), kindId: 'story-block/fight' }).kindId, 'story-block/fight');
  });

  it('falls back on Activity for a title, on open for an unknown state, and drops nothing else', () => {
    const vm = selectScene({ ...sceneAnswer('open'), title: ' ', state: 'weird', canDiscard: undefined });
    assert.equal(vm.title, 'Activity');
    assert.equal(vm.state, 'open');
    assert.equal(vm.canDiscard, true);
  });
});

describe('both ports keep the port contract with the scene wired', () => {
  it('fake port and Story Block port', () => {
    assert.equal(checkPort(createFakePort({ variant: { scene: 'open' } })).ok, true);
    assert.equal(checkPort(createSbPort({ sdk: { interaction: {} } })).ok, true);
    assert.deepEqual(createFakePort({ variant: { scene: 'open' } }).view('scene'), sceneFixture('open'));
    assert.equal(createFakePort().view('scene'), null);
  });
});

describe('nothing changes while no interaction is asked for', () => {
  it('fixtures carry no scene key, and the fixture keys are the ones before the Scene tab', async () => {
    const { fixture } = await import('../../../ui/fixtures/index.js');
    for (const variant of ['default', 'rpgOff', 'fightOpen', 'empty']) {
      assert.deepEqual(Object.keys(fixture(variant)), ['card', 'now', 'chat', 'people', 'party', 'bag', 'fight', 'world', 'journal', 'story', 'settings', 'dossier'], variant);
    }
    assert.equal(Object.keys(fixture({ scene: 'open' }))[0], 'scene');
  });
});
