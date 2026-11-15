import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { STORY_SHAPE } from '../../../ui/contract/story.js';
import { buildStory } from '../../../ui/fixtures/story.js';

describe('STORY_SHAPE', () => {
  it('accepts every fixture variant, plan shown or hidden', () => {
    const variants = [{}, { planShown: true }, { quiet: true }, { quiet: true, planShown: true }, { empty: true }, { empty: true, planShown: true }];
    for (const opts of variants) {
      assert.deepEqual(checkShape(buildStory(opts), STORY_SHAPE), [], JSON.stringify(opts));
    }
  });

  it('rejects a beat state and a clock "shown" value outside the lists', () => {
    const vm = buildStory({ planShown: true });
    vm.beats.items[0].state = 'done';
    vm.clocks.items[0].shown = 'alarm';
    const errors = checkShape(vm, STORY_SHAPE);
    assert.equal(errors.length, 2);
    assert.ok(errors[0].startsWith('beats.items[0].state'));
    assert.ok(errors[1].startsWith('clocks.items[0].shown'));
  });

  it('requires the plan flag, the cast counts and a numeric sway', () => {
    const vm = buildStory({ planShown: true });
    delete vm.plan.shown;
    vm.cast.unmet = 'four';
    vm.ripples.items[0].sway = null;
    const errors = checkShape(vm, STORY_SHAPE);
    assert.equal(errors.length, 3);
  });

  it('rejects a tracker field kind that is not bar, number or text', () => {
    const vm = buildStory();
    vm.trackers[0].fields[0].kind = 'dial';
    const errors = checkShape(vm, STORY_SHAPE);
    assert.equal(errors.length, 1);
    assert.ok(errors[0].startsWith('trackers[0].fields[0].kind'));
  });

  it('rejects an agenda with no told-this-reply flag', () => {
    const vm = buildStory({ planShown: true });
    delete vm.agendas.items[2].toldThisReply;
    assert.equal(checkShape(vm, STORY_SHAPE).length, 1);
  });
});
